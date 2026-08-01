const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  projectName: { type: String, required: true, trim: true },
  assignedTeam: { type: String, required: true },
  description: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'], 
    default: 'PLANNED' 
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  deadline: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
