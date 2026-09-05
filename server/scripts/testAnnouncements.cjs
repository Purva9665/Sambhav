/**
 * Exercises announcement unpublish / republish / delete against a running API.
 *   node scripts/testAnnouncements.cjs
 * Creates throwaway accounts and removes everything it made.
 */
require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PW = 'AnnTest12345!';

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
  const Announcement = require('../src/models/Announcement');

  await User.deleteMany({ email: /@anntest\.invalid$/ });
  const hash = await bcrypt.hash(PW, await bcrypt.genSalt(10));

  await User.create({ fullName: 'Ann Admin', email: 'a@anntest.invalid', passwordHash: hash,
    role: 'ADMIN', department: 'Core Team', status: 'ACTIVE' });
  await User.create({ fullName: 'Ann Member', email: 'm@anntest.invalid', passwordHash: hash,
    role: 'TEAM_MEMBER', department: 'PR Team', status: 'ACTIVE' });

  const login = async (e) => (await call('POST', '/auth/login', { body: { email: e, password: PW } })).json.token;
  const adminT = await login('a@anntest.invalid');
  const memberT = await login('m@anntest.invalid');
  check('accounts can sign in', Boolean(adminT && memberT));

  // Count relative to whatever is already there — this runs against the real
  // database, which has the club's own announcements in it.
  const baseMember = (await call('GET', '/announcements', { token: memberT })).json.count;
  const baseAdmin = (await call('GET', '/announcements?includeExpired=true', { token: adminT })).json.count;

  const created = await call('POST', '/announcements', {
    token: adminT,
    body: { title: 'Test notice', content: 'hello', channels: ['BANNER'], audienceType: 'ALL' }
  });
  const id = created.json.announcement?._id;
  check('announcement created', created.status === 201 && Boolean(id),
    `${created.status} ${JSON.stringify(created.json.message)}`);

  const count = async (token, q = '') => (await call('GET', `/announcements${q}`, { token })).json.count;

  check('member sees it while live', await count(memberT) === baseMember + 1,
    `expected ${baseMember + 1}, got ${await count(memberT)}`);

  const un = await call('PUT', `/announcements/${id}/unpublish`, { token: adminT, body: {} });
  check('admin can unpublish', un.status === 200, `${un.status} ${JSON.stringify(un.json.message)}`);
  check('member no longer sees it', await count(memberT) === baseMember,
    `expected ${baseMember}, got ${await count(memberT)}`);
  check('admin still sees it with includeExpired',
    await count(adminT, '?includeExpired=true') === baseAdmin + 1,
    `expected ${baseAdmin + 1}, got ${await count(adminT, '?includeExpired=true')}`);

  const stored = await Announcement.findById(id);
  check('the record survives unpublishing', Boolean(stored) && Boolean(stored.expiresAt));

  const re = await call('PUT', `/announcements/${id}/unpublish`, { token: adminT, body: { republish: true } });
  check('admin can publish it again', re.status === 200, `${re.status}`);
  check('member sees it again', await count(memberT) === baseMember + 1,
    `expected ${baseMember + 1}, got ${await count(memberT)}`);

  const memberUn = await call('PUT', `/announcements/${id}/unpublish`, { token: memberT, body: {} });
  check('a member cannot unpublish', memberUn.status === 403, `${memberUn.status}`);

  const memberDel = await call('DELETE', `/announcements/${id}`, { token: memberT });
  check('a member cannot delete', memberDel.status === 403, `${memberDel.status}`);

  const del = await call('DELETE', `/announcements/${id}`, { token: adminT });
  check('admin can delete', del.status === 200, `${del.status}`);
  check('it is gone for good', await Announcement.findById(id) === null);

  const missing = await call('DELETE', `/announcements/${id}`, { token: adminT });
  check('deleting a missing one gives 404', missing.status === 404, `${missing.status}`);

  await User.deleteMany({ email: /@anntest\.invalid$/ });
  await mongoose.connection.db.collection('auditlogs').deleteMany({ actorEmail: /@anntest\.invalid$/ });
  console.log('\ncleaned up.');

  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
})().catch(async e => {
  console.error('crashed:', e.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
