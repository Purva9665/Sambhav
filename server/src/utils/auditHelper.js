const AuditLog = require('../models/AuditLog');

/**
 * Actions that are worth knowing happened, but not worth one row per
 * occurrence. Viewing the directory writes an entry every page load, which was
 * a third of the whole audit trail — noise that buries the events that matter.
 *
 * For these, one entry per actor per window; anything inside the window is
 * folded into that entry's `repeats` counter instead of adding rows.
 */
const COALESCE_WINDOW_MS = {
  DIRECTORY_ACCESSED: 30 * 60 * 1000,   // 30 minutes
  LOGIN_FAILED: 5 * 60 * 1000           // 5 minutes — brute force still shows as a burst
};

async function logAuditEvent({ action, req, actorUser, targetResource = '', details = {} }) {
  try {
    // `req.ip` respects the trust-proxy setting; the raw header is spoofable.
    const ipAddress = req?.ip || req?.socket?.remoteAddress || '';
    const userAgent = String(req?.headers?.['user-agent'] || '').slice(0, 300);
    const actorEmail = actorUser?.email || req?.body?.email || 'anonymous';

    const window = COALESCE_WINDOW_MS[action];

    if (window) {
      const since = new Date(Date.now() - window);
      const existing = await AuditLog.findOne({
        action,
        actorEmail,
        ipAddress,
        timestamp: { $gte: since }
      }).sort({ timestamp: -1 });

      if (existing) {
        // Roll it up rather than adding a row.
        existing.details = {
          ...existing.details,
          repeats: (existing.details?.repeats || 1) + 1,
          lastAt: new Date().toISOString()
        };
        existing.markModified('details');
        await existing.save();
        return;
      }
    }

    await AuditLog.create({
      action,
      actorUserId: actorUser?._id || actorUser?.id || null,
      actorEmail,
      actorRole: actorUser?.role || 'GUEST',
      targetResource,
      ipAddress,
      userAgent,
      details,
      timestamp: new Date()
    });
  } catch (err) {
    // Never let auditing break the request it is describing.
    console.error('[AUDIT] Could not record event:', err.message);
  }
}

module.exports = { logAuditEvent };
