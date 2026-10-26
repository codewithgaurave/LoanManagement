require('dotenv').config();
const mongoose = require('mongoose');

async function seedRrmArm() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const Employee = require('./src/models/Employee');
    const HiringRequisition = require('./src/models/HiringRequisition');

    // 1. Check or update existing requisition in North Zone for RRM & ARM
    let northReq = await HiringRequisition.findOne({ zone: 'NORTH', role: { $in: ['RRM', 'ARM', 'RO'] } });
    if (northReq) {
      northReq.hiredCount = Math.max(northReq.hiredCount || 0, 2);
      northReq.status = 'Fulfilled';
      await northReq.save();
      console.log('Updated existing requisition to Fulfilled:', northReq.requestId || northReq._id);
    } else {
      const newReq = await HiringRequisition.create({
        zone: 'NORTH',
        role: 'RRM',
        requiredCount: 1,
        hiredCount: 1,
        priority: 'High',
        notes: 'Hired North Regional Reporting Manager & Area Reporting Manager',
        status: 'Fulfilled',
        requestedBy: 'Sales Head'
      });
      console.log('Created fulfilled hiring requisition:', newReq.requestId);
    }

    // 2. Create or update North RRM (Regional Reporting Manager)
    const rrmEmail = 'rrm.north@nuogm.com';
    let rrm = await Employee.findOne({ email: rrmEmail });

    if (rrm) {
      rrm.name = 'Vikram Malhotra';
      rrm.role = 'Regional Reporting Manager (RRM)';
      rrm.designation = 'Regional Reporting Manager (RRM)';
      rrm.zonalRole = 'RRM';
      rrm.zone = 'NORTH';
      rrm.department = 'Sales';
      rrm.isDepartmentHead = true;
      rrm.status = 'Active';
      rrm.password = 'RrmNorth@123'; // will be hashed by pre-save
      await rrm.save();
      console.log('Updated existing RRM:', rrm.email, rrm.empId);
    } else {
      rrm = new Employee({
        empId: 'EMP-RRM-01',
        name: 'Vikram Malhotra',
        email: rrmEmail,
        password: 'RrmNorth@123',
        mobile: '9810011223',
        role: 'Regional Reporting Manager (RRM)',
        designation: 'Regional Reporting Manager (RRM)',
        zonalRole: 'RRM',
        zone: 'NORTH',
        department: 'Sales',
        isDepartmentHead: true,
        status: 'Active',
        onboardingStatus: 'Done',
        city: 'Delhi NCR',
        district: 'New Delhi',
        state: 'Delhi',
        permissions: ['Sales Dashboard', 'Team Management', 'Leave Management', 'Attendance', 'File Approvals', 'Hold Cases']
      });
      await rrm.save();
      console.log('Created new North RRM:', rrm.email, rrm.empId);
    }

    // 3. Create or update North ARM (Area Reporting Manager)
    const armEmail = 'arm.delhi@nuogm.com';
    let arm = await Employee.findOne({ email: armEmail });

    if (arm) {
      arm.name = 'Rajesh Mehra';
      arm.role = 'Area Reporting Manager (ARM)';
      arm.designation = 'Area Reporting Manager (ARM)';
      arm.zonalRole = 'ARM';
      arm.zone = 'NORTH';
      arm.department = 'Sales';
      arm.rrmId = rrm._id;
      arm.rrmName = rrm.name;
      arm.status = 'Active';
      arm.password = 'ArmDelhi@123'; // will be hashed by pre-save
      await arm.save();
      console.log('Updated existing ARM:', arm.email, arm.empId);
    } else {
      arm = new Employee({
        empId: 'EMP-ARM-01',
        name: 'Rajesh Mehra',
        email: armEmail,
        password: 'ArmDelhi@123',
        mobile: '9810022334',
        role: 'Area Reporting Manager (ARM)',
        designation: 'Area Reporting Manager (ARM)',
        zonalRole: 'ARM',
        zone: 'NORTH',
        department: 'Sales',
        rrmId: rrm._id,
        rrmName: rrm.name,
        status: 'Active',
        onboardingStatus: 'Done',
        city: 'Delhi',
        district: 'Central Delhi',
        state: 'Delhi',
        permissions: ['Sales Dashboard', 'Team Management', 'Leave Management', 'Attendance']
      });
      await arm.save();
      console.log('Created new North ARM:', arm.email, arm.empId);
    }

    // 4. Also link existing North RM and RO leads to this RRM & ARM if available
    const Lead = require('./src/models/Lead');
    const updateLeads = await Lead.updateMany(
      { zone: 'NORTH' },
      { $set: { rrmName: rrm.name, armName: arm.name } }
    );
    console.log(`Updated ${updateLeads.modifiedCount} North leads with RRM (${rrm.name}) and ARM (${arm.name})`);

    console.log('\n--- SUCCESS SUMMARY ---');
    console.log('1. RRM Account:');
    console.log(`   Email: ${rrm.email}`);
    console.log(`   Password: RrmNorth@123`);
    console.log(`   Role in Dropdown: Regional Reporting Manager (RRM)`);
    console.log(`   Zone: NORTH`);
    console.log('2. ARM Account:');
    console.log(`   Email: ${arm.email}`);
    console.log(`   Password: ArmDelhi@123`);
    console.log(`   Role in Dropdown: Area Reporting Manager (ARM)`);
    console.log(`   Zone: NORTH (Reports to: ${rrm.name})`);
    console.log('------------------------\n');

  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
}

seedRrmArm();
