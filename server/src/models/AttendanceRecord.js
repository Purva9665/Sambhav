const mongoose = require('mongoose');

/**
 * One person's attendance for one session.
 *
 * A mark can be corrected, but never silently: every change is appended to
 * `history` with who made it and when, and `editCount` says how many times the
 * value moved. The current value is always `status`; the trail explains it.
 */
const changeSchema = new mongoose.Schema({
  from: { type: String, default: null },
  to: { type: String, required: true },
  byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  byName: { type: String, default: '' },
  at: { type: Date, default: Date.now }
}, { _id: false });

const attendanceRecordSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  userRole: { type: String, required: true },
  department: { type: String, required: true },

  status: { type: String, enum: ['PRESENT', 'ABSENT'], required: true },

  markedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  markedByName: { type: String, default: '' },

  /** Every value this record has held, oldest first. */
  history: { type: [changeSchema], default: [] },
  editCount: { type: Number, default: 0 },

  timestamp: { type: Date, default: Date.now }
});

// One record per person per session — enforced by the database, not just by
// the upsert filter, so a race cannot create duplicates.
attendanceRecordSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

// Range exports and per-person history
attendanceRecordSchema.index({ userId: 1, timestamp: -1 });
attendanceRecordSchema.index({ department: 1, timestamp: -1 });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
