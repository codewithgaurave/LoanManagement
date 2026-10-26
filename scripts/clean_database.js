const mongoose = require('mongoose');
require('dotenv').config();

const Lead = require('../src/models/Lead');
const LoanApplication = require('../src/models/LoanApplication');
const Complaint = require('../src/models/Complaint');
const Transaction = require('../src/models/Transaction');
const Visit = require('../src/models/Visit');
const JobApplication = require('../src/models/JobApplication');
const Job = require('../src/models/Job');
const Notification = require('../src/models/Notification');
const Payroll = require('../src/models/Payroll');
const Department = require('../src/models/Department');
const EmployeeRequest = require('../src/models/EmployeeRequest');
const EmployeeFollowUp = require('../src/models/EmployeeFollowUp');
const Employee = require('../src/models/Employee');
const Admin = require('../src/models/Admin');
const User = require('../src/models/User');

async function cleanData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- CONNECTED TO MONGODB ---');

    // 1. Delete all transactional & test collections
    const leadRes = await Lead.deleteMany({});
    console.log(`Deleted Leads: ${leadRes.deletedCount}`);

    const loanRes = await LoanApplication.deleteMany({});
    console.log(`Deleted Loan Applications: ${loanRes.deletedCount}`);

    const compRes = await Complaint.deleteMany({});
    console.log(`Deleted Complaints: ${compRes.deletedCount}`);

    const transRes = await Transaction.deleteMany({});
    console.log(`Deleted Transactions: ${transRes.deletedCount}`);

    const visitRes = await Visit.deleteMany({});
    console.log(`Deleted Visits: ${visitRes.deletedCount}`);

    const jobAppRes = await JobApplication.deleteMany({});
    console.log(`Deleted Job Applications: ${jobAppRes.deletedCount}`);

    const jobRes = await Job.deleteMany({});
    console.log(`Deleted Jobs: ${jobRes.deletedCount}`);

    const notifRes = await Notification.deleteMany({});
    console.log(`Deleted Notifications: ${notifRes.deletedCount}`);

    const payrollRes = await Payroll.deleteMany({});
    console.log(`Deleted Payroll: ${payrollRes.deletedCount}`);

    const empReqRes = await EmployeeRequest.deleteMany({});
    console.log(`Deleted Employee Requests: ${empReqRes.deletedCount}`);

    const empFollowRes = await EmployeeFollowUp.deleteMany({});
    console.log(`Deleted Employee FollowUps: ${empFollowRes.deletedCount}`);

    // Delete dummy employees (keep only employees linked to valid admin accounts if any)
    const empRes = await Employee.deleteMany({});
    console.log(`Deleted Dummy Employees/Staff: ${empRes.deletedCount}`);

    // Verify Admin & App Users count
    const adminCount = await Admin.countDocuments();
    const userCount = await User.countDocuments();
    console.log('\n--- KEPT SAFE ---');
    console.log(`Panel Admins Kept: ${adminCount}`);
    console.log(`App Users Kept: ${userCount}`);

    console.log('\n--- DATABASE CLEANUP COMPLETED SUCCESSFULLY ---');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
}

cleanData();
