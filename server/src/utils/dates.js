/**
 * Calendar-date helpers.
 *
 * Attendance sessions are keyed by a local calendar date. `toISOString()`
 * converts to UTC first, so in IST (+05:30) any session opened before 05:30
 * local was filed under the *previous* day. These helpers format from the
 * parts of a date in a named timezone instead.
 *
 * Set PORTAL_TIMEZONE to an IANA zone (default Asia/Kolkata) so the server's
 * own locale — Render runs UTC — never decides what "today" means.
 */

const ZONE = process.env.PORTAL_TIMEZONE || 'Asia/Kolkata';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** Local calendar date as YYYY-MM-DD in the portal's timezone. */
function localDate(date = new Date()) {
  // en-CA already formats as YYYY-MM-DD
  return formatter.format(date);
}

/** Local calendar month as YYYY-MM. */
function localMonth(date = new Date()) {
  return localDate(date).slice(0, 7);
}

module.exports = { localDate, localMonth, ZONE };
