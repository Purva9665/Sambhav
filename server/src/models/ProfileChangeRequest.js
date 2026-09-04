const mongoose = require('mongoose');
const { ROLES, TEAMS, ACADEMIC_DEPARTMENTS } = require('../constants');

/**
 * A member asking an administrator to change their own profile.
 *
 * Only admins may edit a profile directly. Everyone else files one of these,
 * and an admin approves or rejects it. `requested` holds only the fields the
 * person actually wants changed; `previous` is snapshotted at review time so
 * the audit trail shows what the change actually did.
 */
const profileChangeRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },

  requested: {
    role: { type: String, enum: [...ROLES, null], default: null },
    department: { type: String, enum: [...TEAMS, null], default: null },
    academicDepartment: { type: String, enum: [...ACADEMIC_DEPARTMENTS, '', null], default: null },
    position: { type: String, default: null },
    mobileNumber: { type: String, default: null }
  },

  /** What the profile looked like when the request was decided. */
  previous: { type: mongoose.Schema.Types.Mixed, default: {} },

  reason: { type: String, default: '' },

  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
    default: 'PENDING',
    index: true
  },

  reviewedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedByName: { type: String, default: '' },
  reviewedAt: { type: Date, default: null },
  reviewNotes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('ProfileChangeRequest', profileChangeRequestSchema);
