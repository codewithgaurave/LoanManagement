const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const clearDatabase = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI not found in environment variables");
    }

    console.log("Connecting to database...");
    await mongoose.connect(uri);
    console.log("Connected to MongoDB successfully.");

    const collections = await mongoose.connection.db.collections();
    console.log(`Found ${collections.length} collections.`);

    for (const collection of collections) {
      const count = await collection.countDocuments();
      await collection.deleteMany({});
      console.log(`Cleared collection: "${collection.collectionName}" (deleted ${count} documents)`);
    }

    console.log("\n--- All collections have been cleared successfully! ---");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error clearing database:", error);
    process.exit(1);
  }
};

clearDatabase();
