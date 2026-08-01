const { logAuditEvent } = require('../utils/auditHelper');

/**
 * Middleware factory to enforce strictly allowed roles for endpoints
 * Usage: authorizeRoles('ADMIN'), authorizeRoles('ADMIN', 'TEAM_HEAD')
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated request.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Audit log the unauthorized access attempt
      logAuditEvent({
        action: 'DIRECTORY_ACCESSED', // or unauthorized access flag
        req,
        actorUser: req.user,
        targetResource: req.originalUrl,
        details: { blocked: true, requiredRoles: allowedRoles, userRole: req.user.role }
      });

      return res.status(403).json({ 
        success: false, 
        message: `Forbidden: Action requires one of the following roles: [${allowedRoles.join(', ')}].` 
      });
    }

    next();
  };
};

module.exports = { authorizeRoles };
