require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function testCluster() {
  await mongoose.connect(process.env.MONGODB_URI);
  const adminDb = mongoose.connection.db.admin();
  const dbs = await adminDb.listDatabases();
  console.log('Databases on this cluster:');
  for (const d of dbs.databases) {
    console.log(`- ${d.name} (${(d.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
  }
  await mongoose.disconnect();
}

testCluster();
