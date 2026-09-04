/**
 * Export and prune the audit trail.
 *
 *   node scripts/auditLogs.cjs stats
 *   node scripts/auditLogs.cjs export [--days 90] [--out DIR]
 *   node scripts/auditLogs.cjs purge  [--days 90] [--apply]
 *   node scripts/auditLogs.cjs archive [--days 90] [--apply]   # export then purge
 *
 * `--days N` means "older than N days". Omitting it means everything.
 * Nothing is deleted without --apply. `archive` will not purge unless the
 * export file was written successfully first.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const command = argv[0] || 'stats';
const APPLY = argv.includes('--apply');

const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const days = flag('days') ? Number(flag('days')) : null;
const outDir = path.resolve(flag('out', path.join(__dirname, '..', 'audit-exports')));

const cutoff = days ? new Date(Date.now() - days * 86400000) : null;
const filter = cutoff ? { timestamp: { $lt: cutoff } } : {};

const csvCell = (v) => {
  const s = v === null || v === undefined
    ? ''
    : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const logs = mongoose.connection.db.collection('auditlogs');

  const total = await logs.countDocuments();
  const matching = await logs.countDocuments(filter);

  console.log(`Audit log: ${total} document(s) total.`);
  if (cutoff) {
    console.log(`Older than ${days} day(s) (before ${cutoff.toISOString().slice(0, 10)}): ${matching}`);
  }

  if (command === 'stats') {
    const byAction = await logs.aggregate([
      { $group: { _id: '$action', n: { $sum: 1 } } },
      { $sort: { n: -1 } }
    ]).toArray();

    console.log('\nBy action:');
    byAction.forEach(a => console.log(`  ${String(a._id).padEnd(26)} ${a.n}`));

    const oldest = await logs.find({}).sort({ timestamp: 1 }).limit(1).toArray();
    const newest = await logs.find({}).sort({ timestamp: -1 }).limit(1).toArray();
    if (oldest[0]) {
      console.log(`\nOldest: ${oldest[0].timestamp.toISOString()}`);
      console.log(`Newest: ${newest[0].timestamp.toISOString()}`);
    }

    const stats = await mongoose.connection.db.command({ collStats: 'auditlogs' }).catch(() => null);
    if (stats) {
      console.log(`\nStorage: ${(stats.size / 1024).toFixed(1)} KB in documents, ` +
                  `${(stats.totalIndexSize / 1024).toFixed(1)} KB in indexes`);
      console.log(`Average document: ${Math.round(stats.avgObjSize || 0)} bytes`);
    }

    await mongoose.disconnect();
    return;
  }

  let exportedFile = null;

  if (command === 'export' || command === 'archive') {
    if (matching === 0) {
      console.log('\nNothing to export.');
    } else {
      fs.mkdirSync(outDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const base = path.join(outDir, `auditlogs-${stamp}`);

      const docs = await logs.find(filter).sort({ timestamp: 1 }).toArray();

      fs.writeFileSync(`${base}.json`, JSON.stringify(docs, null, 2));

      const columns = ['timestamp', 'action', 'actorEmail', 'actorRole',
                       'targetResource', 'ipAddress', 'userAgent', 'details'];
      const csv = [
        columns.join(','),
        ...docs.map(d => columns.map(c => csvCell(d[c])).join(','))
      ].join('\n');
      fs.writeFileSync(`${base}.csv`, csv);

      exportedFile = `${base}.json`;
      console.log(`\nExported ${docs.length} document(s):`);
      console.log(`  ${base}.json`);
      console.log(`  ${base}.csv`);
    }
  }

  if (command === 'purge' || command === 'archive') {
    // Never delete what was not safely written first.
    if (command === 'archive' && matching > 0 && !exportedFile) {
      console.error('\nExport did not complete — refusing to purge.');
      await mongoose.disconnect();
      process.exit(1);
    }

    if (!APPLY) {
      console.log(`\nWould delete ${matching} document(s). Re-run with --apply.`);
      await mongoose.disconnect();
      return;
    }

    const res = await logs.deleteMany(filter);
    console.log(`\nDeleted ${res.deletedCount} document(s).`);
    console.log(`Remaining: ${await logs.countDocuments()}`);
  }

  await mongoose.disconnect();
})().catch(err => { console.error('Failed:', err.message); process.exit(1); });
