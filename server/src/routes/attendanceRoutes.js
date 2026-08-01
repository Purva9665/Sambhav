const express = require('express');
const router = express.Router();
const { startSession, markAttendance, getMyAttendance } = require('../controllers/attendanceController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/session', authenticateToken, authorizeRoles('ADMIN'), startSession);
router.post('/mark', authenticateToken, authorizeRoles('ADMIN'), markAttendance);
router.get('/my-records', authenticateToken, getMyAttendance);

module.exports = router;
