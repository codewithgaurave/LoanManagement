const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' });
const Employee = require('./src/models/Employee');
const Admin = require('./src/models/Admin');

async function reset() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    const hashed = await bcrypt.hash('SalesHead@123', 10);
    const hashedSimple = await bcrypt.hash('password123', 10);

    // Update or insert Employee
    await Employee.updateOne(
      { email: 'saleshead@nuogm.com' },
      {
        $set: {
          name: 'Rajesh Sales Head',
          password: hashed,
          role: 'Sales Head',
          isActive: true,
          status: 'Active'
        }
      },
      { upsert: true }
    );

    await Employee.updateOne(
      { email: 'admin@sales.com' },
      {
        $set: {
          name: 'Sales Head Master',
          password: hashedSimple,
          role: 'Sales Head',
          isActive: true,
          status: 'Active'
        }
      },
      { upsert: true }
    );

    // Update or insert Admin collection as well (for universal login compatibility)
    await Admin.updateOne(
      { email: 'saleshead@nuogm.com' },
      {
        $set: {
          name: 'Rajesh Sales Head',
          password: hashed,
          role: 'saleshead',
          isActive: true
        }
      },
      { upsert: true }
    );

    await Admin.updateOne(
      { email: 'admin@sales.com' },
      {
        $set: {
          name: 'Sales Head Master',
          password: hashedSimple,
          role: 'saleshead',
          isActive: true
        }
      },
      { upsert: true }
    );

    console.log('Successfully updated Sales Head credentials in both Employee and Admin collections!');
    process.exit(0);
  } catch (err) {
    console.error('Reset error:', err);
    process.exit(1);
  }
}

reset();
