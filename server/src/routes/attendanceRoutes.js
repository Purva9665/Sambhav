const express = require('express');
const router = express.Router();
const {
  startSession, markAttendance, getMyAttendance,
  exportAttendance, listSessions, setSessionLock
} = require('../controllers/attendanceController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// --- Marking: admins and team heads only. A team head is further limited to
// their own team inside the controller, so a crafted request cannot reach
// members of another team.
router.get('/session', authenticateToken, authorizeRoles('ADMIN', 'TEAM_HEAD'), startSession);
router.post('/mark', authenticateToken, authorizeRoles('ADMIN', 'TEAM_HEAD'), markAttendance);

// --- Locking a day so its marks can no longer be changed: admin only.
router.get('/sessions', authenticateToken, authorizeRoles('ADMIN', 'TEAM_HEAD'), listSessions);
router.put('/sessions/:id/close', authenticateToken, authorizeRoles('ADMIN'), setSessionLock);

// --- Reading. Open to every signed-in user, but each only ever receives what
// their role permits: own records, own team, or the organisation.
router.get('/my-records', authenticateToken, getMyAttendance);
router.get('/export', authenticateToken, exportAttendance);

module.exports = router;
