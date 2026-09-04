const { logAuditEvent } = require('../utils/auditHelper');

/**
 * Restricts a route to the given roles.
 * Usage: authorizeRoles('ADMIN'), authorizeRoles('ADMIN', 'TEAM_HEAD')
 */
const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthenticated request.' });
  }

  if (!allowedRoles.includes(req.user.role)) {
    // Logged as ACCESS_DENIED. This previously reused DIRECTORY_ACCESSED, so
    // blocked attempts were indistinguishable from legitimate directory reads.
    logAuditEvent({
      action: 'ACCESS_DENIED',
      req,
      actorUser: req.user,
      targetResource: `${req.method} ${req.originalUrl}`,
      details: { requiredRoles: allowedRoles, actualRole: req.user.role }
    });

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action.'
    });
  }

  next();
};

module.exports = { authorizeRoles };
