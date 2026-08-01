const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  recipientEmail: { type: String, required: true },
  subject: { type: String, required: true },
  channel: { type: String, default: 'SendGrid' },
  status: { type: String, enum: ['SENT', 'MOCK_LOGGED', 'FAILED'], default: 'SENT' },
  errorDetails: { type: String, default: '' },
  sentAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EmailLog', emailLogSchema);
