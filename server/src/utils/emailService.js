const sgMail = require('@sendgrid/mail');
const EmailLog = require('../models/EmailLog');

/**
 * SendGrid delivery.
 *
 * Two things that previously broke OTP mail in production:
 *
 *  1. The `from` address was taken from ADMIN_EMAIL — a gmail.com address.
 *     SendGrid rejects that with a 403 unless it is verified as a Single
 *     Sender. The sender is now its own variable (SENDGRID_FROM_EMAIL) so the
 *     "who receives admin mail" and "which verified address sends it" are not
 *     forced to be the same value.
 *
 *  2. Failures were swallowed: this returned { success: false } and the caller
 *     ignored it, so registration answered "OTP dispatched" while nothing was
 *     sent. `sendEmail` now reports precisely what happened and the caller
 *     decides. Nothing here throws — callers check the result.
 */

const API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.ADMIN_EMAIL || '';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'SAMBHAV Portal';

const isConfigured = Boolean(
  API_KEY && API_KEY.startsWith('SG.') && !API_KEY.includes('mock') && FROM_EMAIL
);

if (isConfigured) sgMail.setApiKey(API_KEY);

/** Logged once at boot so a misconfigured deploy is obvious in Render's logs. */
function reportEmailConfig() {
  if (isConfigured) {
    console.log(`[EMAIL] SendGrid active. Sending as "${FROM_NAME}" <${FROM_EMAIL}>.`);
    console.log('[EMAIL] That address must be a verified Single Sender in SendGrid, or sends return 403.');
    return;
  }

  console.warn('[EMAIL] SendGrid is NOT configured — emails will be logged, not delivered.');
  if (!API_KEY) console.warn('[EMAIL]   missing SENDGRID_API_KEY');
  else if (!API_KEY.startsWith('SG.')) console.warn('[EMAIL]   SENDGRID_API_KEY does not start with "SG." — wrong value?');
  if (!FROM_EMAIL) console.warn('[EMAIL]   missing SENDGRID_FROM_EMAIL (or ADMIN_EMAIL as fallback)');
}

/**
 * @returns {Promise<{delivered: boolean, mode: 'SENDGRID'|'LOGGED', error?: string, status?: number}>}
 */
async function sendEmail({ to, subject, htmlText }) {
  if (!isConfigured) {
    console.log(`[EMAIL:LOGGED] to=${to} subject="${subject}" (SendGrid not configured)`);
    await EmailLog.create({ recipientEmail: to, subject, status: 'MOCK_LOGGED' }).catch(() => {});
    return { delivered: false, mode: 'LOGGED' };
  }

  try {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      html: htmlText
    });

    console.log(`[EMAIL:SENT] to=${to} subject="${subject}"`);
    await EmailLog.create({ recipientEmail: to, subject, status: 'SENT' }).catch(() => {});
    return { delivered: true, mode: 'SENDGRID' };
  } catch (error) {
    const status = error.code || error.response?.statusCode;
    const detail = error.response?.body?.errors?.map(e => e.message).join('; ') || error.message;

    console.error(`[EMAIL:FAILED] to=${to} status=${status} — ${detail}`);

    if (status === 403) {
      console.error(`[EMAIL:FAILED] 403 usually means "${FROM_EMAIL}" is not a verified sender in SendGrid.`);
      console.error('[EMAIL:FAILED] Verify it under Settings → Sender Authentication → Single Sender Verification.');
    }
    if (status === 401) {
      console.error('[EMAIL:FAILED] 401 means SENDGRID_API_KEY is invalid or revoked.');
    }

    await EmailLog.create({
      recipientEmail: to,
      subject,
      status: 'FAILED',
      errorDetails: `${status || 'ERR'}: ${detail}`.slice(0, 500)
    }).catch(() => {});

    return { delivered: false, mode: 'SENDGRID', error: detail, status };
  }
}

module.exports = { sendEmail, reportEmailConfig, isEmailConfigured: isConfigured };
