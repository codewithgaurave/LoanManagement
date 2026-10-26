const mongoose = require('mongoose');
require('dotenv').config();

const Admin = require('../src/models/Admin');
const Employee = require('../src/models/Employee');
const User = require('../src/models/User');

async function checkCurrentAccounts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- CONNECTED TO MONGODB ---');

    const admins = await Admin.find({}, 'name email role').lean();
    console.log('\n--- ADMINS ---');
    console.log(admins);

    const employees = await Employee.find({}, 'name email phone role department status').lean();
    console.log('\n--- EMPLOYEES / STAFF ---');
    console.log(employees);

    const users = await User.find({}, 'name email phone status isVerified').lean();
    console.log('\n--- APP USERS / CUSTOMERS ---');
    console.log(users);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkCurrentAccounts();
