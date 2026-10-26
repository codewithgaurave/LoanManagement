require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const seedOperationsManager = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/loan_management';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const opsEmail = 'ops.manager@nuohaus.com';
    let opsUser = await Admin.findOne({ email: opsEmail });

    if (opsUser) {
      opsUser.name = 'Vikram Malhotra (Operations Head)';
      opsUser.role = 'Operation Admin';
      opsUser.subRole = 'Operation Manager';
      opsUser.zonalRole = 'Operation Manager';
      opsUser.zone = 'ALL';
      opsUser.password = 'Admin@123'; // will be hashed by pre('save')
      opsUser.status = 'Active';
      opsUser.permissions = [
        'Operations Portal',
        'Operation Dashboard',
        'Loan Applications',
        'Lead Management',
        'Status Management',
        'Application Verification',
        'Document Verification',
        'Follow-Up Management',
        'View Dashboard',
        'Reports & Analytics',
        'Verify Documents',
        'Approve/Reject/Hold Loan'
      ];
      await opsUser.save();
      console.log('Updated existing Operation Manager user.');
    } else {
      opsUser = await Admin.create({
        name: 'Vikram Malhotra (Operations Head)',
        email: opsEmail,
        password: 'Admin@123',
        role: 'Operation Admin',
        subRole: 'Operation Manager',
        zonalRole: 'Operation Manager',
        zone: 'ALL',
        status: 'Active',
        permissions: [
          'Operations Portal',
          'Operation Dashboard',
          'Loan Applications',
          'Lead Management',
          'Status Management',
          'Application Verification',
          'Document Verification',
          'Follow-Up Management',
          'View Dashboard',
          'Reports & Analytics',
          'Verify Documents',
          'Approve/Reject/Hold Loan'
        ]
      });
      console.log('Created new Operation Manager user.');
    }

    console.log('=============================================');
    console.log('   OPERATIONS MANAGER (ALL ZONES) CREDENTIALS');
    console.log('=============================================');
    console.log('Email:    ops.manager@nuohaus.com');
    console.log('Password: Admin@123');
    console.log('Role:     Operation Admin');
    console.log('Zone:     ALL (Manages leads from North, South, East, West, Central)');
    console.log('=============================================');

    process.exit(0);
  } catch (err) {
    console.error('Error seeding Ops Manager:', err);
    process.exit(1);
  }
};

seedOperationsManager();
