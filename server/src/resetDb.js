/**
 * SAMBHAV Database Reset Script
 * Clears ALL collections except the default admin account.
 * Usage: node src/resetDb.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Announcement = require('./models/Announcement');
const AttendanceRecord = require('./models/AttendanceRecord');
const AttendanceSession = require('./models/AttendanceSession');
const AuditLog = require('./models/AuditLog');
const EmailLog = require('./models/EmailLog');
const LeaveRequest = require('./models/LeaveRequest');
const Project = require('./models/Project');
const Task = require('./models/Task');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sambhav_db';

async function resetDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[DB] Connected to MongoDB.\n');

    // 1. Drop all non-user collections
    const collections = [
      { model: Announcement, name: 'Announcements' },
      { model: AttendanceRecord, name: 'AttendanceRecords' },
      { model: AttendanceSession, name: 'AttendanceSessions' },
      { model: AuditLog, name: 'AuditLogs' },
      { model: EmailLog, name: 'EmailLogs' },
      { model: LeaveRequest, name: 'LeaveRequests' },
      { model: Project, name: 'Projects' },
      { model: Task, name: 'Tasks' },
    ];

    for (const { model, name } of collections) {
      const result = await model.deleteMany({});
      console.log(`[RESET] Cleared ${name}: ${result.deletedCount} documents deleted.`);
    }

    // 2. Delete all users EXCEPT default admin emails
    const adminEmail = (process.env.ADMIN_EMAIL || 'purvakadam9637@gmail.com').toLowerCase();
    const keepEmails = [adminEmail, 'purvakadam9665@gmail.com', 'purvakadam9637@gmail.com'];
    const userResult = await User.deleteMany({ email: { $nin: keepEmails } });
    console.log(`[RESET] Cleared non-admin Users: ${userResult.deletedCount} documents deleted.`);

    // 3. Re-sync admin credentials
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('Admin@123456', salt);

    for (const email of keepEmails) {
      let admin = await User.findOne({ email });
      if (admin) {
        admin.role = 'ADMIN';
        admin.status = 'ACTIVE';
        admin.passwordHash = passwordHash;
        await admin.save();
        console.log(`[SYNC] Admin confirmed: ${email}`);
      }
    }

    console.log('\n======================================================');
    console.log('[DONE] Database reset complete!');
    console.log('[ADMIN] Email: purvakadam9637@gmail.com');
    console.log('[ADMIN] Password: Admin@123456');
    console.log('======================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Reset failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

resetDatabase();
