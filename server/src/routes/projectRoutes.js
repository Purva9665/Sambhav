const express = require('express');
const router = express.Router();
const { getProjects, createProject, updateProject } = require('../controllers/projectController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/', authenticateToken, getProjects);
router.post('/', authenticateToken, authorizeRoles('ADMIN'), createProject);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), updateProject);

module.exports = router;
