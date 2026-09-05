const express = require('express');
const router = express.Router();
const {
  createUser, getMemberList, getTeamDirectory,
  getAuditLogs, clearAuditLogs, updateUserRole, deleteUser
} = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');
const { ROSTER_ROLES } = require('../constants');

// Roster: admins, department heads and team heads
router.get('/members', authenticateToken, authorizeRoles(...ROSTER_ROLES), getMemberList);

// Full directory with contact details: admin only
router.get('/directory', authenticateToken, authorizeRoles('ADMIN'), getTeamDirectory);

// Security audit trail: admin only
router.get('/audit-logs', authenticateToken, authorizeRoles('ADMIN'), getAuditLogs);

// Delete audit entries, optionally only those older than ?days=N: admin only
router.delete('/audit-logs', authenticateToken, authorizeRoles('ADMIN'), clearAuditLogs);

// Create an account directly, any role including ADMIN: admin only
router.post('/users', authenticateToken, authorizeRoles('ADMIN'), createUser);

// Role, status, team, academic department and position changes: admin only.
// This is also how an additional administrator is appointed.
router.put('/users/:userId', authenticateToken, authorizeRoles('ADMIN'), updateUserRole);

// Remove an account and the records tied to it: admin only
router.delete('/users/:userId', authenticateToken, authorizeRoles('ADMIN'), deleteUser);

module.exports = router;
