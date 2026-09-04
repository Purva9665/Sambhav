const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verifies the bearer token and loads the current user.
 * JWT_SECRET is required at boot (see server.js), so there is no fallback here
 * — the old `|| 'sambhav_jwt_secret_key'` default meant a misconfigured deploy
 * would accept tokens anyone could forge.
 */
const authenticateToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication token required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const expired = err.name === 'TokenExpiredError';
      return res.status(401).json({
        success: false,
        message: expired ? 'Your session has expired. Please sign in again.' : 'Invalid session token.'
      });
    }

    const user = await User.findById(decoded.id).select('-passwordHash -otpCode');

    if (!user) {
      return res.status(401).json({ success: false, message: 'This session is no longer valid.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: `This account is ${user.status.replace('_', ' ').toLowerCase()}.`
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[AUTH ERROR]', err);
    return res.status(500).json({ success: false, message: 'Authentication failed.' });
  }
};

module.exports = { authenticateToken };
