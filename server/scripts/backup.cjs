/**
 * Full read-only backup of every collection to timestamped JSON.
 *
 *   node scripts/backup.cjs [outputDir]
 *
 * Run this before any destructive operation. Restore with scripts/restore.cjs.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = path.resolve(
    process.argv[2] || path.join(__dirname, '..', 'backups'),
    new Date().toISOString().replace(/[:.]/g, '-')
  );

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  fs.mkdirSync(outDir, { recursive: true });

  const names = (await db.listCollections().toArray()).map(c => c.name).sort();
  const manifest = { takenAt: new Date().toISOString(), database: db.databaseName, collections: {} };

  for (const name of names) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(docs, null, 2));
    manifest.collections[name] = docs.length;
    console.log(`  ${name.padEnd(22)} ${docs.length} document(s)`);
  }

  fs.writeFileSync(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nBackup written to:\n  ${outDir}`);

  await mongoose.disconnect();
})().catch(err => { console.error('Backup failed:', err.message); process.exit(1); });
