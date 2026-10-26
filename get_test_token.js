require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Admin = require('./src/models/Admin');
  const Employee = require('./src/models/Employee');

  const admin = await Admin.findOne({ email: 'admin@superadmin.com' });
  const emp = await Employee.findOne({ email: 'admin@sales.com' });

  console.log('SuperAdmin found:', !!admin);
  console.log('Sales emp found:', !!emp);

  if (admin) {
    const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('SuperAdmin token generated:');
    console.log(token);
  }

  if (emp) {
    const token = jwt.sign({ id: emp._id, role: emp.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('Sales Head token generated:');
    console.log(token);
  }

  await mongoose.disconnect();
}

check();
