require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function cleanDatabaseKeepSuperAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 20000,
    });
    console.log('Connected to MongoDB successfully!');

    const collections = await mongoose.connection.db.collections();
    console.log(`Found ${collections.length} collections in database.\n`);

    for (const col of collections) {
      const colName = col.collectionName;

      if (colName === 'admins') {
        // Keep ONLY superadmin
        const superAdminsCount = await col.countDocuments({ role: /superadmin/i });
        const nonSuperAdminsCount = await col.countDocuments({ role: { $not: /superadmin/i } });
        const res = await col.deleteMany({ role: { $not: /superadmin/i } });
        console.log(`[admins] Kept ${superAdminsCount} SuperAdmin(s). Removed ${res.deletedCount} non-superadmin accounts.`);
      } else if (colName === 'users') {
        // In users collection, if any superadmin exists keep it, otherwise delete all test customers/users
        const superUsers = await col.countDocuments({ role: /superadmin/i });
        const res = await col.deleteMany({ role: { $not: /superadmin/i } });
        console.log(`[users] Kept ${superUsers} SuperAdmin(s) if any. Removed ${res.deletedCount} users.`);
      } else {
        // Delete all data in leads, loans, employees, notifications, complaints, jobs, etc.
        const total = await col.countDocuments();
        if (total > 0) {
          await col.deleteMany({});
          console.log(`[${colName}] Cleared completely (${total} documents removed).`);
        } else {
          console.log(`[${colName}] Already empty (0 documents).`);
        }
      }
    }

    // Verify SuperAdmin status
    const Admin = require('./src/models/Admin');
    const remainingAdmins = await Admin.find({});
    console.log('\n--- VERIFYING REMAINING SUPERADMIN ACCOUNT(S) ---');
    console.log(remainingAdmins.map(a => ({ id: a._id, name: a.name, email: a.email, role: a.role })));

    console.log('\n>>> SUCCESS: All data cleared from database, SuperAdmin safely retained! <<<');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
}

cleanDatabaseKeepSuperAdmin();
