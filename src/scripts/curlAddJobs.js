require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { execSync } = require('child_process');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Admin = require('../models/Admin');
  let admin = await Admin.findOne({ role: 'Super Admin' }) || await Admin.findOne({});
  const token = jwt.sign(
    { id: admin._id, role: admin.role, email: admin.email },
    process.env.JWT_SECRET || 'your_jwt_secret_here',
    { expiresIn: '7d' }
  );

  const jobs = [
    {
      title: 'Field Verification and Recovery Officer',
      type: 'Full Time',
      department: 'COLLECTIONS',
      location: 'Kanpur, UTTAR PRADESH',
      description: 'Perform physical customer address verifications, KYC documentation, and collections.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 8,
      skills: 'Field Verification, KYC, Two-Wheeler, Cash Collection'
    },
    {
      title: 'Accounts and Loan Settlement Officer',
      type: 'Full Time',
      department: 'OFFICIAL WORK',
      location: 'Mumbai, MAHARASHTRA',
      description: 'Handle loan disbursement vouchers, EMI payment receipt vouchers, and bank reconciliation.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 2,
      skills: 'Tally, Bank Reconciliation, Loan Accounting, Ledger Auditing'
    },
    {
      title: 'Area Collections and Recovery Manager',
      type: 'Full Time',
      department: 'COLLECTIONS',
      location: 'Patna, BIHAR',
      description: 'Lead the regional recovery team, track 30-90+ DPD overdue accounts, and manage recovery.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 4,
      skills: 'NPA Recovery, Team Handling, Legal Coordination, DPD Management'
    },
    {
      title: 'Customer Onboarding and Documentation Specialist',
      type: 'Full Time',
      department: 'OPERATIONAL',
      location: 'Bengaluru, KARNATAKA',
      description: 'Review applicant digital KYC, verify Aadhaar/PAN, and execute loan agreements.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 5,
      skills: 'KYC Verification, Document Scrutiny, Compliance'
    }
  ];

  const tempFile = require('path').resolve(__dirname, 'temp_job.json');

  for (const j of jobs) {
    fs.writeFileSync(tempFile, JSON.stringify(j));
    const curlCmd = `curl -s -X POST http://localhost:5000/api/recruitment/jobs -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" --data-binary @"${tempFile}"`;
    const res = execSync(curlCmd, { encoding: 'utf-8' });
    try {
      const parsed = JSON.parse(res);
      console.log('SUCCESS: Created via curl ->', parsed.title, '|', parsed.location, '| ID:', parsed._id);
    } catch (e) {
      console.log('Response:', res);
    }
  }

  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

  const Job = require('../models/Job');
  const allJobs = await Job.find({});
  console.log('\nTotal Jobs in DB now:', allJobs.length);
  await mongoose.disconnect();
  process.exit(0);
}

run();
