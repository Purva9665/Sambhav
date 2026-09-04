require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const { reportEmailConfig } = require('./utils/emailService');
const { ZONE } = require('./utils/dates');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const leaveRoutes = require('./routes/leaveRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PROD = process.env.NODE_ENV === 'production';

/* -------------------------------------------------------- Startup checks */

/**
 * Fail fast on missing secrets rather than silently falling back. The old code
 * defaulted JWT_SECRET to a literal string committed in the repo, which meant a
 * deploy without the variable set would happily sign forgeable tokens.
 */
function requireEnv() {
  const missing = ['MONGODB_URI', 'JWT_SECRET'].filter(k => !process.env[k]);

  if (missing.length) {
    console.error(`[FATAL] Missing required environment variable(s): ${missing.join(', ')}`);
    console.error('[FATAL] Set them in your host\'s environment, then redeploy. See .env.example.');
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.error('[FATAL] JWT_SECRET must be at least 32 characters.');
    console.error('[FATAL] Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    process.exit(1);
  }

  if (!process.env.ADMIN_EMAIL) {
    console.warn('[WARN] ADMIN_EMAIL is not set — registration codes have nowhere to go.');
  }
}

requireEnv();

/* ------------------------------------------------------------ Middleware */

// Render terminates TLS at its proxy. Without this, express-rate-limit keys
// every request to the proxy's IP and `req.ip` is useless in the audit log.
app.set('trust proxy', 1);

app.use(helmet());
app.disable('x-powered-by');

/**
 * CORS: an explicit allowlist. `origin: '*'` let any site on the internet call
 * this API with a user's credentials.
 */
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Same-origin / curl / server-to-server requests send no Origin header
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin.replace(/\/+$/, ''))) return callback(null, true);

    if (!IS_PROD) {
      console.warn(`[CORS] Allowing ${origin} (development). Add it to CORS_ORIGINS before deploying.`);
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error('Origin not allowed by CORS policy.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

/* ---------------------------------------------------------- Rate limiting */

const limiter = (windowMinutes, max, message) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message }
});

app.use('/api/v1/auth/login', limiter(15, 10, 'Too many sign-in attempts. Try again in 15 minutes.'));
app.use('/api/v1/auth/register', limiter(60, 5, 'Too many registration attempts. Try again later.'));
app.use('/api/v1/auth/verify-otp', limiter(15, 10, 'Too many verification attempts. Try again in 15 minutes.'));
app.use('/api/v1/auth/password', limiter(15, 12, 'Too many password requests. Try again in 15 minutes.'));
app.use('/api/v1', limiter(15, 600, 'Too many requests. Please slow down.'));

/* -------------------------------------------------------------- Routes */

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timezone: ZONE,
    timestamp: new Date().toISOString()
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/announcements', announcementRoutes);
app.use('/api/v1/leave', leaveRoutes);

// Unmatched API routes returned Express's HTML error page, which the client
// could not parse. Always answer JSON.
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `No such endpoint: ${req.method} ${req.originalUrl}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.message?.includes('CORS')) {
    return res.status(403).json({ success: false, message: 'Origin not allowed.' });
  }
  console.error('[UNHANDLED]', err);
  res.status(500).json({
    success: false,
    message: IS_PROD ? 'An unexpected server error occurred.' : err.message
  });
});

/* -------------------------------------------------------- Admin bootstrap */

/**
 * Creates the very first administrator, once, and only when the database has
 * no administrator at all.
 *
 * The previous version hardcoded four email addresses and force-set them to
 * ADMIN + ACTIVE on *every* boot with a known password. That meant demoting
 * someone was undone by the next restart, and anyone who read the repo knew
 * the credentials. Nothing is hardcoded here and existing users are never
 * modified.
 */
async function bootstrapAdmin() {
  try {
    if (await User.exists({ role: 'ADMIN' })) return;

    const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const password = process.env.ADMIN_INITIAL_PASSWORD;

    if (!email || !password) {
      console.warn('[BOOTSTRAP] No administrator exists and ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD are not both set.');
      console.warn('[BOOTSTRAP] Set them once, restart to create the first admin, then remove ADMIN_INITIAL_PASSWORD.');
      return;
    }

    if (password.length < 12) {
      console.error('[BOOTSTRAP] ADMIN_INITIAL_PASSWORD must be at least 12 characters. Skipping.');
      return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      console.warn(`[BOOTSTRAP] ${email} already exists but is not an admin. Promote it from the directory instead.`);
      return;
    }

    await User.create({
      fullName: process.env.ADMIN_NAME || 'Portal Administrator',
      email,
      passwordHash: await bcrypt.hash(password, await bcrypt.genSalt(12)),
      role: 'ADMIN',
      department: 'Core Team',
      position: 'Administrator',
      status: 'ACTIVE'
    });

    console.log(`[BOOTSTRAP] Created the first administrator: ${email}`);
    console.log('[BOOTSTRAP] Sign in, change this password, then delete ADMIN_INITIAL_PASSWORD from your environment.');
  } catch (err) {
    console.error('[BOOTSTRAP] Failed:', err.message);
  }
}

/* --------------------------------------------------------------- Start */

async function start() {
  reportEmailConfig();
  console.log(`[TIME] Calendar dates resolved in ${ZONE}.`);

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('[DATABASE] Connected.');
    await bootstrapAdmin();
  } catch (err) {
    // Starting without a database would serve 500s on every request and make
    // the health check lie, so refuse to start instead.
    console.error(`[FATAL] Could not connect to MongoDB: ${err.message}`);
    console.error('[FATAL] Check MONGODB_URI and that this host is allowed in Atlas → Network Access.');
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`[SERVER] Listening on port ${PORT} (${IS_PROD ? 'production' : 'development'}).`);
  });

  const shutdown = (signal) => {
    console.log(`[SERVER] ${signal} received, shutting down.`);
    server.close(() => mongoose.connection.close(false).finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
