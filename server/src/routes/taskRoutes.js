const express = require('express');
const router = express.Router();
const { getTasks, createTask, updateTaskStatus } = require('../controllers/taskController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/', authenticateToken, getTasks);
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'TEAM_HEAD'), createTask);
router.put('/:id/status', authenticateToken, updateTaskStatus);

module.exports = router;
