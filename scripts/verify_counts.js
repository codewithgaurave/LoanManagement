const mongoose = require('mongoose');
require('dotenv').config();
const Lead = require('../src/models/Lead');
const EmployeeRequest = require('../src/models/EmployeeRequest');

async function checkCollections() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const leadsCount = await Lead.countDocuments();
    const requestsCount = await EmployeeRequest.countDocuments();
    console.log(`Leads in DB: ${leadsCount}`);
    console.log(`Employee Requests in DB: ${requestsCount}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkCollections();
