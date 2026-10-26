require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Department = require('../models/Department');
const Job = require('../models/Job');

const DEFAULT_DEPARTMENT_DESIGNATIONS = {
  'OPERATIONAL': [
    'HAUS NUO-Pay Offer- Liability',
    'Branch Operations Manager',
    'Credit Manager',
    'Credit Underwriter',
    'Credit Executive',
    'Operation Manager',
    'Operation Executive',
    'Treasury Officer',
    'Payroll Manager',
    'Account Manager',
    'Account Executive',
    'HR Manager',
    'HR Executive',
    'KYC Verification Officer',
    'Loan Documentation Specialist'
  ],
  'FIELD-SALES': [
    'HAUS NUO-Pay Offer- Liability',
    'Senior Field Loan Officer',
    'Relationship Manager',
    'Relationship Executive',
    'Relationship Officer',
    'Direct Sales Executive',
    'Microfinance Field Officer',
    'Rural Agri-Loan Officer',
    'SME Business Acquisition Officer'
  ],
  'BRANCH SALES': [
    'HAUS NUO-Pay Offer- Liability',
    'Branch Relationship Manager',
    'Regional Sales Manager',
    'Area Sales Manager',
    'Sales Trainer',
    'Reporting Team Manager',
    'Business Development Executive',
    'Gold Loan Officer',
    'Senior Sales Officer'
  ],
  'COLLECTIONS': [
    'HAUS NUO-Pay Offer- Liability',
    'Collection Manager',
    'Collection Executive',
    'Field Recovery Executive',
    'Debt Recovery Officer',
    'Legal Collections Specialist',
    'Field Investigation Officer',
    'Soft Calling Officer'
  ],
  'OFFICIAL WORK': [
    'HAUS NUO-Pay Offer- Liability',
    'Customer Care Executive - CCE',
    'Customer Support Representative - CSR',
    'Customer Service Representative',
    'Front Desk Executive',
    'MIS & Reporting Executive',
    'Back Office Operations Executive',
    'Admin & Facility Associate'
  ]
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/loan_management');
  console.log('MongoDB Connected');

  console.log('--- Syncing Department Designations Subdocuments ---');
  let totalAdded = 0;

  for (const [deptName, desigList] of Object.entries(DEFAULT_DEPARTMENT_DESIGNATIONS)) {
    let deptDoc = await Department.findOne({
      name: { $regex: new RegExp(`^${deptName}$`, 'i') }
    });

    if (!deptDoc) {
      deptDoc = new Department({
        departmentId: `DEP-${Date.now().toString().slice(-4)}-${deptName.slice(0, 3)}`,
        name: deptName,
        description: `${deptName} Department`,
        status: 'Active',
        designations: []
      });
    }

    if (!Array.isArray(deptDoc.designations)) {
      deptDoc.designations = [];
    }

    for (const name of desigList) {
      const exists = deptDoc.designations.some(
        d => d.name.toLowerCase() === name.toLowerCase().trim()
      );
      if (!exists) {
        deptDoc.designations.push({
          name: name.trim(),
          description: `Standard role for ${deptName}`,
          status: 'Active',
          createdAt: new Date()
        });
        totalAdded++;
      }
    }

    await deptDoc.save();
    console.log(`✔ Synced ${deptDoc.designations.length} designations for [${deptName}]`);
  }

  console.log(`\n--- Updating all existing jobs with proper designation field ---`);
  const allJobs = await Job.find({});
  let updatedJobsCount = 0;

  for (const job of allJobs) {
    let assignedDesig = job.designation;

    if (!assignedDesig || assignedDesig === '') {
      if (job.title.includes('HAUS NUO-Pay Offer')) {
        assignedDesig = 'HAUS NUO-Pay Offer- Liability';
      } else {
        const deptDesigs = DEFAULT_DEPARTMENT_DESIGNATIONS[job.department] || [];
        const found = deptDesigs.find(d => 
          job.title.toLowerCase().includes(d.toLowerCase()) || 
          d.toLowerCase().includes(job.title.toLowerCase())
        );
        assignedDesig = found || job.title;
      }
      job.designation = assignedDesig;
      await job.save();
      updatedJobsCount++;
    }
  }

  console.log(`Total jobs updated with designation: ${updatedJobsCount} (Total jobs in DB: ${allJobs.length})`);
  console.log('--- Designations master sync completed successfully ---');

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
