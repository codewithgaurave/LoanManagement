require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const { execSync } = require('child_process');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: '6a97b4c8f4f227d9a95f3111', role: 'Super Admin', email: 'admin@superadmin.com' },
  process.env.JWT_SECRET || 'your_jwt_secret_here',
  { expiresIn: '7d' }
);

const jobsToAdd = [
  {
    title: 'Accounts and Loan Settlement Officer',
    type: 'Full Time',
    department: 'OFFICIAL WORK',
    location: 'Mumbai, MAHARASHTRA',
    description: 'Manage disbursement vouchers, EMI payment receipt vouchers, bank reconciliation and customer NOCs.',
    status: 'Open',
    publishStatus: 'Published',
    openings: 3,
    skills: 'Tally, Bank Reconciliation, Loan Accounting, Excel'
  },
  {
    title: 'Area Collections and Recovery Manager',
    type: 'Full Time',
    department: 'COLLECTIONS',
    location: 'Patna, BIHAR',
    description: 'Lead the regional recovery team, track 30-90+ DPD overdue accounts, and manage recovery routes.',
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
    description: 'Review applicant digital KYC, verify Aadhaar and PAN, and execute loan agreements.',
    status: 'Open',
    publishStatus: 'Published',
    openings: 5,
    skills: 'KYC Verification, Document Scrutiny, Compliance'
  },
  {
    title: 'DSA Channel Sales Lead',
    type: 'Full Time',
    department: 'FIELD-SALES',
    location: 'Ahmedabad, GUJARAT',
    description: 'Build and manage Direct Selling Agent (DSA) networks for housing and retail loans.',
    status: 'Open',
    publishStatus: 'Published',
    openings: 3,
    skills: 'DSA Management, Channel Sales, Retail Loans'
  },
  {
    title: 'Regional Credit Risk Analyst',
    type: 'Full Time',
    department: 'OPERATIONAL',
    location: 'Kolkata, WEST BENGAL',
    description: 'Assess borrower creditworthiness, analyze bank statements, and recommend loan sanction limits.',
    status: 'Open',
    publishStatus: 'Published',
    openings: 2,
    skills: 'Risk Analysis, CIBIL, CAM Underwriting, Banking Operations'
  }
];

const tempPath = require('path').resolve(__dirname, 'temp_job_data.json');

console.log('Running curl.exe commands to add predefined jobs with departments and locations...\n');

jobsToAdd.forEach((job) => {
  fs.writeFileSync(tempPath, JSON.stringify(job));
  try {
    const cmd = `curl.exe -s -X POST http://127.0.0.1:5000/api/recruitment/jobs -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" --data-binary @"${tempPath}"`;
    const output = execSync(cmd, { encoding: 'utf-8' });
    const parsed = JSON.parse(output);
    console.log(`[CURL POST SUCCESS] Created: "${parsed.title}" | Dept: ${parsed.department} | Loc: ${parsed.location} | ID: ${parsed._id}`);
  } catch(e) {
    console.error(`[CURL ERROR] ${job.title}:`, e.message);
  }
});

if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

console.log('\nAll predefined jobs added via curl.exe successfully!');
process.exit(0);
