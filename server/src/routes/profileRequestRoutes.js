const express = require('express');
const router = express.Router();
const {
  createRequest, listRequests, reviewRequest, withdrawRequest
} = require('../controllers/profileRequestController');
const { authenticateToken } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');

// File a request to change your own profile (everyone except admins,
// who edit theirs directly)
router.post('/', authenticateToken, createRequest);

// Admins see all requests; everyone else sees only their own
router.get('/', authenticateToken, listRequests);

// Take back your own pending request
router.put('/:id/withdraw', authenticateToken, withdrawRequest);

// Approve or reject: admin only
router.put('/:id/review', authenticateToken, authorizeRoles('ADMIN'), reviewRequest);

module.exports = router;
