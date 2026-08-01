const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');
const { logAuditEvent } = require('../utils/auditHelper');

// Get active banners for current user
const getMyAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({
      channels: 'BANNER',
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    }).sort({ createdAt: -1 });

    // Filter announcements targeting this specific user/department/role
    const userAnnouncements = announcements.filter(ann => {
      if (ann.audienceType === 'ALL') return true;
      if (ann.audienceType === 'HEADS' && req.user.role === 'TEAM_HEAD') return true;
      if (ann.audienceType === 'DEPARTMENT' && ann.audienceTargets.includes(req.user.department)) return true;
      if (ann.audienceType === 'INDIVIDUALS' && ann.audienceTargets.includes(req.user._id.toString())) return true;
      return false;
    });

    return res.status(200).json({ success: true, count: userAnnouncements.length, announcements: userAnnouncements });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch announcements.' });
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

    // If EMAIL channel is checked, resolve recipient emails and send!
    if (selectedChannels.includes('EMAIL')) {
      let recipientQuery = { status: 'ACTIVE' };

      if (audienceType === 'HEADS') {
        recipientQuery.role = 'TEAM_HEAD';
      } else if (audienceType === 'DEPARTMENT') {
        recipientQuery.department = { $in: audienceTargets };
      } else if (audienceType === 'INDIVIDUALS') {
        recipientQuery._id = { $in: audienceTargets };
      }

      const targetUsers = await User.find(recipientQuery).select('email fullName');

      for (const u of targetUsers) {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; background: #0A0D14; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #00A3FF;">
            <h2 style="color: #00A3FF; margin-top: 0;">📢 SAMBHAV Announcement: ${title}</h2>
            <p style="font-size: 15px; line-height: 1.6;">${content}</p>
            <hr style="border-color: rgba(255,255,255,0.1); margin: 20px 0;" />
            <p style="color: #94A3B8; font-size: 12px;">Posted by Admin (${req.user.fullName}) on SAMBHAV Employee Portal.</p>
          </div>
        `;

        await sendEmail({
          to: u.email,
          subject: `[SAMBHAV ANNOUNCEMENT] ${title}`,
          htmlText: emailHtml
        });
      }
    }

    await logAuditEvent({
      action: 'ANNOUNCEMENT_POSTED',
      req,
      actorUser: req.user,
      targetResource: `Announcement:${announcement._id}`,
      details: { title, channels: selectedChannels, audienceType, audienceTargets }
    });

    return res.status(201).json({ success: true, message: 'Announcement published successfully.', announcement });
  } catch (err) {
    console.error(`[ANNOUNCEMENT ERROR]`, err);
    return res.status(500).json({ success: false, message: 'Failed to post announcement.' });
  }
};

module.exports = { getMyAnnouncements, createAnnouncement };
