const express = require('express');
const router = express.Router();
const {
  getProjects, createProject, updateProject, deleteProject
} = require('../controllers/projectController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/', authenticateToken, getProjects);
router.post('/', authenticateToken, authorizeRoles('ADMIN'), createProject);
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), updateProject);

// Remove a project, once it has no tasks left: admin only
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), deleteProject);

module.exports = router;
