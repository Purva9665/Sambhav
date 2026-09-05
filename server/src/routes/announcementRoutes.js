const express = require('express');
const router = express.Router();
const {
  getMyAnnouncements, createAnnouncement, setAnnouncementVisibility, deleteAnnouncement
} = require('../controllers/announcementController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

router.get('/', authenticateToken, getMyAnnouncements);
router.post('/', authenticateToken, authorizeRoles('ADMIN'), createAnnouncement);

// Take off the banner without deleting; { republish: true } puts it back
router.put('/:id/unpublish', authenticateToken, authorizeRoles('ADMIN'), setAnnouncementVisibility);

// Remove permanently
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), deleteAnnouncement);

module.exports = router;
