const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');
const { logAuditEvent } = require('../utils/auditHelper');

// 1. REGISTER (Admin-Gated OTP Dispatch)
const register = async (req, res) => {
  try {
    const { fullName, email, password, role, department, mobileNumber, position } = req.body;

    if (!fullName || !email || !password || !department) {
      return res.status(400).json({ success: false, message: 'Full name, email, password, and department are required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate 6-digit secure numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

    const requestedRole = ['TEAM_HEAD', 'TEAM_MEMBER'].includes(role) ? role : 'TEAM_MEMBER';

    const newUser = await User.create({
      fullName,
      email: email.toLowerCase(),
      passwordHash,
      role: requestedRole,
      department,
      mobileNumber: mobileNumber || '',
      position: position || 'Member',
      status: 'PENDING_VERIFICATION',
      otpCode,
      otpExpiresAt
    });

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';
    const timestamp = new Date().toLocaleString();
    const adminEmail = process.env.ADMIN_EMAIL || 'purvakadam9637@gmail.com';

    // Print bold clear OTP box in terminal for local testing
    console.log(`\n======================================================`);
    console.log(`[SAMBHAV ADMIN OTP DISPATCH]`);
    console.log(`To Admin Email: ${adminEmail}`);
    console.log(`Applicant Name: ${fullName} (${email})`);
    console.log(`Requested Role: ${requestedRole} | Dept: ${department}`);
    console.log(`------------------------------------------------------`);
    console.log(`>>> VERIFICATION OTP CODE: [ ${otpCode} ] <<<`);
    console.log(`======================================================\n`);

    // Send email to ADMIN with applicant details & OTP
    const adminEmailHtml = `
      <div style="font-family: Arial, sans-serif; background: #0A0D14; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #00A3FF;">
        <h2 style="color: #00A3FF; margin-top: 0;">🛡️ SAMBHAV Security Alert: New Registration OTP Request</h2>
        <p>A new user has submitted a registration request on the SAMBHAV Employee Portal.</p>
        
        <div style="background: rgba(255,255,255,0.08); padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Applicant Name:</strong> ${fullName}</p>
          <p><strong>Applicant Email:</strong> ${email}</p>
          <p><strong>Requested Role:</strong> ${requestedRole}</p>
          <p><strong>Department:</strong> ${department}</p>
          <p><strong>Request IP:</strong> ${ipAddress}</p>
          <p><strong>Timestamp:</strong> ${timestamp}</p>
          <p><strong>User Agent:</strong> ${userAgent}</p>
        </div>

        <div style="background: linear-gradient(135deg, #00A3FF, #E5A93C); color: #000; padding: 18px; border-radius: 10px; text-align: center; margin: 20px 0;">
          <span style="font-size: 14px; font-weight: bold; letter-spacing: 1px; display: block;">VERIFICATION OTP CODE</span>
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px;">${otpCode}</span>
        </div>

        <p style="color: #94A3B8; font-size: 13px;">Provide this OTP to the applicant after verifying their identity to complete account activation.</p>
      </div>
    `;

    await sendEmail({
      to: adminEmail,
      subject: `[SAMBHAV ADMIN OTP] Registration Request from ${fullName} (${email})`,
      htmlText: adminEmailHtml
    });

    // Audit log
    await logAuditEvent({
      action: 'REGISTER_REQUEST',
      req,
      actorUser: newUser,
      targetResource: `User:${newUser._id}`,
      details: { fullName, email, requestedRole, department, otpDispatchedTo: adminEmail }
    });

    return res.status(201).json({
      success: true,
      message: `Registration submitted! An Admin Verification OTP has been dispatched to the Admin email (${adminEmail}). Please obtain the OTP from the Admin to activate your account.`,
      email: newUser.email,
      devOtp: otpCode // Included for local dev testing ease
    });
  } catch (err) {
    console.error(`[REGISTER ERROR]`, err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// 2. VERIFY OTP
const verifyOtp = async (req, res) => {
  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({ success: false, message: 'Email and OTP code are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User record not found.' });
    }

    if (user.status === 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Account is already verified and active.' });
    }

    if (user.otpCode !== otpCode.trim()) {
      await logAuditEvent({
        action: 'LOGIN_FAILED',
        req,
        actorUser: user,
        details: { reason: 'INVALID_REGISTRATION_OTP', submittedOtp: otpCode }
      });
      return res.status(400).json({ success: false, message: 'Invalid OTP code provided.' });
    }

    if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
      return res.status(400).json({ success: false, message: 'OTP code has expired. Please request a new registration.' });
    }

    user.status = 'ACTIVE';
    user.otpCode = null;
    user.otpExpiresAt = null;
    await user.save();

    await logAuditEvent({
      action: 'OTP_VERIFIED',
      req,
      actorUser: user,
      targetResource: `User:${user._id}`,
      details: { statusUpdatedTo: 'ACTIVE' }
    });

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET || 'sambhav_jwt_secret_key',
      { expiresIn: '2h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Account verified and activated successfully!',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status
      }
    });
  } catch (err) {
    console.error(`[VERIFY OTP ERROR]`, err);
    return res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
  }
};

// 3. LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      await logAuditEvent({
        action: 'LOGIN_FAILED',
        req,
        actorUser: null,
        details: { email, reason: 'USER_NOT_FOUND' }
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      await logAuditEvent({
        action: 'LOGIN_FAILED',
        req,
        actorUser: user,
        details: { email, reason: 'INVALID_PASSWORD' }
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please complete Admin OTP verification.`
      });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';

    user.lastLoginAt = new Date();
    user.lastLoginIp = ipAddress;
    user.lastLoginUserAgent = userAgent;
    await user.save();

    await logAuditEvent({
      action: 'LOGIN_SUCCESS',
      req,
      actorUser: user,
      details: { fullName: user.fullName, email: user.email, role: user.role }
    });

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET || 'sambhav_jwt_secret_key',
      { expiresIn: '2h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department,
        mobileNumber: user.mobileNumber,
        position: user.position,
        status: user.status
      }
    });
  } catch (err) {
    console.error(`[LOGIN ERROR]`, err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// 4. GET CURRENT USER (ME)
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
};

module.exports = { register, verifyOtp, login, getMe };
