const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');
const { logAuditEvent } = require('../utils/auditHelper');

// Start / Get Today's Attendance Session (ADMIN ONLY to start)
const startSession = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    let session = await AttendanceSession.findOne({ date: todayStr });

    if (!session) {
      session = await AttendanceSession.create({
        date: todayStr,
        openedByUserId: req.user._id,
        openedByName: req.user.fullName,
        status: 'OPEN'
      });
    }

    // Get active users to populate checklist
    const users = await User.find({ status: 'ACTIVE' }).select('fullName role department');
    const existingRecords = await AttendanceRecord.find({ sessionId: session._id });

    return res.status(200).json({
      success: true,
      session,
      users,
      records: existingRecords
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to start or retrieve attendance session.' });
  }
};

// Mark Attendance Checkbox List (ADMIN ONLY)
const markAttendance = async (req, res) => {
  try {
    const { sessionId, records } = req.body; // Array of { userId, status: 'PRESENT' | 'ABSENT' }

    if (!sessionId || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'Session ID and records array are required.' });
    }

    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Attendance session not found.' });
    }

    // Bulk upsert records
    for (const item of records) {
      const targetUser = await User.findById(item.userId);
      if (targetUser) {
        await AttendanceRecord.findOneAndUpdate(
          { sessionId: session._id, userId: targetUser._id },
          {
            sessionId: session._id,
            userId: targetUser._id,
            userName: targetUser.fullName,
            userRole: targetUser.role,
            department: targetUser.department,
            status: item.status,
            markedByUserId: req.user._id,
            timestamp: new Date()
          },
          { upsert: true, new: true }
        );
      }
    }

    await logAuditEvent({
      action: 'ATTENDANCE_MARKED',
      req,
      actorUser: req.user,
      targetResource: `AttendanceSession:${session._id}`,
      details: { totalRecordsMarked: records.length, date: session.date }
    });

    return res.status(200).json({ success: true, message: 'Attendance marked successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to mark attendance.' });
  }
};

// Get Personal Attendance Records (Any user gets their own; Admin gets all)
const getMyAttendance = async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'ADMIN') {
      query.userId = req.user._id;
    }

    const records = await AttendanceRecord.find(query)
      .populate('sessionId', 'date')
      .sort({ timestamp: -1 });

    const totalDays = records.length;
    const presentDays = records.filter(r => r.status === 'PRESENT').length;
    const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

    return res.status(200).json({
      success: true,
      stats: { totalDays, presentDays, absentDays: totalDays - presentDays, percentage },
      records
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch attendance records.' });
  }
};

module.exports = { startSession, markAttendance, getMyAttendance };
