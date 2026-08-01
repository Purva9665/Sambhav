require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const leaveRoutes = require('./routes/leaveRoutes');

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many authentication attempts. Please try again after 15 minutes.' }
});

app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// API Routes Mounting
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/announcements', announcementRoutes);
app.use('/api/v1/leave', leaveRoutes);

// Health Check Endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    system: 'SAMBHAV Security Portal API',
    timestamp: new Date().toISOString()
  });
});

/**
 * Seed & Sync All Admin Credentials in MongoDB
 */
async function seedDefaultAdmin() {
  try {
    const adminEmails = [
      'purvakadam9665@gmail.com',
      'purvakadam9637@gmail.com',
      'admin@sambhav.org',
      (process.env.ADMIN_EMAIL || '').toLowerCase()
    ].filter(Boolean);

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('Admin@123456', salt);

    for (const email of adminEmails) {
      let adminUser = await User.findOne({ email: email.toLowerCase() });

      if (!adminUser) {
        await User.create({
          fullName: 'Purva Kadam (Admin)',
          email: email.toLowerCase(),
          passwordHash,
          role: 'ADMIN',
          department: 'Management',
          position: 'System Administrator',
          status: 'ACTIVE'
        });
        console.log(`[SEED] Created Admin: ${email}`);
      } else {
        adminUser.role = 'ADMIN';
        adminUser.status = 'ACTIVE';
        await adminUser.save();
        console.log(`[SEED] Promoted/Synced Admin Role: ${email}`);
      }
    }
  } catch (err) {
    console.error('[SEED ERROR] Could not seed default admin:', err.message);
  }
}

// Database Connection & Server Listener
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sambhav_db';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log(`[DATABASE] Connected to MongoDB at ${MONGODB_URI}`);
    await seedDefaultAdmin();
    app.listen(PORT, () => {
      console.log(`[SERVER] SAMBHAV Backend running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.warn(`[DATABASE WARNING] Could not connect to MongoDB (${err.message}). Starting server...`);
    app.listen(PORT, () => {
      console.log(`[SERVER] SAMBHAV Backend running on port ${PORT}`);
    });
  });
