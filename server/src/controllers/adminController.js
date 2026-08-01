const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { logAuditEvent } = require('../utils/auditHelper');

// 1. Get Member List (Public Roster: Name, Role, Department, JoinedDate - accessible by ADMIN & TEAM_HEAD)
const getMemberList = async (req, res) => {
  try {
    const users = await User.find({ status: 'ACTIVE' })
      .select('fullName role department position createdAt')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: users.length, members: users });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch member list.' });
  }
};

// 2. Get Team Directory (STRICTLY ADMIN ONLY - includes mobile numbers, emails, last login IPs)
const getTeamDirectory = async (req, res) => {
  try {
    const directory = await User.find()
      .select('-passwordHash -otpCode')
      .sort({ role: 1, fullName: 1 });

    await logAuditEvent({
      action: 'DIRECTORY_ACCESSED',
      req,
      actorUser: req.user,
      targetResource: 'TeamDirectory',
      details: { totalRecordsRetrieved: directory.length }
    });

    return res.status(200).json({ success: true, count: directory.length, directory });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch team directory.' });
  }
};

// 3. Get Security Audit Logs (STRICTLY ADMIN ONLY)
const getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(200);

    return res.status(200).json({ success: true, count: logs.length, logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
};

// 4. Update User Role or Status (ADMIN ONLY)
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, status, department, position } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const previousRole = user.role;
    const previousStatus = user.status;

    if (role && ['ADMIN', 'TEAM_HEAD', 'TEAM_MEMBER'].includes(role)) user.role = role;
    if (status && ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'].includes(status)) user.status = status;
    if (department) user.department = department;
    if (position) user.position = position;

    await user.save();

    await logAuditEvent({
      action: 'ROLE_CHANGE',
      req,
      actorUser: req.user,
      targetResource: `User:${user._id}`,
      details: {
        targetUserEmail: user.email,
        roleTransition: `${previousRole} -> ${user.role}`,
        statusTransition: `${previousStatus} -> ${user.status}`
      }
    });

    return res.status(200).json({ success: true, message: 'User profile updated successfully.', user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update user profile.' });
  }
};

module.exports = { getMemberList, getTeamDirectory, getAuditLogs, updateUserRole };
