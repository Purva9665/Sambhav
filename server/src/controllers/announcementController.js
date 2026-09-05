const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');
const { logAuditEvent } = require('../utils/auditHelper');

const emailTemplate = ({ title, content, author }) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;border:1px solid #E2E5EA">
    <div style="background:#0E1524;padding:20px 24px">
      <div style="color:#fff;font-size:18px;font-weight:700;letter-spacing:2px">SAMBHAV</div>
      <div style="color:#8A929F;font-size:11px;letter-spacing:3px;margin-top:2px">ANNOUNCEMENT</div>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 12px;font-size:18px;color:#14181F">${title}</h2>
      <p style="color:#59616E;font-size:14px;line-height:1.6;white-space:pre-wrap">${content}</p>
      <hr style="border:0;border-top:1px solid #E2E5EA;margin:20px 0" />
      <p style="color:#8A929F;font-size:12px;margin:0">Posted by ${author} on the SAMBHAV portal.</p>
    </div>
  </div>
`;

// Get active banners for current user
const getMyAnnouncements = async (req, res) => {
  try {
    // Admins manage the feed, so they see unpublished ones too (flagged as
    // expired). Everyone else sees only what is currently live.
    const isAdmin = req.user.role === 'ADMIN';
    const includeExpired = isAdmin && req.query.includeExpired === 'true';

    const liveOnly = {
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    };

    const announcements = await Announcement.find({
      channels: 'BANNER',
      ...(includeExpired ? {} : liveOnly)
    }).sort({ createdAt: -1 });

    // Filter announcements targeting this specific user/department/role
    const userAnnouncements = announcements.filter(ann => {
      // An admin managing the feed sees everything, whoever it targets
      if (includeExpired) return true;
      if (ann.audienceType === 'ALL') return true;
      if (ann.audienceType === 'HEADS' && ['TEAM_HEAD', 'DEPARTMENT_HEAD'].includes(req.user.role)) return true;
      if (ann.audienceType === 'DEPARTMENT' && ann.audienceTargets.includes(req.user.department)) return true;
      if (ann.audienceType === 'INDIVIDUALS' && ann.audienceTargets.includes(req.user._id.toString())) return true;
      return false;
    });

    const now = Date.now();
    const withState = userAnnouncements.map(a => ({
      ...a.toObject(),
      isLive: !a.expiresAt || a.expiresAt.getTime() > now
    }));

    return res.status(200).json({ success: true, count: withState.length, announcements: withState });
  } catch (err) {
    console.error('[ANNOUNCEMENT LIST ERROR]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch announcements.' });
  }
};

/**
 * Take an announcement off the banner without destroying it.
 * Route: PUT /api/v1/announcements/:id/unpublish   (admin only)
 *
 * Sets expiresAt to now, so it stops being served but the record — and who
 * posted it — survives. Passing { republish: true } clears the expiry again.
 */
const setAnnouncementVisibility = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    const republish = req.body?.republish === true;
    announcement.expiresAt = republish ? null : new Date();
    await announcement.save();

    await logAuditEvent({
      action: 'ANNOUNCEMENT_POSTED',
      req,
      actorUser: req.user,
      targetResource: `Announcement:${announcement._id}`,
      details: { title: announcement.title, action: republish ? 'REPUBLISHED' : 'UNPUBLISHED' }
    });

    return res.status(200).json({
      success: true,
      message: republish ? 'Announcement is live again.' : 'Announcement unpublished.',
      announcement: { ...announcement.toObject(), isLive: republish }
    });
  } catch (err) {
    console.error('[ANNOUNCEMENT VISIBILITY ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not update the announcement.' });
  }
};

/**
 * Delete permanently.
 * Route: DELETE /api/v1/announcements/:id   (admin only)
 */
const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    const title = announcement.title;
    await announcement.deleteOne();

    await logAuditEvent({
      action: 'ANNOUNCEMENT_POSTED',
      req,
      actorUser: req.user,
      targetResource: `Announcement:${req.params.id}`,
      details: { title, action: 'DELETED' }
    });

    return res.status(200).json({ success: true, message: 'Announcement deleted.' });
  } catch (err) {
    console.error('[ANNOUNCEMENT DELETE ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not delete the announcement.' });
  }
};

// Create Announcement (ADMIN ONLY)
const createAnnouncement = async (req, res) => {
  try {
    const { title, content, channels, audienceType, audienceTargets, expiresAt } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const selectedChannels = Array.isArray(channels) && channels.length > 0 ? channels : ['BANNER'];

    const announcement = await Announcement.create({
      title,
      content,
      channels: selectedChannels,
      audienceType: audienceType || 'ALL',
      audienceTargets: Array.isArray(audienceTargets) ? audienceTargets : [],
      createdBy: req.user._id,
      createdByName: req.user.fullName,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    // Email fan-out. Delivery is reported back so the UI can tell the admin
    // when SendGrid rejected the send instead of silently claiming success.
    let emailReport = null;

    if (selectedChannels.includes('EMAIL')) {
      const recipientQuery = { status: 'ACTIVE' };

      if (audienceType === 'HEADS') recipientQuery.role = { $in: ['TEAM_HEAD', 'DEPARTMENT_HEAD'] };
      else if (audienceType === 'DEPARTMENT') recipientQuery.department = { $in: audienceTargets };
      else if (audienceType === 'INDIVIDUALS') recipientQuery._id = { $in: audienceTargets };

      const targetUsers = await User.find(recipientQuery).select('email fullName');

      const results = await Promise.all(
        targetUsers.map(u =>
          sendEmail({
            to: u.email,
            subject: `[SAMBHAV] ${title}`,
            htmlText: emailTemplate({ title, content, author: req.user.fullName })
          })
        )
      );

      const delivered = results.filter(r => r.delivered).length;
      emailReport = { attempted: results.length, delivered, failed: results.length - delivered };
      console.log(`[ANNOUNCEMENT] Email: ${delivered}/${results.length} delivered.`);
    }

    await logAuditEvent({
      action: 'ANNOUNCEMENT_POSTED',
      req,
      actorUser: req.user,
      targetResource: `Announcement:${announcement._id}`,
      details: { title, channels: selectedChannels, audienceType, audienceTargets }
    });

    return res.status(201).json({
      success: true,
      message: 'Announcement published.',
      email: emailReport,
      announcement
    });
  } catch (err) {
    console.error(`[ANNOUNCEMENT ERROR]`, err);
    return res.status(500).json({ success: false, message: 'Failed to post announcement.' });
  }
};

module.exports = {
  getMyAnnouncements,
  createAnnouncement,
  setAnnouncementVisibility,
  deleteAnnouncement
};
