const mongoose = require('mongoose');
require('dotenv').config();
const Notification = require('../src/models/Notification');

async function checkNotifs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const count = await Notification.countDocuments();
    console.log(`Current Total Notifications in DB: ${count}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkNotifs();
