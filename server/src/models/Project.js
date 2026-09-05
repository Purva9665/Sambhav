const mongoose = require('mongoose');
const { PROJECT_STATUSES } = require('../constants');

/**
 * A project carries a list of members, the same shape a task uses for its
 * assignees. `teams` is derived from those members at save time so a team's
 * projects can be found without a join, and is recomputed whenever the member
 * list changes — never set by hand.
 */
const memberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  team: { type: String, default: '' }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  projectName: { type: String, required: true, trim: true },
  description: { type: String, required: true },

  members: {
    type: [memberSchema],
    required: true,
    validate: {
      validator: (v) => Array.isArray(v) && v.length > 0,
      message: 'A project needs at least one member.'
    }
  },

  /** Distinct teams the members belong to. Derived. */
  teams: { type: [String], default: [] },

  status: { type: String, enum: PROJECT_STATUSES, default: 'PLANNED' },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  deadline: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, default: '' }
}, { timestamps: true });

projectSchema.pre('save', function (next) {
  if (this.isModified('members')) {
    this.teams = [...new Set(this.members.map(m => m.team).filter(Boolean))];
  }
  if (this.isModified('status')) {
    this.completedAt = this.status === 'COMPLETED' ? new Date() : null;
  }
  next();
});

/** Is this user on the project? */
projectSchema.methods.hasMember = function (userId) {
  return this.members.some(m => String(m.userId) === String(userId));
};

projectSchema.index({ 'members.userId': 1, status: 1 });
projectSchema.index({ teams: 1, deadline: 1 });

module.exports = mongoose.model('Project', projectSchema);
