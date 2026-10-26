const mongoose = require('mongoose');
require('dotenv').config();
const Notification = require('../src/models/Notification');

async function deleteNotifications() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const res = await Notification.deleteMany({});
    console.log(`Successfully deleted ${res.deletedCount} notifications from database.`);
    const remaining = await Notification.countDocuments();
    console.log(`Remaining notifications in DB: ${remaining}`);
    process.exit(0);
  } catch (err) {
    console.error('Error deleting notifications:', err);
    process.exit(1);
  }
}

deleteNotifications();
