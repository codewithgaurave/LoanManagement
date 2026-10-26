require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Admin = require('./src/models/Admin');
    const Employee = require('./src/models/Employee');

    const admins = await Admin.find({}).select('name email role');
    console.log('--- ADMINS ---');
    console.log(admins);

    const emps = await Employee.find({ email: /sales/i }).select('name email role designation password');
    console.log('--- SALES EMPLOYEES ---');
    console.log(emps);

    await mongoose.disconnect();
  } catch (e) {
    console.error(e);
  }
}

checkUsers();
