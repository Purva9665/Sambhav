const express = require('express');
const router = express.Router();
const { getLeaveRequests, applyLeave, reviewLeave } = require('../controllers/leaveController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/', authenticateToken, getLeaveRequests);
router.post('/', authenticateToken, applyLeave);
router.put('/:id/review', authenticateToken, authorizeRoles('ADMIN'), reviewLeave);

module.exports = router;
