const express = require('express');
const router = express.Router();
const { register, verifyOtp, login, getMe } = require('../controllers/authController');
const {
  requestChangeCode, changePassword, forgotPassword, resetPassword
} = require('../controllers/passwordController');
const { authenticateToken } = require('../middleware/auth');

router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);

// Password change while signed in — confirmed by a code emailed to the user
router.post('/password/request-code', authenticateToken, requestChangeCode);
router.post('/password/change', authenticateToken, changePassword);

// Password reset while signed out
router.post('/password/forgot', forgotPassword);
router.post('/password/reset', resetPassword);

module.exports = router;
