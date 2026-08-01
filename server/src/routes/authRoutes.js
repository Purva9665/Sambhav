const express = require('express');
const router = express.Router();
const { register, verifyOtp, login, getMe } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);

module.exports = router;
