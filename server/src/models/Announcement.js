const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  channels: { 
    type: [String], 
    enum: ['BANNER', 'EMAIL'], 
    default: ['BANNER'] 
  },
  audienceType: { 
    type: String, 
    enum: ['ALL', 'DEPARTMENT', 'HEADS', 'INDIVIDUALS'], 
    default: 'ALL' 
  },
  audienceTargets: { type: [String], default: [] }, // Array of dept names or user IDs
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
