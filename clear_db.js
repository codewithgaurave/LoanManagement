require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log('Connected!');

    const collections = await mongoose.connection.db.collections();
    console.log(`Found ${collections.length} collections.`);

    for (const col of collections) {
      const count = await col.countDocuments();
      await col.deleteMany({});
      console.log(`Cleared: ${col.collectionName} (${count} items removed)`);
    }

    console.log('SUCCESS: All database collections have been cleared.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
