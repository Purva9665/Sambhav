const express = require('express');
const router = express.Router();
const { getMyAnnouncements, createAnnouncement } = require('../controllers/announcementController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/', authenticateToken, getMyAnnouncements);
router.post('/', authenticateToken, authorizeRoles('ADMIN'), createAnnouncement);

module.exports = router;
