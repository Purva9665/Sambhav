const express = require('express');
const router = express.Router();
const { getTasks, createTask, updateTaskStatus, deleteTask } = require('../controllers/taskController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/', authenticateToken, getTasks);
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'TEAM_HEAD'), createTask);
router.put('/:id/status', authenticateToken, updateTaskStatus);

// Remove a task: admins, and team heads within their own team
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN', 'TEAM_HEAD'), deleteTask);

module.exports = router;