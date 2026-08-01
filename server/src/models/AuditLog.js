const mongoose = require('mongoose');

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
      'LEAVE_REVIEWED'
    ]
  },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorEmail: { type: String, required: true },
  actorRole: { type: String, default: 'UNKNOWN' },
  targetResource: { type: String, default: '' },
  ipAddress: { type: String, default: '127.0.0.1' },
  userAgent: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
