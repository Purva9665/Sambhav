const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');
const { logAuditEvent } = require('../utils/auditHelper');

const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 6;
const MIN_PASSWORD = 8;

const generateCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

const codeEmail = ({ name, code, reason }) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;border:1px solid #E2E5EA">
    <div style="background:#0E1524;padding:20px 24px">
      <div style="color:#fff;font-size:18px;font-weight:700;letter-spacing:2px">SAMBHAV</div>
      <div style="color:#8A929F;font-size:11px;letter-spacing:3px;margin-top:2px">PORTAL</div>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 10px;font-size:17px;color:#14181F">${reason}</h2>
      <p style="color:#59616E;font-size:14px;line-height:1.6;margin:0 0 18px">
        Hi ${name}, use this code to confirm the change. It expires in ${CODE_TTL_MIN} minutes.
      </p>
      <div style="background:#0E1524;padding:18px;text-align:center;margin:18px 0">
        <div style="color:#8A929F;font-size:11px;letter-spacing:2px;margin-bottom:6px">CONFIRMATION CODE</div>
        <div style="color:#2EA8FF;font-size:30px;font-weight:800;letter-spacing:10px">${code}</div>
      </div>
      <p style="color:#8A929F;font-size:12px;margin:0">
        If you did not request this, ignore this email — your password stays unchanged.
      </p>
    </div>
  </div>
`;

/** Constant-time compare so a code cannot be guessed by timing. */
function codeMatches(supplied, expected) {
  if (!expected) return false;
  const a = Buffer.from(String(supplied).trim());
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function issueCode(user, reason) {
  const code = generateCode();
  user.resetCode = code;
  user.resetExpiresAt = new Date(Date.now() + CODE_TTL_MIN * 60 * 1000);
  user.resetAttempts = 0;
  await user.save();

  return sendEmail({
    to: user.email,
    subject: `[SAMBHAV] Your confirmation code: ${code}`,
    htmlText: codeEmail({ name: user.fullName, code, reason })
  });
}

// ------------------------------------------------- 1. Signed in: send a code

const requestChangeCode = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });

    const delivery = await issueCode(user, 'Confirm your password change');

    return res.status(200).json({
      success: true,
      emailDelivered: delivery.delivered,
      sentTo: user.email,
      message: delivery.delivered
        ? `We sent a 6-digit code to ${user.email}.`
        : 'The confirmation email could not be delivered. Contact your administrator.'
    });
  } catch (err) {
    console.error('[PASSWORD CODE ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not send a confirmation code.' });
  }
};

// -------------------------------------------- 2. Signed in: change password

const changePassword = async (req, res) => {
  try {
    const { currentPassword, code, newPassword } = req.body;

    if (!currentPassword || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, confirmation code and new password are all required.'
      });
    }

    if (String(newPassword).length < MIN_PASSWORD) {
      return res.status(400).json({
        success: false,
        message: `New password must be at least ${MIN_PASSWORD} characters.`
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      await logAuditEvent({
        action: 'PASSWORD_CHANGE_FAILED',
        req,
        actorUser: user,
        details: { reason: 'WRONG_CURRENT_PASSWORD' }
      });
      return res.status(401).json({ success: false, message: 'Your current password is not correct.' });
    }

    if (user.resetAttempts >= MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect codes. Request a new one.'
      });
    }

    if (!user.resetExpiresAt || Date.now() > user.resetExpiresAt.getTime()) {
      return res.status(400).json({ success: false, message: 'That code has expired. Request a new one.' });
    }

    if (!codeMatches(code, user.resetCode)) {
      user.resetAttempts += 1;
      await user.save();
      return res.status(400).json({ success: false, message: 'That code is not correct.' });
    }

    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return res.status(400).json({
        success: false,
        message: 'Your new password must be different from the current one.'
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, await bcrypt.genSalt(12));
    user.resetCode = null;
    user.resetExpiresAt = null;
    user.resetAttempts = 0;
    user.passwordChangedAt = new Date();
    await user.save();

    await logAuditEvent({
      action: 'PASSWORD_CHANGED',
      req,
      actorUser: user,
      targetResource: `User:${user._id}`,
      details: { self: true }
    });

    return res.status(200).json({
      success: true,
      message: 'Password changed. Use it the next time you sign in.'
    });
  } catch (err) {
    console.error('[PASSWORD CHANGE ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not change your password.' });
  }
};

// ------------------------------------------ 3. Signed out: forgot password

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    // Always the same answer, so this cannot be used to discover which
    // addresses have accounts.
    const generic = {
      success: true,
      message: 'If that address has an account, a reset code is on its way.'
    };

    if (!user || user.status === 'SUSPENDED') return res.status(200).json(generic);

    await issueCode(user, 'Reset your password');
    return res.status(200).json(generic);
  } catch (err) {
    console.error('[FORGOT PASSWORD ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not start a password reset.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, code and new password are required.' });
    }

    if (String(newPassword).length < MIN_PASSWORD) {
      return res.status(400).json({
        success: false,
        message: `New password must be at least ${MIN_PASSWORD} characters.`
      });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    const generic = { success: false, message: 'That code is invalid or has expired.' };

    if (!user || !user.resetCode) return res.status(400).json(generic);

    if (user.resetAttempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many incorrect codes. Start again.' });
    }

    if (!user.resetExpiresAt || Date.now() > user.resetExpiresAt.getTime()) {
      return res.status(400).json(generic);
    }

    if (!codeMatches(code, user.resetCode)) {
      user.resetAttempts += 1;
      await user.save();
      return res.status(400).json(generic);
    }

    user.passwordHash = await bcrypt.hash(newPassword, await bcrypt.genSalt(12));
    user.resetCode = null;
    user.resetExpiresAt = null;
    user.resetAttempts = 0;
    user.passwordChangedAt = new Date();

    // A verified reset also proves the address, so activate a pending account.
    if (user.status === 'PENDING_VERIFICATION') user.status = 'ACTIVE';

    await user.save();

    await logAuditEvent({
      action: 'PASSWORD_CHANGED',
      req,
      actorUser: user,
      targetResource: `User:${user._id}`,
      details: { viaReset: true }
    });

    return res.status(200).json({ success: true, message: 'Password reset. You can sign in now.' });
  } catch (err) {
    console.error('[RESET PASSWORD ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not reset your password.' });
  }
};

module.exports = { requestChangeCode, changePassword, forgotPassword, resetPassword };
