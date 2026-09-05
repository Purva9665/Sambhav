const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { logAuditEvent } = require('../utils/auditHelper');
const { ROLES, STATUSES, TEAMS, ACADEMIC_DEPARTMENTS } = require('../constants');

/** Roster visible to admins, department heads and team heads. */
const getMemberList = async (req, res) => {
  try {
    const users = await User.find({ status: 'ACTIVE' })
      .select('fullName role department academicDepartment position createdAt')
      .sort({ fullName: 1 });

    return res.status(200).json({ success: true, count: users.length, members: users });
  } catch (err) {
    console.error('[MEMBER LIST ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not load the member list.' });
  }
};

/** Full directory — admin only. Includes contact details and last sign-in. */
const getTeamDirectory = async (req, res) => {
  try {
    const directory = await User.find()
      .select('-passwordHash -otpCode -otpAttempts -resetCode -resetAttempts')
      .sort({ role: 1, fullName: 1 });

    await logAuditEvent({
      action: 'DIRECTORY_ACCESSED',
      req,
      actorUser: req.user,
      targetResource: 'TeamDirectory',
      details: { records: directory.length }
    });

    return res.status(200).json({ success: true, count: directory.length, directory });
  } catch (err) {
    console.error('[DIRECTORY ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not load the directory.' });
  }
};

/** Recent audit trail — admin only. */
const getAuditLogs = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(limit);

    return res.status(200).json({ success: true, count: logs.length, logs });
  } catch (err) {
    console.error('[AUDIT LOG ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not load audit logs.' });
  }
};

/**
 * Update a user's role, status, team, academic department or position.
 * Route: PUT /api/v1/admin/users/:userId  (admin only)
 *
 * There is no cap on how many administrators may exist — promoting a second,
 * third or tenth admin is just a role change through here.
 */
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, status, department, academicDepartment, position, mobileNumber } = req.body;

    if (role && !ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Unknown role.' });
    }
    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Unknown status.' });
    }
    if (department && !TEAMS.includes(department)) {
      return res.status(400).json({ success: false, message: 'Unknown team.' });
    }
    if (academicDepartment && !ACADEMIC_DEPARTMENTS.includes(academicDepartment)) {
      return res.status(400).json({ success: false, message: 'Unknown academic department.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isSelf = String(user._id) === String(req.user._id);

    // An admin may edit their own role, team, position and mobile number.
    // Suspending yourself is still refused: it locks you out immediately and
    // there is no case where it is what you meant to do.
    if (isSelf && status && status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'You cannot suspend your own account.' });
    }

    // Never let the last administrator be demoted — that would leave the
    // portal with no one able to manage roles.
    const losingAdmin = user.role === 'ADMIN' && ((role && role !== 'ADMIN') || (status && status !== 'ACTIVE'));
    if (losingAdmin) {
      const remaining = await User.countDocuments({ role: 'ADMIN', status: 'ACTIVE', _id: { $ne: user._id } });
      if (remaining === 0) {
        return res.status(400).json({
          success: false,
          message: 'This is the only active administrator. Promote someone else first.'
        });
      }
    }

    const before = {
      role: user.role,
      status: user.status,
      department: user.department,
      academicDepartment: user.academicDepartment,
      position: user.position,
      mobileNumber: user.mobileNumber
    };

    if (role) user.role = role;
    if (status) user.status = status;
    if (department) user.department = department;
    if (position) user.position = String(position).trim().slice(0, 80);
    if (mobileNumber !== undefined) user.mobileNumber = String(mobileNumber).trim().slice(0, 24);

    // An explicit empty string clears the academic department, which is what
    // happens when someone stops being a department head.
    if (academicDepartment !== undefined) {
      user.academicDepartment = academicDepartment || '';
    }
    if (role && role !== 'DEPARTMENT_HEAD' && !academicDepartment) {
      user.academicDepartment = '';
    }

    await user.save();

    const changes = Object.entries({ role, status, department, academicDepartment, position, mobileNumber })
      .filter(([k, v]) => v !== undefined && before[k] !== user[k])
      .map(([k]) => `${k}: ${before[k] || '(none)'} → ${user[k] || '(none)'}`);

    if (changes.length) {
      let action = 'ROLE_CHANGE';
      if (role === 'ADMIN' && before.role !== 'ADMIN') action = 'ADMIN_GRANTED';
      if (before.role === 'ADMIN' && role && role !== 'ADMIN') action = 'ADMIN_REVOKED';

      await logAuditEvent({
        action,
        req,
        actorUser: req.user,
        targetResource: `User:${user._id}`,
        details: { targetEmail: user.email, changes }
      });
    }

    return res.status(200).json({
      success: true,
      message: role === 'ADMIN' && before.role !== 'ADMIN'
        ? `${user.fullName} is now an administrator.`
        : 'Member updated.',
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        department: user.department,
        academicDepartment: user.academicDepartment,
        position: user.position,
        mobileNumber: user.mobileNumber
      }
    });
  } catch (err) {
    console.error('[USER UPDATE ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not update the member.' });
  }
};

/**
 * Create an account directly, as an administrator.
 * Route: POST /api/v1/admin/users  (admin only)
 *
 * This is the one-step way to appoint someone — including another admin —
 * without them registering and waiting for an OTP. The account is created
 * ACTIVE, and the temporary password is returned exactly once so it can be
 * handed over. It is never stored in plain text and never emailed.
 */
const createUser = async (req, res) => {
  try {
    const {
      fullName, email, role, department, academicDepartment,
      mobileNumber, position, password
    } = req.body;

    if (!fullName || !email || !department) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email and team are required.'
      });
    }

    if (role && !ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Unknown role.' });
    }
    if (!TEAMS.includes(department)) {
      return res.status(400).json({ success: false, message: 'Unknown team.' });
    }

    const normalisedEmail = String(email).toLowerCase().trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalisedEmail)) {
      return res.status(400).json({ success: false, message: 'That email address is not valid.' });
    }

    if (await User.findOne({ email: normalisedEmail })) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const assignedRole = role || 'TEAM_MEMBER';

    if (assignedRole === 'DEPARTMENT_HEAD' && !ACADEMIC_DEPARTMENTS.includes(academicDepartment)) {
      return res.status(400).json({
        success: false,
        message: 'Select which academic department this person heads.'
      });
    }

    // An admin may supply a password, otherwise generate a strong one.
    let temporaryPassword = password;
    if (temporaryPassword) {
      if (String(temporaryPassword).length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
      }
    } else {
      const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
      temporaryPassword = Array.from(
        { length: 14 },
        () => alphabet[crypto.randomInt(alphabet.length)]
      ).join('');
    }

    const user = await User.create({
      fullName: String(fullName).trim().slice(0, 120),
      email: normalisedEmail,
      passwordHash: await bcrypt.hash(temporaryPassword, await bcrypt.genSalt(12)),
      role: assignedRole,
      department,
      academicDepartment: assignedRole === 'DEPARTMENT_HEAD' ? academicDepartment : '',
      mobileNumber: String(mobileNumber || '').trim().slice(0, 24),
      position: String(position || 'Member').trim().slice(0, 80),
      // Created by an admin who has already vetted this person, so no OTP step.
      status: 'ACTIVE'
    });

    await logAuditEvent({
      action: assignedRole === 'ADMIN' ? 'ADMIN_GRANTED' : 'USER_CREATED',
      req,
      actorUser: req.user,
      targetResource: `User:${user._id}`,
      details: {
        targetEmail: user.email,
        role: assignedRole,
        department,
        createdDirectly: true
      }
    });

    return res.status(201).json({
      success: true,
      message: `${user.fullName} can now sign in.`,
      // Shown once in the UI so the admin can pass it on. Not persisted.
      temporaryPassword,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department,
        academicDepartment: user.academicDepartment,
        position: user.position,
        status: user.status
      }
    });
  } catch (err) {
    console.error('[CREATE USER ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not create the account.' });
  }
};

/**
 * Delete audit entries.
 * Route: DELETE /api/v1/admin/audit-logs?days=N   (admin only)
 *
 * `days=N` removes entries older than N days; omitting it removes everything.
 *
 * Clearing the security trail is itself a security event, so a single entry
 * recording who did it — and how much went — is written immediately after.
 * That entry is the one thing a clear cannot erase.
 */
const clearAuditLogs = async (req, res) => {
  try {
    const days = req.query.days ? Number(req.query.days) : null;

    if (days !== null && (!Number.isFinite(days) || days < 0)) {
      return res.status(400).json({ success: false, message: 'days must be a positive number.' });
    }

    const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
    const filter = cutoff ? { timestamp: { $lt: cutoff } } : {};

    const matching = await AuditLog.countDocuments(filter);
    const result = await AuditLog.deleteMany(filter);

    await logAuditEvent({
      action: 'AUDIT_LOGS_CLEARED',
      req,
      actorUser: req.user,
      targetResource: 'AuditLog',
      details: {
        deleted: result.deletedCount,
        scope: cutoff ? `older than ${days} day(s)` : 'all entries',
        cutoff: cutoff ? cutoff.toISOString() : null
      }
    });

    return res.status(200).json({
      success: true,
      deleted: result.deletedCount,
      message: result.deletedCount === 0
        ? 'There was nothing to delete.'
        : `Deleted ${result.deletedCount} entr${result.deletedCount === 1 ? 'y' : 'ies'}.`,
      matched: matching
    });
  } catch (err) {
    console.error('[CLEAR AUDIT ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not clear the audit log.' });
  }
};

/**
 * Delete an account.
 * Route: DELETE /api/v1/admin/users/:userId   (admin only)
 *
 * Their attendance and leave records go too, so nothing is left pointing at a
 * user who no longer exists. Audit entries stay: they are the security trail.
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }

    if (user.role === 'ADMIN') {
      const others = await User.countDocuments({
        role: 'ADMIN', status: 'ACTIVE', _id: { $ne: user._id }
      });
      if (others === 0) {
        return res.status(400).json({
          success: false,
          message: 'This is the only active administrator. Promote someone else first.'
        });
      }
    }

    const AttendanceRecord = require('../models/AttendanceRecord');
    const LeaveRequest = require('../models/LeaveRequest');
    const ProfileChangeRequest = require('../models/ProfileChangeRequest');

    const [attendance, leave, requests] = await Promise.all([
      AttendanceRecord.deleteMany({ userId: user._id }),
      LeaveRequest.deleteMany({ userId: user._id }),
      ProfileChangeRequest.deleteMany({ userId: user._id })
    ]);

    const snapshot = {
      email: user.email, fullName: user.fullName,
      role: user.role, status: user.status, department: user.department
    };
    await user.deleteOne();

    await logAuditEvent({
      action: 'USER_DELETED',
      req,
      actorUser: req.user,
      targetResource: `User:${req.params.userId}`,
      details: {
        ...snapshot,
        removed: {
          attendance: attendance.deletedCount,
          leave: leave.deletedCount,
          changeRequests: requests.deletedCount
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: `${snapshot.fullName}'s account has been deleted.`
    });
  } catch (err) {
    console.error('[USER DELETE ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not delete the account.' });
  }
};

module.exports = {
  deleteUser,
  clearAuditLogs,
  createUser,
  getMemberList,
  getTeamDirectory,
  getAuditLogs,
  updateUserRole
};
