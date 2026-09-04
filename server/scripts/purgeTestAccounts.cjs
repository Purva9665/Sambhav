/**
 * Removes every user except the addresses listed in KEEP, plus the records
 * that belonged to them (attendance, leave, announcements they authored).
 *
 *   node scripts/purgeTestAccounts.cjs          # dry run, shows what would go
 *   node scripts/purgeTestAccounts.cjs --apply  # actually delete
 *
 * Run scripts/backup.cjs first. This cannot be undone without that backup.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const KEEP = ['purvakadam9637@gmail.com'];
const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  const keep = KEEP.map(e => e.toLowerCase());
  const doomed = await db.collection('users')
    .find({ email: { $nin: keep } }, { projection: { email: 1, fullName: 1, role: 1 } })
    .toArray();

  const kept = await db.collection('users')
    .find({ email: { $in: keep } }, { projection: { email: 1, fullName: 1, role: 1 } })
    .toArray();

  console.log(APPLY ? '=== APPLYING ===\n' : '=== DRY RUN (pass --apply to execute) ===\n');

  console.log('KEEPING:');
  kept.forEach(u => console.log(`  ${u.role.padEnd(12)} ${u.email}  (${u.fullName})`));
  if (kept.length !== keep.length) {
    console.error(`\nABORT: expected to keep ${keep.length} account(s) but matched ${kept.length}.`);
    console.error('Refusing to delete anything when the account to keep is missing.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\nDELETING ${doomed.length} account(s):`);
  doomed.forEach(u => console.log(`  ${u.role.padEnd(12)} ${u.email}  (${u.fullName})`));

  const ids = doomed.map(u => u._id);

  const dependants = [
    ['attendancerecords', { userId: { $in: ids } }],
    ['leaverequests', { userId: { $in: ids } }],
    ['announcements', { createdBy: { $in: ids } }],
    ['tasks', { assignedToUserId: { $in: ids } }],
    ['attendancesessions', { openedByUserId: { $in: ids } }]
  ];

  console.log('\nDependent records belonging to those accounts:');
  for (const [name, filter] of dependants) {
    console.log(`  ${name.padEnd(22)} ${await db.collection(name).countDocuments(filter)}`);
  }

  console.log('\nAudit logs are kept — they are the security trail and must survive.');

  if (!APPLY) {
    console.log('\nNothing changed. Re-run with --apply to execute.');
    await mongoose.disconnect();
    return;
  }

  for (const [name, filter] of dependants) {
    const r = await db.collection(name).deleteMany(filter);
    console.log(`  deleted ${String(r.deletedCount).padStart(3)} from ${name}`);
  }

  const r = await db.collection('users').deleteMany({ _id: { $in: ids } });
  console.log(`  deleted ${r.deletedCount} user(s)`);

  const remaining = await db.collection('users')
    .find({}, { projection: { email: 1, role: 1, status: 1 } }).toArray();
  console.log('\nRemaining users:');
  remaining.forEach(u => console.log(`  ${u.role.padEnd(12)} ${u.status.padEnd(20)} ${u.email}`));

  await mongoose.disconnect();
})().catch(err => { console.error('Failed:', err.message); process.exit(1); });
