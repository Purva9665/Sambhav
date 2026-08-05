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
      const fromEmail = process.env.ADMIN_EMAIL || 'purvakadam9637@gmail.com';
      const msg = {
        to,
        from: {
          email: fromEmail,
          name: 'SAMBHAV Security Portal'
        },
        subject,
        html: htmlText
      };
      await sgMail.send(msg);
      console.log(`[SENDGRID SUCCESS] Email delivered successfully via SendGrid API to ${to}`);
      await EmailLog.create({ recipientEmail: to, subject, status: 'SENT' });
      return { success: true, mode: 'SENDGRID' };
    } else {
      console.log(`[SENDGRID MOCK MODE] Email logged successfully in development.`);
      await EmailLog.create({ recipientEmail: to, subject, status: 'MOCK_LOGGED' });
      return { success: true, mode: 'MOCK' };
    }
  } catch (error) {
    console.error(`[EMAIL DISPATCH ERROR]`, error.message);
    if (error.response && error.response.body) {
      console.error(`[SENDGRID REJECTION DETAILS]`, JSON.stringify(error.response.body, null, 2));
    }
    await EmailLog.create({ recipientEmail: to, subject, status: 'FAILED', errorDetails: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = { sendEmail };
