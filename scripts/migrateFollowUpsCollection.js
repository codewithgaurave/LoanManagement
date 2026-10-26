const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  const database = mongoose.connection.db;
  const collections = (await database.listCollections().toArray()).map((item) => item.name);
  if (collections.includes('employeeFollowUps') && !collections.includes('followups')) {
    await database.collection('employeeFollowUps').rename('followups');
    console.log('Renamed employeeFollowUps to followups');
  }
  const count = await database.collection('followups').countDocuments();
  console.log(`followups collection records: ${count}`);
  await mongoose.disconnect();
}

migrate().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
