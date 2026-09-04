const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');
const { logAuditEvent } = require('../utils/auditHelper');

// Get leave requests
const getLeaveRequests = async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'ADMIN') {
      query.userId = req.user._id;
    }

    const leaves = await LeaveRequest.find(query).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: leaves.length, leaves });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch leave requests.' });
  }
};

// Apply for leave
const applyLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, message: 'Start date, end date, and reason are required.' });
    }

    const leave = await LeaveRequest.create({
      userId: req.user._id,
      userName: req.user.fullName,
      userRole: req.user.role,
      department: req.user.department,
      leaveType: leaveType || 'CASUAL',
      startDate,
      endDate,
      reason
    });

    await logAuditEvent({
      action: 'LEAVE_SUBMITTED',
      req,
      actorUser: req.user,
      targetResource: `Leave:${leave._id}`,
      details: { leaveType, startDate, endDate }
    });

    return res.status(201).json({ success: true, message: 'Leave application submitted successfully.', leave });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to submit leave application.' });
  }
};

// Review Leave Application (ADMIN ONLY)
const reviewLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be APPROVED or REJECTED.' });
    }

    const leave = await LeaveRequest.findById(id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    leave.status = status;
    leave.reviewedByUserId = req.user._id;
    leave.reviewNotes = reviewNotes || '';
    await leave.save();

    // Send email notification to applicant
    const applicant = await User.findById(leave.userId);
    if (applicant) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; background: #0A0D14; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #00A3FF;">
          <h2 style="color: ${status === 'APPROVED' ? '#2E7D32' : '#B91C1C'}; margin-top: 0;">
            ${status === 'APPROVED' ? '✅ Leave Application Approved' : '❌ Leave Application Rejected'}
          </h2>
          <p>Hi ${applicant.fullName}, your leave application for ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()} has been reviewed by Admin.</p>
          <p><strong>Status:</strong> ${status}</p>
          ${reviewNotes ? `<p><strong>Admin Notes:</strong> ${reviewNotes}</p>` : ''}
          <hr style="border-color: rgba(255,255,255,0.1); margin: 20px 0;" />
          <p style="color: #94A3B8; font-size: 12px;">SAMBHAV Employee Portal Automated Decision Dispatch.</p>
        </div>
      `;

      const delivery = await sendEmail({
        to: applicant.email,
        subject: `[SAMBHAV LEAVE UPDATE] Your Leave Application is ${status}`,
        htmlText: emailHtml
      });

      if (!delivery.delivered) {
        console.warn(`[LEAVE] Decision email to ${applicant.email} was not delivered.`);
      }
    }

    await logAuditEvent({
      action: 'LEAVE_REVIEWED',
      req,
      actorUser: req.user,
      targetResource: `Leave:${leave._id}`,
      details: { applicantEmail: applicant?.email, status, reviewNotes }
    });

    return res.status(200).json({ success: true, message: `Leave request ${status.toLowerCase()}.`, leave });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to review leave application.' });
  }
};

module.exports = { getLeaveRequests, applyLeave, reviewLeave };
