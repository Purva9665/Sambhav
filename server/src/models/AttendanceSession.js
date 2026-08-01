const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  openedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  openedByName: { type: String, required: true },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' }
}, { timestamps: true });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
