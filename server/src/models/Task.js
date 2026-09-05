const mongoose = require('mongoose');
const { TASK_PRIORITIES, TASK_STATUSES } = require('../constants');

/**
 * A task is shared: it carries a list of assignees rather than a single owner.
 * One card, several people, one status — when it is done, it is done for
 * everyone on it. That suits shared work ("run the registration desk") and is
 * why completing it counts once toward project progress.
 *
 * `teams` is derived from the assignees at save time. It exists so a team head
 * can be shown their team's tasks without a join, and is recomputed whenever
 * the assignee list changes.
 */
const assigneeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  team: { type: String, default: '' }
}, { _id: false });

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },

  assignees: {
    type: [assigneeSchema],
    required: true,
    validate: {
      validator: (v) => Array.isArray(v) && v.length > 0,
      message: 'A task needs at least one assignee.'
    }
  },

  /** Distinct teams the assignees belong to. Derived — never set by hand. */
  teams: { type: [String], default: [] },

  assignedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedByName: { type: String, required: true },

  priority: { type: String, enum: TASK_PRIORITIES, default: 'MEDIUM' },
  status: { type: String, enum: TASK_STATUSES, default: 'PENDING' },

  dueDate: { type: Date, required: true },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

// Keep `teams` in step with the assignee list on every write.
taskSchema.pre('save', function (next) {
  if (this.isModified('assignees')) {
    this.teams = [...new Set(this.assignees.map(a => a.team).filter(Boolean))];
  }
  if (this.isModified('status')) {
    this.completedAt = this.status === 'COMPLETED' ? new Date() : null;
  }
  next();
});

/** Is this user one of the people the task is assigned to? */
taskSchema.methods.hasAssignee = function (userId) {
  return this.assignees.some(a => String(a.userId) === String(userId));
};

taskSchema.index({ 'assignees.userId': 1, status: 1 });
taskSchema.index({ teams: 1, dueDate: 1 });
taskSchema.index({ projectId: 1 });

module.exports = mongoose.model('Task', taskSchema);
