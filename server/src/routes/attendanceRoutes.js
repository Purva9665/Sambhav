const express = require('express');
const router = express.Router();
const {
  startSession, markAttendance, getMyAttendance,
  exportAttendance, listSessions, setSessionLock
} = require('../controllers/attendanceController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// --- Marking: administrators only. Nobody else can open a session or record
// a mark, so attendance has a single, accountable source.
router.get('/session', authenticateToken, authorizeRoles('ADMIN'), startSession);
router.post('/mark', authenticateToken, authorizeRoles('ADMIN'), markAttendance);

// --- Locking a day so its marks can no longer be changed: admin only.
router.get('/sessions', authenticateToken, authorizeRoles('ADMIN'), listSessions);
router.put('/sessions/:id/close', authenticateToken, authorizeRoles('ADMIN'), setSessionLock);

// --- Reading. Open to every signed-in user, but each only ever receives what
// their role permits: own records, own team, or the organisation.
router.get('/my-records', authenticateToken, getMyAttendance);
router.get('/export', authenticateToken, exportAttendance);

module.exports = router;
