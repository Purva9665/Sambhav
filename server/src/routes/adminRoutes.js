const express = require('express');
const router = express.Router();
const {
  createUser, getMemberList, getTeamDirectory,
  getAuditLogs, clearAuditLogs, updateUserRole
} = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// Roster: admins, department heads and team heads
router.get('/members', authenticateToken,
  authorizeRoles('ADMIN', 'DEPARTMENT_HEAD', 'TEAM_HEAD'), getMemberList);

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

module.exports = router;
