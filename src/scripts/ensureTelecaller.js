require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const Admin = require('../models/Admin');

async function ensureTelecaller() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const telecallerData = {
      empId: 'EMP-TC101',
      name: 'Pooja Sharma (Telecaller)',
      email: 'telecaller@loanmg.com',
      password: hashedPassword,
      mobile: '9876543210',
      role: 'Telecaller',
      zonalRole: 'Telecaller',
      designation: 'Telecaller Executive',
      department: 'Sales & Calling',
      zone: 'NORTH',
      status: 'Active',
      onboardingStatus: 'Done',
      isLateLocked: false,
      permissions: [
        'Telecaller Portal',
        'Assigned Leads',
        'Customer Follow-ups',
        'My Followups',
        'Lead Management',
        'Notifications'
      ]
    };

    let emp = await Employee.findOne({ email: telecallerData.email });
    if (emp) {
      emp.password = hashedPassword;
      emp.role = 'Telecaller';
      emp.status = 'Active';
      emp.isLateLocked = false;
      await emp.save();
      console.log('Existing Telecaller account password updated to admin123');
    } else {
      await Employee.create(telecallerData);
      console.log('Created new Telecaller account: telecaller@loanmg.com');
    }

    // Also sync to Admin collection for fallback auth
    await Admin.updateOne(
      { email: telecallerData.email },
      { 
        $set: {
          name: telecallerData.name,
          email: telecallerData.email,
          password: hashedPassword,
          role: 'Telecaller',
          zone: 'NORTH',
          permissions: telecallerData.permissions
        }
      },
      { upsert: true }
    );
    console.log('Admin collection synced successfully');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

ensureTelecaller();
