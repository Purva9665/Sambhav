const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');
const { logAuditEvent } = require('../utils/auditHelper');
const { localDate } = require('../utils/dates');

/**
 * Open (or fetch) today's session and return the roster to mark.
 * Admins see everyone; team heads see only their own department.
 */
const startSession = async (req, res) => {
  try {
    // Local calendar date, not `toISOString()` — see utils/dates.js
    const today = localDate();

    let session = await AttendanceSession.findOne({ date: today });

    if (!session) {
      session = await AttendanceSession.create({
        date: today,
        openedByUserId: req.user._id,
        openedByName: req.user.fullName,
        status: 'OPEN'
      });
    }

    const rosterFilter = { status: 'ACTIVE' };
    if (req.user.role === 'TEAM_HEAD') rosterFilter.department = req.user.department;

    const users = await User.find(rosterFilter)
      .select('fullName role department')
      .sort({ fullName: 1 });

    const records = await AttendanceRecord.find({
      sessionId: session._id,
      userId: { $in: users.map(u => u._id) }
    });

    return res.status(200).json({ success: true, session, users, records });
  } catch (err) {
    console.error('[ATTENDANCE SESSION ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not open the attendance session.' });
  }
};

/** Save a batch of PRESENT/ABSENT marks for a session. */
const markAttendance = async (req, res) => {
  try {
    const { sessionId, records } = req.body;

    if (!sessionId || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'A session id and at least one record are required.' });
    }

    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Attendance session not found.' });
    }
    if (session.status === 'CLOSED') {
      return res.status(409).json({ success: false, message: 'This session is closed.' });
    }

    if (records.some(r => !['PRESENT', 'ABSENT'].includes(r.status))) {
      return res.status(400).json({ success: false, message: 'Each record must be PRESENT or ABSENT.' });
    }

    const targets = await User.find({
      _id: { $in: records.map(r => r.userId) },
      status: 'ACTIVE'
    }).select('fullName role department');

    const byId = new Map(targets.map(u => [String(u._id), u]));

    // A team head may only mark their own department, even if the client
    // submits other user ids.
    const permitted = records.filter(r => {
      const target = byId.get(String(r.userId));
      if (!target) return false;
      return req.user.role === 'ADMIN' || target.department === req.user.department;
    });

    if (permitted.length === 0) {
      return res.status(403).json({ success: false, message: 'None of these members are yours to mark.' });
    }

    await AttendanceRecord.bulkWrite(
      permitted.map(r => {
        const target = byId.get(String(r.userId));
        return {
          updateOne: {
            filter: { sessionId: session._id, userId: target._id },
            update: {
              $set: {
                sessionId: session._id,
                userId: target._id,
                userName: target.fullName,
                userRole: target.role,
                department: target.department,
                status: r.status,
                markedByUserId: req.user._id,
                timestamp: new Date()
              }
            },
            upsert: true
          }
        };
      })
    );

    await logAuditEvent({
      action: 'ATTENDANCE_MARKED',
      req,
      actorUser: req.user,
      targetResource: `AttendanceSession:${session._id}`,
      details: { date: session.date, marked: permitted.length, skipped: records.length - permitted.length }
    });

    return res.status(200).json({
      success: true,
      message: `Attendance saved for ${permitted.length} member${permitted.length === 1 ? '' : 's'}.`,
      marked: permitted.length
    });
  } catch (err) {
    console.error('[ATTENDANCE MARK ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not save attendance.' });
  }
};

/**
 * Attendance records with the stats for them.
 * Admins get the whole organisation, team heads their department, members
 * their own. `scope` tells the client which it received so the UI can label
 * the numbers honestly instead of calling org-wide figures "your rate".
 */
const getMyAttendance = async (req, res) => {
  try {
    let query = {};
    let scope = 'SELF';

    if (req.user.role === 'ADMIN') {
      scope = 'ORGANISATION';
    } else if (req.user.role === 'TEAM_HEAD') {
      query.department = req.user.department;
      scope = 'DEPARTMENT';
    } else {
      query.userId = req.user._id;
    }

    const records = await AttendanceRecord.find(query)
      .populate('sessionId', 'date')
      .sort({ timestamp: -1 })
      .limit(1000);

    const totalDays = records.length;
    const presentDays = records.filter(r => r.status === 'PRESENT').length;

    return res.status(200).json({
      success: true,
      scope,
      stats: {
        totalDays,
        presentDays,
        absentDays: totalDays - presentDays,
        // 0 records means "no data", not 100% — the client shows "—" for null
        percentage: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null
      },
      records
    });
  } catch (err) {
    console.error('[ATTENDANCE FETCH ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not load attendance records.' });
  }
};

module.exports = { startSession, markAttendance, getMyAttendance };
