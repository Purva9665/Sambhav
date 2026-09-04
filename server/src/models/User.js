const mongoose = require('mongoose');
const { ROLES, STATUSES } = require('../constants');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },

  role: { type: String, enum: ROLES, default: 'TEAM_MEMBER' },

  /** Club team — PR Team, Event Team, Core Team, … */
  department: { type: String, required: true, default: 'Core Team' },

  /**
   * Academic department headed by this person, if any — a separate axis from
   * the club team. Someone can be in PR Team and head the IT department.
   * Empty for everyone who does not head a department.
   */
  academicDepartment: { type: String, default: '' },

  mobileNumber: { type: String, default: '' },
  position: { type: String, default: 'Member' },

  status: { type: String, enum: STATUSES, default: 'PENDING_VERIFICATION' },

  /** Registration verification (admin-gated). */
  otpCode: { type: String, default: null },
  otpExpiresAt: { type: Date, default: null },
  otpAttempts: { type: Number, default: 0 },

  /** Password reset / change verification — sent to the user's own email. */
  resetCode: { type: String, default: null },
  resetExpiresAt: { type: Date, default: null },
  resetAttempts: { type: Number, default: 0 },

  passwordChangedAt: { type: Date, default: null },

  lastLoginAt: { type: Date, default: null },
  lastLoginIp: { type: String, default: '' },
  lastLoginUserAgent: { type: String, default: '' }
}, { timestamps: true });

// Directory and department-head lookups both filter on these
userSchema.index({ role: 1, status: 1 });
userSchema.index({ academicDepartment: 1 });

module.exports = mongoose.model('User', userSchema);
