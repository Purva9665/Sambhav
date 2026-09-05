const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');
const { logAuditEvent } = require('../utils/auditHelper');
const { localDate } = require('../utils/dates');

/**
 * What this caller is allowed to see.
 *
 * Everything that reads attendance goes through this, so widening one endpoint
 * cannot accidentally widen another:
 *   ADMIN                          the whole organisation
 *   TEAM_HEAD                      their own team
 *   everyone else                  only their own records
 */
function visibilityFor(user) {
  if (user.role === 'ADMIN') return { filter: {}, scope: 'ORGANISATION' };
  if (user.role === 'TEAM_HEAD') {
    return { filter: { department: user.department }, scope: 'DEPARTMENT' };
  }
  return { filter: { userId: user._id }, scope: 'SELF' };
}

/**
 * Open (or fetch) today's session and return the roster to mark.
 * Marking is an administrator action, so the roster is always everyone.
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

    const users = await User.find({ status: 'ACTIVE' })
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
      return res.status(409).json({
        success: false,
        message: `Attendance for ${session.date} is closed and can no longer be changed. An administrator can reopen it.`
      });
    }

    if (records.some(r => !['PRESENT', 'ABSENT'].includes(r.status))) {
      return res.status(400).json({ success: false, message: 'Each record must be PRESENT or ABSENT.' });
    }

    const targets = await User.find({
      _id: { $in: records.map(r => r.userId) },
      status: 'ACTIVE'
    }).select('fullName role department');

    const byId = new Map(targets.map(u => [String(u._id), u]));

    // The route already restricts this to administrators; this second check
    // means a future route change cannot silently widen who gets marked.
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only an administrator can mark attendance.'
      });
    }

    const permitted = records.filter(r => byId.has(String(r.userId)));

    if (permitted.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'None of those members could be found, or they are not active.'
      });
    }

    // Read what is already there so a correction can be recorded rather than
    // silently overwriting the previous value.
    const existing = await AttendanceRecord.find({
      sessionId: session._id,
      userId: { $in: permitted.map(r => r.userId) }
    });
    const priorById = new Map(existing.map(r => [String(r.userId), r]));

    const changes = [];
    const now = new Date();

    for (const r of permitted) {
      const target = byId.get(String(r.userId));
      const prior = priorById.get(String(r.userId));

      // Re-submitting the same value is not a change; leave the record alone.
      if (prior && prior.status === r.status) continue;

      const entry = {
        from: prior ? prior.status : null,
        to: r.status,
        byUserId: req.user._id,
        byName: req.user.fullName,
        at: now
      };

      await AttendanceRecord.updateOne(
        { sessionId: session._id, userId: target._id },
        {
          $set: {
            userName: target.fullName,
            userRole: target.role,
            department: target.department,
            status: r.status,
            markedByUserId: req.user._id,
            markedByName: req.user.fullName,
            timestamp: now
          },
          $setOnInsert: { sessionId: session._id, userId: target._id },
          $push: { history: entry },
          $inc: { editCount: prior ? 1 : 0 }
        },
        { upsert: true }
      );

      changes.push({
        member: target.fullName,
        from: entry.from || 'unmarked',
        to: entry.to
      });
    }

    // Corrections to an existing mark are the interesting part of the trail,
    // so they are named individually rather than counted.
    const corrections = changes.filter(c => c.from !== 'unmarked');

    await logAuditEvent({
      action: 'ATTENDANCE_MARKED',
      req,
      actorUser: req.user,
      targetResource: `AttendanceSession:${session._id}`,
      details: {
        date: session.date,
        changed: changes.length,
        unchanged: permitted.length - changes.length,
        skipped: records.length - permitted.length,
        ...(corrections.length ? { corrections } : {})
      }
    });

    return res.status(200).json({
      success: true,
      message: changes.length === 0
        ? 'No changes — those marks were already saved.'
        : `Attendance saved for ${changes.length} member${changes.length === 1 ? '' : 's'}.`,
      changed: changes.length,
      corrections: corrections.length
    });
  } catch (err) {
    console.error('[ATTENDANCE MARK ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not save attendance.' });
  }
};

/**
 * Close a session so its marks can no longer be changed, or reopen one.
 * Route: PUT /api/v1/attendance/sessions/:id/close   (admin only)
 *
 * Without this, every past day stayed editable forever — the closed check
 * existed but nothing ever set the flag.
 */
const setSessionLock = async (req, res) => {
  try {
    const session = await AttendanceSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    const reopen = req.body?.reopen === true;
    session.status = reopen ? 'OPEN' : 'CLOSED';
    await session.save();

    await logAuditEvent({
      action: 'ATTENDANCE_MARKED',
      req,
      actorUser: req.user,
      targetResource: `AttendanceSession:${session._id}`,
      details: { date: session.date, action: reopen ? 'REOPENED' : 'CLOSED' }
    });

    return res.status(200).json({
      success: true,
      message: reopen
        ? `Attendance for ${session.date} is open for changes again.`
        : `Attendance for ${session.date} is closed. Marks can no longer be changed.`,
      session
    });
  } catch (err) {
    console.error('[ATTENDANCE LOCK ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not update the session.' });
  }
};

/** Sessions the caller may see, newest first. */
const listSessions = async (req, res) => {
  try {
    const sessions = await AttendanceSession.find().sort({ date: -1 }).limit(365);
    return res.status(200).json({ success: true, count: sessions.length, sessions });
  } catch (err) {
    console.error('[ATTENDANCE SESSIONS ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not load sessions.' });
  }
};

/**
 * Attendance records with the stats for them.
 * `scope` tells the client which set it received, so the UI can label the
 * numbers honestly instead of calling org-wide figures "your rate".
 */
const getMyAttendance = async (req, res) => {
  try {
    const { filter, scope } = visibilityFor(req.user);

    const records = await AttendanceRecord.find(filter)
      .populate('sessionId', 'date status')
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

/**
 * Records between two calendar dates, for export.
 * Route: GET /api/v1/attendance/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Scoped by the same visibility rule as everything else: a member exporting
 * gets only their own rows, a team head only their team's. Nobody can widen
 * the range into data they cannot already read.
 */
const exportAttendance = async (req, res) => {
  try {
    const { from, to } = req.query;
    const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

    if (!isDate(from) || !isDate(to)) {
      return res.status(400).json({
        success: false,
        message: 'from and to are required, as YYYY-MM-DD.'
      });
    }
    if (from > to) {
      return res.status(400).json({ success: false, message: 'from must not be after to.' });
    }

    // Sessions carry the calendar date; records point at a session. Selecting
    // by session date is what makes "1st to 30th" mean the days themselves,
    // rather than when someone happened to press save.
    const sessions = await AttendanceSession.find({ date: { $gte: from, $lte: to } })
      .sort({ date: 1 });

    if (sessions.length === 0) {
      return res.status(200).json({
        success: true, scope: visibilityFor(req.user).scope,
        from, to, sessions: 0, count: 0, rows: [], summary: null
      });
    }

    const dateBySession = new Map(sessions.map(s => [String(s._id), s.date]));
    const statusBySession = new Map(sessions.map(s => [String(s._id), s.status]));

    const { filter, scope } = visibilityFor(req.user);

    const records = await AttendanceRecord.find({
      ...filter,
      sessionId: { $in: sessions.map(s => s._id) }
    }).sort({ timestamp: 1 });

    const rows = records.map(r => ({
      date: dateBySession.get(String(r.sessionId)) || '',
      sessionStatus: statusBySession.get(String(r.sessionId)) || '',
      member: r.userName,
      department: r.department,
      role: r.userRole,
      status: r.status,
      markedBy: r.markedByName || '',
      markedAt: r.timestamp,
      corrections: r.editCount || 0
    })).sort((a, b) => a.date.localeCompare(b.date) || a.member.localeCompare(b.member));

    const present = rows.filter(r => r.status === 'PRESENT').length;

    await logAuditEvent({
      action: 'ATTENDANCE_MARKED',
      req,
      actorUser: req.user,
      targetResource: 'AttendanceExport',
      details: { action: 'EXPORTED', from, to, scope, rows: rows.length }
    });

    return res.status(200).json({
      success: true,
      scope,
      from,
      to,
      sessions: sessions.length,
      count: rows.length,
      summary: {
        present,
        absent: rows.length - present,
        percentage: rows.length ? Math.round((present / rows.length) * 100) : null,
        members: new Set(rows.map(r => r.member)).size
      },
      rows
    });
  } catch (err) {
    console.error('[ATTENDANCE EXPORT ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not export attendance.' });
  }
};

module.exports = {
  startSession,
  markAttendance,
  getMyAttendance,
  exportAttendance,
  listSessions,
  setSessionLock
};
