/**
 * Deletes EVERY user account and all data tied to accounts, so the portal can
 * be bootstrapped from zero.
 *
 *   node scripts/wipeAllAccounts.cjs          # dry run
 *   node scripts/wipeAllAccounts.cjs --apply  # actually delete
 *
 * Run scripts/backup.cjs first. After applying, no one can sign in until the
 * server recreates the first administrator from ADMIN_EMAIL +
 * ADMIN_INITIAL_PASSWORD on its next start.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

// Everything here is account-scoped data. Audit logs are kept deliberately:
// they are the security trail, and wiping them would erase the record of this
// very operation.
const COLLECTIONS = [
  'users',
  'attendancerecords',
  'attendancesessions',
  'leaverequests',
  'announcements',
  'tasks',
  'projects',
  'emaillogs'
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  console.log(APPLY ? '=== APPLYING ===\n' : '=== DRY RUN (pass --apply to execute) ===\n');

  for (const name of COLLECTIONS) {
    const n = await db.collection(name).countDocuments();
    console.log(`  ${name.padEnd(22)} ${n} document(s)${APPLY ? ' -> deleting' : ''}`);
  }

  const auditCount = await db.collection('auditlogs').countDocuments();
  console.log(`\n  auditlogs              ${auditCount} document(s) -> KEPT (security trail)`);

  if (!APPLY) {
    console.log('\nNothing changed. Re-run with --apply to execute.');
    await mongoose.disconnect();
    return;
  }

  let total = 0;
  for (const name of COLLECTIONS) {
    const r = await db.collection(name).deleteMany({});
    total += r.deletedCount;
    console.log(`  deleted ${String(r.deletedCount).padStart(4)} from ${name}`);
  }

  console.log(`\n${total} document(s) deleted. Users remaining: ${await db.collection('users').countDocuments()}`);
  console.log('\nNext: set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD, then restart the');
  console.log('server. It will create the first administrator automatically.');

  await mongoose.disconnect();
})().catch(err => { console.error('Failed:', err.message); process.exit(1); });
