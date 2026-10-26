require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const User = require('../src/models/User');

const seedRrm = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected...');

    const email = 'rrm.north@nuog.com';
    const password = 'Password@123';
    const name = 'Rajesh Verma (RRM - North)';
    const role = 'rrm';
    const zone = 'NORTH';

    // 1. Create/Update in Admin model (used by Admin login / auth)
    let adminUser = await Admin.findOne({ email });
    if (adminUser) {
      adminUser.name = name;
      adminUser.password = password;
      adminUser.role = role;
      adminUser.subRole = 'RRM';
      adminUser.zone = zone;
      adminUser.status = 'Active';
      await adminUser.save();
      console.log('Updated existing Admin record for RRM');
    } else {
      adminUser = new Admin({
        name,
        email,
        password,
        role,
        subRole: 'RRM',
        zone,
        status: 'Active'
      });
      await adminUser.save();
      console.log('Created new Admin record for RRM');
    }

    // 2. Also ensure in User collection if needed
    let staffUser = await User.findOne({ email });
    if (staffUser) {
      staffUser.name = name;
      staffUser.password = password;
      staffUser.role = 'RRM';
      staffUser.zone = zone;
      staffUser.designation = 'Regional Reporting Manager (RRM)';
      staffUser.department = 'Sales & Regional';
      staffUser.status = 'Active';
      await staffUser.save();
      console.log('Updated User collection record for RRM');
    } else {
      staffUser = new User({
        name,
        email,
        mobile: '9876543210',
        password,
        role: 'RRM',
    }

    console.log('✅ RRM Admin credentials configured successfully in MongoDB!');
    console.log('----------------------------------------------------');
    console.log('Email   : rrm.north@nuog.com');
    console.log('Password: Password@123');
    console.log('Role    : rrm');
    console.log('Zone    : NORTH');
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding RRM:', err);
    process.exit(1);
  }
};

seedRrm();
