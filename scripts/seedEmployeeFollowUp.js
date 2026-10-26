const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Employee = require('../src/models/Employee');
const EmployeeFollowUp = require('../src/models/EmployeeFollowUp');

const employeeId = process.argv[2] || 'NuoGM-EMP-2026-3395';

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  const employee = await Employee.findOne({ empId: employeeId });
  if (!employee) throw new Error(`Employee not found: ${employeeId}`);

  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + 1);
  scheduledAt.setHours(11, 0, 0, 0);

  const followUp = await EmployeeFollowUp.create({
    leadName: 'Demo Customer',
    leadId: 'NuoGM-LD-DEMO-001',
    mobile: '0000000000',
    type: 'Call',
    purpose: 'Initial Discussion',
    scheduledAt,
    reminder: '10 min before',
    notes: 'Follow-up created for employee panel testing.',
    assignedToId: employee._id.toString(),
    assignedToName: employee.name,
    createdById: employee._id.toString(),
    createdByName: employee.name,
    createdByRole: employee.role
  });

  console.log(JSON.stringify({ success: true, employeeId, followUp }, null, 2));
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
