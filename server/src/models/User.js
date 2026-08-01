const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['ADMIN', 'TEAM_HEAD', 'TEAM_MEMBER'], 
    default: 'TEAM_MEMBER' 
  },
  department: { type: String, required: true, default: 'General' },
  mobileNumber: { type: String, default: '' },
  position: { type: String, default: 'Member' },
  status: { 
    type: String, 
    enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'], 
    default: 'PENDING_VERIFICATION' 
  },
  otpCode: { type: String, default: null },
  otpExpiresAt: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
  lastLoginIp: { type: String, default: '' },
  lastLoginUserAgent: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
