const ProfileChangeRequest = require('../models/ProfileChangeRequest');
const User = require('../models/User');
const { logAuditEvent } = require('../utils/auditHelper');
const { ROLES, TEAMS, ACADEMIC_DEPARTMENTS } = require('../constants');

const EDITABLE = ['role', 'department', 'academicDepartment', 'position', 'mobileNumber'];

/** Keep only fields that differ from what the user already has. */
function diffAgainst(user, body) {
  const out = {};

  if (body.role && ROLES.includes(body.role) && body.role !== user.role) {
    out.role = body.role;
  }
  if (body.department && TEAMS.includes(body.department) && body.department !== user.department) {
    out.department = body.department;
  }
  if (body.academicDepartment !== undefined) {
    const value = body.academicDepartment || '';
    const valid = value === '' || ACADEMIC_DEPARTMENTS.includes(value);
    if (valid && value !== (user.academicDepartment || '')) out.academicDepartment = value;
  }
  if (body.position !== undefined) {
    const value = String(body.position).trim().slice(0, 80);
    if (value && value !== (user.position || '')) out.position = value;
  }
  if (body.mobileNumber !== undefined) {
    const value = String(body.mobileNumber).trim().slice(0, 24);
    if (value !== (user.mobileNumber || '')) out.mobileNumber = value;
  }

  return out;
}

// ------------------------------------------------------------------ CREATE

/**
 * File a request to change your own profile.
 * Route: POST /api/v1/profile-requests
 *
 * Admins do not need this — they edit their own profile directly — so this
 * rejects them rather than creating a request nobody needs to approve.
 */
const createRequest = async (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Administrators can edit their own profile directly, no request needed.'
      });
    }

    const requested = diffAgainst(req.user, req.body);

    if (Object.keys(requested).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nothing to change — the values you submitted match your profile.'
      });
    }

    if (requested.role === 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access cannot be requested. An administrator must grant it.'
      });
    }

    // A department head must say which department, and only they may name one.
    const resultingRole = requested.role || req.user.role;
    if (resultingRole === 'DEPARTMENT_HEAD') {
      const dept = requested.academicDepartment ?? req.user.academicDepartment;
      if (!dept) {
        return res.status(400).json({
          success: false,
          message: 'Select which academic department you would head.'
        });
      }
    } else if (requested.academicDepartment) {
      return res.status(400).json({
        success: false,
        message: 'Only a department head can be assigned an academic department.'
      });
    }

    const existing = await ProfileChangeRequest.findOne({
      userId: req.user._id,
      status: 'PENDING'
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You already have a request awaiting review. Withdraw it before filing another.'
      });
    }

    const request = await ProfileChangeRequest.create({
      userId: req.user._id,
      userName: req.user.fullName,
      userEmail: req.user.email,
      requested,
      reason: String(req.body.reason || '').trim().slice(0, 500)
    });

    await logAuditEvent({
      action: 'PROFILE_CHANGE_REQUESTED',
      req,
      actorUser: req.user,
      targetResource: `ProfileChangeRequest:${request._id}`,
      details: { requested }
    });

    return res.status(201).json({
      success: true,
      message: 'Request sent. An administrator will review it.',
      request
    });
  } catch (err) {
    console.error('[PROFILE REQUEST ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not submit your request.' });
  }
};

// -------------------------------------------------------------------- LIST

/** Admins see every request; everyone else sees only their own. */
const listRequests = async (req, res) => {
  try {
    const query = req.user.role === 'ADMIN' ? {} : { userId: req.user._id };
    if (req.query.status) query.status = req.query.status;

    const requests = await ProfileChangeRequest.find(query)
      .sort({ status: 1, createdAt: -1 })
      .limit(300);

    const pendingCount = await ProfileChangeRequest.countDocuments({
      ...(req.user.role === 'ADMIN' ? {} : { userId: req.user._id }),
      status: 'PENDING'
    });

    return res.status(200).json({
      success: true,
      count: requests.length,
      pendingCount,
      requests
    });
  } catch (err) {
    console.error('[PROFILE REQUEST LIST ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not load requests.' });
  }
};

// ------------------------------------------------------------------ REVIEW

/**
 * Approve or reject a request. Approving applies the change to the user.
 * Route: PUT /api/v1/profile-requests/:id/review  (admin only)
 */
const reviewRequest = async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be APPROVED or REJECTED.' });
    }

    const request = await ProfileChangeRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }
    if (request.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `This request was already ${request.status.toLowerCase()}.`
      });
    }

    const user = await User.findById(request.userId);
    if (!user) {
      request.status = 'REJECTED';
      request.reviewNotes = 'The account no longer exists.';
      request.reviewedAt = new Date();
      await request.save();
      return res.status(404).json({ success: false, message: 'That account no longer exists.' });
    }

    request.previous = {
      role: user.role,
      department: user.department,
      academicDepartment: user.academicDepartment,
      position: user.position,
      mobileNumber: user.mobileNumber
    };

    if (status === 'APPROVED') {
      for (const field of EDITABLE) {
        const value = request.requested[field];
        if (value !== null && value !== undefined) user[field] = value;
      }

      // Leaving the department-head role clears the department it implied.
      if (user.role !== 'DEPARTMENT_HEAD') user.academicDepartment = '';

      await user.save();
    }

    request.status = status;
    request.reviewedByUserId = req.user._id;
    request.reviewedByName = req.user.fullName;
    request.reviewedAt = new Date();
    request.reviewNotes = String(reviewNotes || '').trim().slice(0, 500);
    await request.save();

    await logAuditEvent({
      action: status === 'APPROVED' ? 'PROFILE_CHANGE_APPROVED' : 'PROFILE_CHANGE_REJECTED',
      req,
      actorUser: req.user,
      targetResource: `User:${user._id}`,
      details: {
        targetEmail: user.email,
        requested: request.requested,
        previous: request.previous,
        reviewNotes: request.reviewNotes
      }
    });

    return res.status(200).json({
      success: true,
      message: status === 'APPROVED'
        ? `${user.fullName}'s profile has been updated.`
        : `Request from ${user.fullName} was rejected.`,
      request
    });
  } catch (err) {
    console.error('[PROFILE REVIEW ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not review this request.' });
  }
};

// ---------------------------------------------------------------- WITHDRAW

/** Take back your own pending request. */
const withdrawRequest = async (req, res) => {
  try {
    const request = await ProfileChangeRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }
    if (String(request.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'That is not your request.' });
    }
    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Only a pending request can be withdrawn.' });
    }

    request.status = 'WITHDRAWN';
    await request.save();

    return res.status(200).json({ success: true, message: 'Request withdrawn.', request });
  } catch (err) {
    console.error('[PROFILE WITHDRAW ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not withdraw the request.' });
  }
};

module.exports = { createRequest, listRequests, reviewRequest, withdrawRequest };
