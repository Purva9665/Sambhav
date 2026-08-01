const AuditLog = require('../models/AuditLog');

async function logAuditEvent({ action, req, actorUser, targetResource = '', details = {} }) {
  try {
    const ipAddress = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req?.headers['user-agent'] || 'Unknown Agent';

    await AuditLog.create({
      action,
      actorUserId: actorUser?._id || actorUser?.id || null,
      actorEmail: actorUser?.email || req?.body?.email || 'Anonymous',
      actorRole: actorUser?.role || 'GUEST',
      targetResource,
      ipAddress,
      userAgent,
      details,
      timestamp: new Date()
    });
  } catch (err) {
    console.error(`[AUDIT LOG ERROR] Failed to record audit event:`, err.message);
  }
}

module.exports = { logAuditEvent };
