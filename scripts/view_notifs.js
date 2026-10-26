const mongoose = require('mongoose');
require('dotenv').config();
const Notification = require('../src/models/Notification');

async function viewNotifs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const notifs = await Notification.find({}).lean();
    console.log(JSON.stringify(notifs, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

viewNotifs();
