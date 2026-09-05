/**
 * Attendance visibility, integrity and export.
 *   node scripts/testAttendance.cjs
 * Creates throwaway accounts and removes everything it made.
 */
require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PW = 'AttTest12345!';

function call(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1', port: 5000, path: `/api/v1${path}`, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let raw = '';
      res.on('data', d => (raw += d));
      res.on('end', () => {
        let json; try { json = JSON.parse(raw); } catch { json = {}; }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        ${detail}`}`);
  ok ? pass++ : fail++;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const User = require('../src/models/User');
  const Session = require('../src/models/AttendanceSession');
  const Record = require('../src/models/AttendanceRecord');

  await User.deleteMany({ email: /@atttest\.invalid$/ });
  const hash = await bcrypt.hash(PW, await bcrypt.genSalt(10));
  const mk = (n, e, r, d) => User.create({
    fullName: n, email: e, passwordHash: hash, role: r, department: d,
    status: 'ACTIVE', position: 'Member'
  });

  const admin = await mk('Att Admin', 'admin@atttest.invalid', 'ADMIN', 'Core Team');
  const head = await mk('Att Head', 'head@atttest.invalid', 'TEAM_HEAD', 'Event Team');
  const ev1 = await mk('Event One', 'e1@atttest.invalid', 'TEAM_MEMBER', 'Event Team');
  const pr1 = await mk('PR One', 'pr1@atttest.invalid', 'TEAM_MEMBER', 'PR Team');

  const login = async (e) => (await call('POST', '/auth/login', { body: { email: e, password: PW } })).json.token;
  const adminT = await login('admin@atttest.invalid');
  const headT = await login('head@atttest.invalid');
  const ev1T = await login('e1@atttest.invalid');
  const pr1T = await login('pr1@atttest.invalid');
  check('all four accounts sign in', Boolean(adminT && headT && ev1T && pr1T));

  // ------------------------------------------------------------- marking
  //
  // startSession reuses today's session if one exists, and this suite deletes
  // what it creates — which would destroy a real day's session. So the test
  // works on its own dated session that no real data can point at.
  const TEST_DATE = '1990-01-02';
  await Session.deleteMany({ date: TEST_DATE });
  const testSession = await Session.create({
    date: TEST_DATE,
    openedByUserId: admin._id,
    openedByName: admin.fullName,
    status: 'OPEN'
  });
  const sessionId = String(testSession._id);
  check('a dedicated test session exists', Boolean(sessionId));

  const open = await call('GET', '/attendance/session', { token: adminT });
  check('admin can open the marking session', open.status === 200, `${open.status}`);

  const marked = await call('POST', '/attendance/mark', {
    token: adminT,
    body: {
      sessionId,
      records: [
        { userId: String(ev1._id), status: 'PRESENT' },
        { userId: String(pr1._id), status: 'ABSENT' }
      ]
    }
  });
  check('admin marks two members', marked.status === 200 && marked.json.changed === 2,
    `${marked.status} ${JSON.stringify(marked.json)}`);

  // ------------------------------------------------- members cannot write
  const memberMark = await call('POST', '/attendance/mark', {
    token: ev1T, body: { sessionId, records: [{ userId: String(ev1._id), status: 'PRESENT' }] }
  });
  check('a member CANNOT mark attendance at all', memberMark.status === 403, `${memberMark.status}`);

  const memberSession = await call('GET', '/attendance/session', { token: ev1T });
  check('a member CANNOT open a marking session', memberSession.status === 403, `${memberSession.status}`);

  // A team head marking someone outside their team must be ignored server-side
  const crossMark = await call('POST', '/attendance/mark', {
    token: headT, body: { sessionId, records: [{ userId: String(pr1._id), status: 'PRESENT' }] }
  });
  check('a team head CANNOT mark another team', crossMark.status === 403, `${crossMark.status}`);

  const prRecord = await Record.findOne({ sessionId, userId: pr1._id });
  check('the cross-team mark did not change the stored value',
    prRecord.status === 'ABSENT', `stored ${prRecord.status}`);

  // ------------------------------------------------------ read visibility
  const asMember = await call('GET', '/attendance/my-records', { token: ev1T });
  check('a member sees ONLY their own records',
    asMember.json.scope === 'SELF' &&
    asMember.json.records.every(r => String(r.userId) === String(ev1._id)),
    `scope=${asMember.json.scope} rows=${asMember.json.records?.length}`);

  const asHead = await call('GET', '/attendance/my-records', { token: headT });
  check('a team head sees only their own team',
    asHead.json.scope === 'DEPARTMENT' &&
    asHead.json.records.every(r => r.department === 'Event Team'),
    `scope=${asHead.json.scope}`);

  const asAdmin = await call('GET', '/attendance/my-records', { token: adminT });
  check('an admin sees the organisation', asAdmin.json.scope === 'ORGANISATION');

  // ------------------------------------------------------------- history
  const correction = await call('POST', '/attendance/mark', {
    token: adminT, body: { sessionId, records: [{ userId: String(ev1._id), status: 'ABSENT' }] }
  });
  check('a correction is accepted', correction.status === 200, `${correction.status}`);

  const corrected = await Record.findOne({ sessionId, userId: ev1._id });
  check('the previous value is kept in history',
    corrected.history.length === 2 &&
    corrected.history[0].to === 'PRESENT' &&
    corrected.history[1].from === 'PRESENT' &&
    corrected.history[1].to === 'ABSENT',
    JSON.stringify(corrected.history));
  check('editCount records that it was changed', corrected.editCount === 1,
    `editCount=${corrected.editCount}`);
  check('who made the change is recorded',
    corrected.history[1].byName === 'Att Admin', corrected.history[1].byName);

  const noop = await call('POST', '/attendance/mark', {
    token: adminT, body: { sessionId, records: [{ userId: String(ev1._id), status: 'ABSENT' }] }
  });
  check('re-submitting the same value is not counted as a change',
    noop.json.changed === 0, JSON.stringify(noop.json));

  // -------------------------------------------------------- closing a day
  const memberClose = await call('PUT', `/attendance/sessions/${sessionId}/close`, {
    token: headT, body: {}
  });
  check('a team head CANNOT close a day', memberClose.status === 403, `${memberClose.status}`);

  const closed = await call('PUT', `/attendance/sessions/${sessionId}/close`, {
    token: adminT, body: {}
  });
  check('an admin can close a day', closed.status === 200, `${closed.status}`);

  const afterClose = await call('POST', '/attendance/mark', {
    token: adminT, body: { sessionId, records: [{ userId: String(ev1._id), status: 'PRESENT' }] }
  });
  check('a closed day rejects further changes', afterClose.status === 409, `${afterClose.status}`);

  const stillAbsent = await Record.findOne({ sessionId, userId: ev1._id });
  check('the closed day\'s value is unchanged', stillAbsent.status === 'ABSENT');

  const reopened = await call('PUT', `/attendance/sessions/${sessionId}/close`, {
    token: adminT, body: { reopen: true }
  });
  check('an admin can reopen a day', reopened.status === 200, `${reopened.status}`);

  // -------------------------------------------------------------- export
  const today = TEST_DATE;

  const adminExport = await call('GET', `/attendance/export?from=${today}&to=${today}`, { token: adminT });
  const mine = (adminExport.json.rows || []).filter(r => ['Event One', 'PR One'].includes(r.member));
  check('admin export returns both test members',
    adminExport.status === 200 && mine.length === 2,
    `${adminExport.status} count=${adminExport.json.count} mine=${mine.length}`);
  check('export carries a summary',
    typeof adminExport.json.summary?.members === 'number',
    JSON.stringify(adminExport.json.summary));

  const memberExport = await call('GET', `/attendance/export?from=${today}&to=${today}`, { token: ev1T });
  check('a member exporting gets ONLY their own row',
    memberExport.json.count === 1 && memberExport.json.rows[0].member === 'Event One',
    `count=${memberExport.json.count}`);
  check('a member cannot widen the export to others',
    memberExport.json.rows.every(r => r.member === 'Event One'));

  const headExport = await call('GET', `/attendance/export?from=${today}&to=${today}`, { token: headT });
  check('a team head exporting gets only their team',
    headExport.json.rows.every(r => r.department === 'Event Team'),
    JSON.stringify(headExport.json.rows.map(r => r.department)));

  const badRange = await call('GET', '/attendance/export?from=2026-12-01&to=2026-01-01', { token: adminT });
  check('a reversed range is rejected', badRange.status === 400, `${badRange.status}`);

  const badFormat = await call('GET', '/attendance/export?from=nonsense&to=2026-01-01', { token: adminT });
  check('a malformed date is rejected', badFormat.status === 400, `${badFormat.status}`);

  const empty = await call('GET', '/attendance/export?from=2020-01-01&to=2020-01-02', { token: adminT });
  check('an empty range returns zero rows, not an error',
    empty.status === 200 && empty.json.count === 0, `${empty.status}`);

  const noAuth = await call('GET', `/attendance/export?from=${today}&to=${today}`);
  check('export requires signing in', noAuth.status === 401, `${noAuth.status}`);

  // ------------------------------------------------------------ cleanup
  await Record.deleteMany({ userId: { $in: [ev1._id, pr1._id] } });
  // Only the suite's own dated session — never a real day's.
  await Session.deleteMany({ date: TEST_DATE });
  await User.deleteMany({ email: /@atttest\.invalid$/ });
  await mongoose.connection.db.collection('auditlogs').deleteMany({ actorEmail: /@atttest\.invalid$/ });
  console.log('\ncleaned up.');

  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
})().catch(async e => {
  console.error('crashed:', e.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
