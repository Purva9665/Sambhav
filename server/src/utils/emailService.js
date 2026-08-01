const sgMail = require('@sendgrid/mail');
const EmailLog = require('../models/EmailLog');

if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY.startsWith('SG.')) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Send email via SendGrid or log to fallback console/database in development
 */
async function sendEmail({ to, subject, htmlText }) {
  console.log(`\n======================================================`);
  console.log(`[EMAIL DISPATCH] To: ${to}`);
  console.log(`[EMAIL DISPATCH] Subject: ${subject}`);
  console.log(`======================================================\n`);

  try {
    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY.startsWith('SG.') && !process.env.SENDGRID_API_KEY.includes('mock')) {
      const msg = {
        to,
        from: process.env.ADMIN_EMAIL || 'no-reply@sambhav.org',
        subject,
        html: htmlText
      };
      await sgMail.send(msg);
      await EmailLog.create({ recipientEmail: to, subject, status: 'SENT' });
      return { success: true, mode: 'SENDGRID' };
    } else {
      console.log(`[SENDGRID MOCK MODE] Email logged successfully in development.`);
      await EmailLog.create({ recipientEmail: to, subject, status: 'MOCK_LOGGED' });
      return { success: true, mode: 'MOCK' };
    }
  } catch (error) {
    console.error(`[EMAIL DISPATCH ERROR]`, error.message);
    await EmailLog.create({ recipientEmail: to, subject, status: 'FAILED', errorDetails: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = { sendEmail };
