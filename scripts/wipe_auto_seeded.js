const mongoose = require('mongoose');
require('dotenv').config();
const Notification = require('../src/models/Notification');
const Lead = require('../src/models/Lead');
const LoanApplication = require('../src/models/LoanApplication');

async function wipeAutoSeeded() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const n = await Notification.deleteMany({});
    console.log(`Deleted notifications: ${n.deletedCount}`);
    const l = await Lead.deleteMany({});
    console.log(`Deleted leads: ${l.deletedCount}`);
    const a = await LoanApplication.deleteMany({});
    console.log(`Deleted loan apps: ${a.deletedCount}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

wipeAutoSeeded();
