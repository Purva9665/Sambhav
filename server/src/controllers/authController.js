const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');
const { logAuditEvent } = require('../utils/auditHelper');
const { TEAMS, ACADEMIC_DEPARTMENTS, SELF_ASSIGNABLE_ROLES } = require('../constants');

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '8h';
const OTP_TTL_MIN = 15;
const MAX_OTP_ATTEMPTS = 6;

const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );

const publicUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  department: user.department,
  academicDepartment: user.academicDepartment || '',
  mobileNumber: user.mobileNumber,
  position: user.position,
  status: user.status
});

/** Cryptographically random 6-digit code (Math.random is not suitable here). */
const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

// ---------------------------------------------------------------- REGISTER

const register = async (req, res) => {
  try {
    const {
      fullName, email, password, role, department,
      academicDepartment, mobileNumber, position
    } = req.body;

    if (!fullName || !email || !password || !department) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, password and department are required.'
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters.'
      });
    }

    const normalisedEmail = String(email).toLowerCase().trim();

    const existing = await User.findOne({ email: normalisedEmail });

    // An account that was never verified is not really an account: it holds
    // the address hostage, so nobody could re-register after an OTP expired
    // and the only fix was deleting the row by hand. Registering again simply
    // replaces it with the new details and a fresh code.
    if (existing && existing.status === 'PENDING_VERIFICATION') {
      await existing.deleteOne();
    } else if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(12));
    const otpCode = generateOtp();

    // A registrant may only ever request a non-privileged role. ADMIN is
    // granted deliberately from the directory, never by self-registration.
    const requestedRole = SELF_ASSIGNABLE_ROLES.includes(role) ? role : 'TEAM_MEMBER';

    if (!TEAMS.includes(department)) {
      return res.status(400).json({ success: false, message: 'Unknown team.' });
    }

    // Only meaningful for a department head, and must be a known department.
    const academic =
      requestedRole === 'DEPARTMENT_HEAD' && ACADEMIC_DEPARTMENTS.includes(academicDepartment)
        ? academicDepartment
        : '';

    if (requestedRole === 'DEPARTMENT_HEAD' && !academic) {
      return res.status(400).json({
        success: false,
        message: 'Select which academic department you head.'
      });
    }

    const newUser = await User.create({
      fullName,
      email: normalisedEmail,
      passwordHash,
      role: requestedRole,
      department,
      academicDepartment: academic,
      mobileNumber: mobileNumber || '',
      position: position || 'Member',
      status: 'PENDING_VERIFICATION',
      otpCode,
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MIN * 60 * 1000),
      otpAttempts: 0
    });

    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
    const ipAddress = req.ip;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;border:1px solid #E2E5EA">
        <div style="background:#0E1524;padding:20px 24px">
          <div style="color:#fff;font-size:18px;font-weight:700;letter-spacing:2px">SAMBHAV</div>
          <div style="color:#8A929F;font-size:11px;letter-spacing:3px;margin-top:2px">PORTAL</div>
        </div>
        <div style="padding:24px">
          <h2 style="margin:0 0 12px;font-size:18px;color:#14181F">New registration request</h2>
          <p style="color:#59616E;font-size:14px;line-height:1.6;margin:0 0 18px">
            Someone requested access to the SAMBHAV portal. Share the code below with them
            only after you have confirmed who they are.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;color:#14181F">
            <tr><td style="padding:5px 0;color:#8A929F">Name</td><td style="padding:5px 0"><strong>${fullName}</strong></td></tr>
            <tr><td style="padding:5px 0;color:#8A929F">Email</td><td style="padding:5px 0">${normalisedEmail}</td></tr>
            <tr><td style="padding:5px 0;color:#8A929F">Role</td><td style="padding:5px 0">${requestedRole}</td></tr>
            <tr><td style="padding:5px 0;color:#8A929F">Department</td><td style="padding:5px 0">${department}</td></tr>
            <tr><td style="padding:5px 0;color:#8A929F">IP</td><td style="padding:5px 0">${ipAddress}</td></tr>
            <tr><td style="padding:5px 0;color:#8A929F">Time</td><td style="padding:5px 0">${new Date().toISOString()}</td></tr>
          </table>
          <div style="background:#0E1524;padding:20px;text-align:center;margin:22px 0">
            <div style="color:#8A929F;font-size:11px;letter-spacing:2px;margin-bottom:6px">VERIFICATION CODE</div>
            <div style="color:#2EA8FF;font-size:32px;font-weight:800;letter-spacing:10px">${otpCode}</div>
          </div>
          <p style="color:#8A929F;font-size:12px;margin:0">
            This code expires in ${OTP_TTL_MIN} minutes. If you did not expect this request, ignore this email
            and the account will stay inactive.
          </p>
        </div>
      </div>
    `;

    const delivery = adminEmail
      ? await sendEmail({
          to: adminEmail,
          subject: `[SAMBHAV] Access request from ${fullName}`,
          htmlText: html
        })
      : { delivered: false, mode: 'LOGGED', error: 'ADMIN_EMAIL is not set' };

    await logAuditEvent({
      action: 'REGISTER_REQUEST',
      req,
      actorUser: newUser,
      targetResource: `User:${newUser._id}`,
      details: {
        fullName,
        email: normalisedEmail,
        requestedRole,
        department,
        otpDelivered: delivery.delivered
      }
    });

    // Report delivery honestly. The code itself is never returned — the old
    // `devOtp` field let anyone self-activate straight from the response body.
    return res.status(201).json({
      success: true,
      emailDelivered: delivery.delivered,
      message: delivery.delivered
        ? 'Request submitted. Your administrator has been sent a verification code — ask them for it to activate your account.'
        : 'Request submitted, but the verification email could not be delivered. Please contact your administrator directly to obtain your code.'
    });
  } catch (err) {
    console.error('[REGISTER ERROR]', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// -------------------------------------------------------------- VERIFY OTP

const verifyOtp = async (req, res) => {
  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({ success: false, message: 'Email and code are required.' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    // Same response whether or not the account exists, so this cannot be used
    // to enumerate registered emails.
    const generic = { success: false, message: 'Invalid or expired code.' };

    if (!user || user.status === 'ACTIVE' || !user.otpCode) {
      return res.status(400).json(generic);
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Ask your administrator to reissue a code.'
      });
    }

    if (user.otpExpiresAt && Date.now() > user.otpExpiresAt.getTime()) {
      return res.status(400).json(generic);
    }

    // Constant-time compare so the code cannot be guessed by timing
    const supplied = Buffer.from(String(otpCode).trim());
    const expected = Buffer.from(user.otpCode);
    const valid = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);

    if (!valid) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();

      await logAuditEvent({
        action: 'LOGIN_FAILED',
        req,
        actorUser: user,
        details: { reason: 'INVALID_REGISTRATION_OTP', attempt: user.otpAttempts }
      });

      return res.status(400).json(generic);
    }

    user.status = 'ACTIVE';
    user.otpCode = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    await user.save();

    await logAuditEvent({
      action: 'OTP_VERIFIED',
      req,
      actorUser: user,
      targetResource: `User:${user._id}`,
      details: { statusUpdatedTo: 'ACTIVE' }
    });

    return res.status(200).json({
      success: true,
      message: 'Account activated.',
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (err) {
    console.error('[VERIFY OTP ERROR]', err);
    return res.status(500).json({ success: false, message: 'Server error during verification.' });
  }
};

// ------------------------------------------------------------------- LOGIN

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    if (!user) {
      // Hash anyway so a missing account is not detectably faster than a wrong password
      await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid');
      await logAuditEvent({ action: 'LOGIN_FAILED', req, actorUser: null, details: { email, reason: 'USER_NOT_FOUND' } });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      await logAuditEvent({ action: 'LOGIN_FAILED', req, actorUser: user, details: { reason: 'INVALID_PASSWORD' } });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: user.status === 'PENDING_VERIFICATION'
          ? 'Your account is awaiting verification. Ask your administrator for your code.'
          : 'This account is suspended. Contact your administrator.'
      });
    }

    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    user.lastLoginUserAgent = req.headers['user-agent'] || '';
    await user.save();

    await logAuditEvent({
      action: 'LOGIN_SUCCESS',
      req,
      actorUser: user,
      details: { role: user.role }
    });

    return res.status(200).json({
      success: true,
      message: 'Signed in.',
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    return res.status(500).json({ success: false, message: 'Server error during sign in.' });
  }
};

// --------------------------------------------------------------------- ME

const getMe = async (req, res) =>
  res.status(200).json({ success: true, user: publicUser(req.user) });

module.exports = { register, verifyOtp, login, getMe };
