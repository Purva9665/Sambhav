const mongoose = require('mongoose');

/** Retention window. Entries older than this are removed by MongoDB itself. */
const RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS) || 90;

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'REGISTER_REQUEST',
      'OTP_VERIFIED',
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'ROLE_CHANGE',
      'PROJECT_CREATED',
      'PROJECT_UPDATED',
      'TASK_ASSIGNED',
      'TASK_STATUS_UPDATED',
      'ATTENDANCE_MARKED',
      'ANNOUNCEMENT_POSTED',
      'DIRECTORY_ACCESSED',
      'LEAVE_SUBMITTED',
      'LEAVE_REVIEWED',
      'ACCESS_DENIED',
      'PASSWORD_CHANGED',
      'PASSWORD_CHANGE_FAILED',
      'ADMIN_GRANTED',
      'ADMIN_REVOKED',
      'USER_CREATED',
      'AUDIT_LOGS_CLEARED',
      'PROFILE_CHANGE_REQUESTED',
      'PROFILE_CHANGE_APPROVED',
      'PROFILE_CHANGE_REJECTED'
    ]
  },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorEmail: { type: String, required: true },
  actorRole: { type: String, default: 'UNKNOWN' },
  targetResource: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now }
});

/**
 * MongoDB deletes expired entries itself, roughly once a minute, so the
 * collection cannot grow without bound and nothing has to be scheduled.
 * Set AUDIT_RETENTION_DAYS to change the window; export first with
 * `node scripts/auditLogs.cjs archive` if you need to keep the history.
 */
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: RETENTION_DAYS * 86400 });

// The audit page filters by action and sorts newest first
auditLogSchema.index({ action: 1, timestamp: -1 });

/**
 * An existing TTL index keeps its original window — Mongo will not silently
 * change it — so bring it in line when the setting differs.
 */
auditLogSchema.statics.syncRetention = async function () {
  const wanted = RETENTION_DAYS * 86400;
  try {
    const indexes = await this.collection.indexes();
    const ttl = indexes.find(i => i.expireAfterSeconds !== undefined && i.key?.timestamp === 1);

    if (ttl && ttl.expireAfterSeconds !== wanted) {
      await this.db.command({
        collMod: this.collection.collectionName,
        index: { name: ttl.name, expireAfterSeconds: wanted }
      });
      console.log(`[AUDIT] Retention updated to ${RETENTION_DAYS} days.`);
    } else {
      console.log(`[AUDIT] Entries older than ${RETENTION_DAYS} days are removed automatically.`);
    }
  } catch (err) {
    console.warn('[AUDIT] Could not verify the retention index:', err.message);
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
