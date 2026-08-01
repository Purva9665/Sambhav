const express = require('express');
const router = express.Router();
const { getMemberList, getTeamDirectory, getAuditLogs, updateUserRole } = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// Member List: Accessible by ADMIN and TEAM_HEAD
router.get('/members', authenticateToken, authorizeRoles('ADMIN', 'TEAM_HEAD'), getMemberList);

// Team Directory: Restricted STRICTLY to ADMIN
router.get('/directory', authenticateToken, authorizeRoles('ADMIN'), getTeamDirectory);

// Security Audit Logs: Restricted STRICTLY to ADMIN
router.get('/audit-logs', authenticateToken, authorizeRoles('ADMIN'), getAuditLogs);

// Role & Profile Update: Restricted STRICTLY to ADMIN
router.put('/users/:userId', authenticateToken, authorizeRoles('ADMIN'), updateUserRole);

module.exports = router;
