const express = require('express');
const router = express.Router();
const { startSession, markAttendance, getMyAttendance } = require('../controllers/attendanceController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// Team heads may run a session for their own department (enforced in the
// controller); admins may run one for everyone.
router.get('/session', authenticateToken, authorizeRoles('ADMIN', 'TEAM_HEAD'), startSession);
router.post('/mark', authenticateToken, authorizeRoles('ADMIN', 'TEAM_HEAD'), markAttendance);
router.get('/my-records', authenticateToken, getMyAttendance);

module.exports = router;
