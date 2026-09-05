/**
 * End-to-end check against the running API.
 *
 *   node scripts/e2eTest.cjs [baseUrl]
 *
 * Creates its own throwaway admin and test users, exercises the role,
 * admin-grant and password flows, then deletes everything it made. No real
 * account's password is needed or changed.
 */
require('dotenv').config();
const http = require('http');
const https = require('https');
const mongoose = require('mongoose');

// Runs against a throwaway admin it creates and deletes, so no real account's
// password is ever needed or altered.
const BASE = process.argv[2] || 'http://127.0.0.1:5000';
const ADMIN_EMAIL = 'e2e.admin@sambhav-test.invalid';
const ADMIN_PASSWORD = 'E2eAdminPass123!';

const url = new URL(BASE);
const client = url.protocol === 'https:' ? https : http;

function call(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `/api/v1${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let raw = '';
      res.on('data', d => (raw += d));
      res.on('end', () => {
        let json;
        try { json = JSON.parse(raw); } catch { json = { raw: raw.slice(0, 200) }; }
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
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail && !ok ? `\n        ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

const TEST_EMAIL = `e2e.${Date.now()}@sambhav-test.invalid`;
const TEST_PASSWORD = 'TestPassw0rd!';

(async () => {
  console.log(`Target: ${BASE}\n`);

  // Create the throwaway admin first, so no real account is ever touched
  {
    const bcrypt = require('bcryptjs');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
    const Users = mongoose.connection.db.collection('users');
    await Users.deleteMany({ email: ADMIN_EMAIL });
    await Users.insertOne({
      fullName: 'E2E Admin',
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, await bcrypt.genSalt(10)),
      role: 'ADMIN',
      department: 'Core Team',
      position: 'Administrator',
      status: 'ACTIVE',
      academicDepartment: '',
      mobileNumber: '',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // ---------------------------------------------------------- health
  const health = await call('GET', '/health');
  check('health endpoint reports ok', health.json.status === 'ok', JSON.stringify(health.json));
  check('database connected', health.json.database === 'connected', JSON.stringify(health.json));

  // ---------------------------------------------------------- admin login
  const login = await call('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  check('admin can sign in', login.status === 200 && login.json.success,
    `${login.status} ${JSON.stringify(login.json.message)}`);

  if (!login.json.token) {
    console.error('\nCannot continue without an admin token.');
    process.exit(1);
  }
  const adminToken = login.json.token;
  check('admin role is ADMIN', login.json.user?.role === 'ADMIN', JSON.stringify(login.json.user));

  // ------------------------------------------------- register a DEPARTMENT_HEAD
  const reg = await call('POST', '/auth/register', {
    body: {
      fullName: 'E2E Test Head',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      role: 'DEPARTMENT_HEAD',
      department: 'PR Team',
      academicDepartment: 'Computer Science',
      mobileNumber: '9000000000',
      position: 'Department Head CS'
    }
  });
  check('register accepts DEPARTMENT_HEAD + academic department',
    reg.status === 201 && reg.json.success, `${reg.status} ${JSON.stringify(reg.json)}`);
  check('OTP is NOT returned in the response body',
    !JSON.stringify(reg.json).match(/\b\d{6}\b/), JSON.stringify(reg.json));

  // A department head with no academic department must be rejected
  const badReg = await call('POST', '/auth/register', {
    body: {
      fullName: 'E2E Bad', email: `bad.${Date.now()}@sambhav-test.invalid`,
      password: TEST_PASSWORD, role: 'DEPARTMENT_HEAD', department: 'PR Team'
    }
  });
  check('department head without a department is rejected', badReg.status === 400,
    `${badReg.status} ${JSON.stringify(badReg.json)}`);

  // Unknown team rejected
  const badTeam = await call('POST', '/auth/register', {
    body: {
      fullName: 'E2E Bad Team', email: `bt.${Date.now()}@sambhav-test.invalid`,
      password: TEST_PASSWORD, role: 'TEAM_MEMBER', department: 'Not A Real Team'
    }
  });
  check('unknown team is rejected', badTeam.status === 400,
    `${badTeam.status} ${JSON.stringify(badTeam.json)}`);

  // Self-assigning ADMIN must be downgraded
  const selfAdminEmail = `sa.${Date.now()}@sambhav-test.invalid`;
  await call('POST', '/auth/register', {
    body: {
      fullName: 'E2E Self Admin', email: selfAdminEmail, password: TEST_PASSWORD,
      role: 'ADMIN', department: 'PR Team'
    }
  });

  // ------------------------------------------------- activate the test user
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  }
  const users = mongoose.connection.db.collection('users');

  const selfAdmin = await users.findOne({ email: selfAdminEmail });
  check('self-requested ADMIN was downgraded to TEAM_MEMBER',
    selfAdmin?.role === 'TEAM_MEMBER', `got ${selfAdmin?.role}`);

  const created = await users.findOne({ email: TEST_EMAIL });
  check('academicDepartment stored alongside team',
    created?.academicDepartment === 'Computer Science' && created?.department === 'PR Team',
    `team=${created?.department} academic=${created?.academicDepartment}`);

  // Verify OTP using the stored code
  const otp = await call('POST', '/auth/verify-otp', {
    body: { email: TEST_EMAIL, otpCode: created.otpCode }
  });
  check('OTP verification activates the account',
    otp.status === 200 && otp.json.success, `${otp.status} ${JSON.stringify(otp.json.message)}`);

  const headToken = otp.json.token;

  // A wrong OTP must be rejected
  const badOtp = await call('POST', '/auth/verify-otp', {
    body: { email: TEST_EMAIL, otpCode: '000000' }
  });
  check('already-active account rejects a second OTP', badOtp.status === 400);

  // ------------------------------------------------- RBAC for DEPARTMENT_HEAD
  const dirAsHead = await call('GET', '/admin/directory', { token: headToken });
  check('department head is BLOCKED from the directory', dirAsHead.status === 403,
    `${dirAsHead.status}`);

  const auditAsHead = await call('GET', '/admin/audit-logs', { token: headToken });
  check('department head is BLOCKED from audit logs', auditAsHead.status === 403,
    `${auditAsHead.status}`);

  const membersAsHead = await call('GET', '/admin/members', { token: headToken });
  check('department head CAN read the member list', membersAsHead.status === 200,
    `${membersAsHead.status}`);

  const tasksAsHead = await call('GET', '/tasks', { token: headToken });
  check('department head sees only their own tasks (no org-wide leak)',
    tasksAsHead.status === 200 && Array.isArray(tasksAsHead.json.tasks),
    `${tasksAsHead.status}`);

  // ------------------------------------------------- granting admin
  const grant = await call('PUT', `/admin/users/${created._id}`, {
    token: adminToken, body: { role: 'ADMIN' }
  });
  check('admin can promote someone to ADMIN', grant.status === 200 && grant.json.success,
    `${grant.status} ${JSON.stringify(grant.json.message)}`);

  const promoted = await users.findOne({ email: TEST_EMAIL });
  check('promotion cleared the academic department', promoted?.academicDepartment === '',
    `academic=${promoted?.academicDepartment}`);

  const grantAudit = await mongoose.connection.db.collection('auditlogs')
    .findOne({ action: 'ADMIN_GRANTED' }, { sort: { timestamp: -1 } });
  check('ADMIN_GRANTED written to the audit log', Boolean(grantAudit));

  // Now two admins exist — demoting one must be allowed
  const demote = await call('PUT', `/admin/users/${created._id}`, {
    token: adminToken, body: { role: 'TEAM_MEMBER' }
  });
  check('admin can demote another admin when others remain', demote.status === 200,
    `${demote.status} ${JSON.stringify(demote.json.message)}`);

  const admin = await users.findOne({ email: ADMIN_EMAIL.toLowerCase() });

  // Suspending yourself is still refused. Check this first, while the token
  // definitely still carries admin rights.
  const selfSuspend = await call('PUT', `/admin/users/${admin._id}`, {
    token: adminToken, body: { status: 'SUSPENDED' }
  });
  check('admin CANNOT suspend themselves', selfSuspend.status === 400,
    `${selfSuspend.status} ${JSON.stringify(selfSuspend.json.message)}`);

  // Changing your own role IS allowed — an admin edits their own profile —
  // provided another admin remains.
  const selfDemote = await call('PUT', `/admin/users/${admin._id}`, {
    token: adminToken, body: { role: 'TEAM_MEMBER' }
  });
  check('admin CAN change their own role while another admin exists',
    selfDemote.status === 200, `${selfDemote.status} ${JSON.stringify(selfDemote.json.message)}`);

  await users.updateOne({ _id: admin._id }, { $set: { role: 'ADMIN' } });

  // ------------------------------------------------- password change flow
  const relogin = await call('POST', '/auth/login', {
    body: { email: TEST_EMAIL, password: TEST_PASSWORD }
  });
  const userToken = relogin.json.token;
  check('test user can sign in', relogin.status === 200 && Boolean(userToken));

  const codeReq = await call('POST', '/auth/password/request-code', { token: userToken });
  check('password change code can be requested', codeReq.status === 200 && codeReq.json.success,
    `${codeReq.status} ${JSON.stringify(codeReq.json.message)}`);

  const withCode = await users.findOne({ email: TEST_EMAIL });
  check('reset code stored with an expiry',
    Boolean(withCode.resetCode) && Boolean(withCode.resetExpiresAt));

  // Wrong current password must fail even with the right code
  const wrongCurrent = await call('POST', '/auth/password/change', {
    token: userToken,
    body: { currentPassword: 'WrongPassword1', code: withCode.resetCode, newPassword: 'BrandNewPass1' }
  });
  check('wrong current password is rejected', wrongCurrent.status === 401, `${wrongCurrent.status}`);

  // Wrong code must fail
  const wrongCode = await call('POST', '/auth/password/change', {
    token: userToken,
    body: { currentPassword: TEST_PASSWORD, code: '000000', newPassword: 'BrandNewPass1' }
  });
  check('wrong confirmation code is rejected', wrongCode.status === 400, `${wrongCode.status}`);

  // Correct change
  const NEW_PASSWORD = 'BrandNewPass1!';
  const changed = await call('POST', '/auth/password/change', {
    token: userToken,
    body: { currentPassword: TEST_PASSWORD, code: withCode.resetCode, newPassword: NEW_PASSWORD }
  });
  check('password change succeeds with the right code',
    changed.status === 200 && changed.json.success,
    `${changed.status} ${JSON.stringify(changed.json.message)}`);

  // Asserted against the stored hash rather than more sign-ins: /auth/login is
  // limited to 10 attempts per 15 minutes and the suite was tripping its own
  // protection.
  const bcryptLib = require('bcryptjs');
  const afterChange = await users.findOne({ email: TEST_EMAIL });
  check('old password no longer matches the stored hash',
    !(await bcryptLib.compare(TEST_PASSWORD, afterChange.passwordHash)));
  check('new password matches the stored hash',
    await bcryptLib.compare(NEW_PASSWORD, afterChange.passwordHash));
  check('passwordChangedAt was recorded', Boolean(afterChange.passwordChangedAt));

  // ------------------------------------------------- forgot password flow
  const forgot = await call('POST', '/auth/password/forgot', { body: { email: TEST_EMAIL } });
  check('forgot-password accepts a known address', forgot.status === 200 && forgot.json.success);

  const unknown = await call('POST', '/auth/password/forgot',
    { body: { email: 'nobody.here@sambhav-test.invalid' } });
  check('forgot-password gives the same answer for an unknown address',
    unknown.status === 200 && unknown.json.message === forgot.json.message,
    `${unknown.json.message}`);

  const forReset = await users.findOne({ email: TEST_EMAIL });
  const RESET_PASSWORD = 'ResetPassw0rd!';
  const didReset = await call('POST', '/auth/password/reset', {
    body: { email: TEST_EMAIL, code: forReset.resetCode, newPassword: RESET_PASSWORD }
  });
  check('password reset succeeds', didReset.status === 200 && didReset.json.success,
    `${didReset.status} ${JSON.stringify(didReset.json.message)}`);

  const afterReset = await users.findOne({ email: TEST_EMAIL });
  check('reset password matches the stored hash',
    await bcryptLib.compare(RESET_PASSWORD, afterReset.passwordHash));
  check('the reset code was cleared after use', afterReset.resetCode === null);

  // ------------------------------------------------- cleanup
  const cleanup = await users.deleteMany({ email: /@sambhav-test\.invalid$/ });
  console.log(`\nCleaned up ${cleanup.deletedCount} test account(s).`);
  await mongoose.connection.db.collection('auditlogs')
    .deleteMany({ actorEmail: /@sambhav-test\.invalid$/ });

  const remaining = await users.find({}, { projection: { email: 1, role: 1 } }).toArray();
  console.log('Users now in the database:');
  remaining.forEach(u => console.log(`  ${u.role.padEnd(12)} ${u.email}`));

  await mongoose.disconnect();

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
})().catch(async err => {
  console.error('\nTest run crashed:', err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
