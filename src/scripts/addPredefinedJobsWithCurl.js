require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { execSync } = require('child_process');

const PREDEFINED_JOBS = [
  {
    title: 'Senior Loan Telecaller Executive',
    type: 'Full Time',
    department: 'BRANCH SALES',
    location: 'Lucknow, UTTAR PRADESH',
    description: 'Manage outbound loan verification calls, customer financial requirements analysis, lead nurturing, and CRM updates.',
    status: 'Open',
    publishStatus: 'Published',
    openings: 6,
    skills: 'Telesales, Lead Conversion, Communication, Excel'
  },
  {
    title: 'Field Verification & Recovery Officer',
    type: 'Full Time',
    department: 'COLLECTIONS',
    location: 'Kanpur, UTTAR PRADESH',
    description: 'Perform physical customer address verifications, KYC documentation, field collections, and overdue follow-up visits.',
    status: 'Open',
    publishStatus: 'Published',
    openings: 8,
    skills: 'Field Verification, KYC, Two-Wheeler, Cash Collection'
  },
  {
    title: 'Credit Underwriting Specialist',
    type: 'Full Time',
    department: 'OPERATIONAL',
    location: 'New Delhi, DELHI-NCR',
    description: 'Underwrite loan applications, evaluate CIBIL reports, ITR/Banking statements, and calculate borrower debt-to-income eligibility.',
    status: 'Open',
    publishStatus: 'Published',
    openings: 3,
    skills: 'CIBIL, CAM Underwriting, Banking Operations, Risk Assessment'
  },
  {
    title: 'Branch Sales Relationship Manager',
    type: 'Full Time',
    department: 'FIELD-SALES',
    location: 'Noida, DELHI-NCR',
    description: 'Drive retail and SME loan business, manage corporate tie-ups, DSA partners, and drive customer acquisition.',
    status: 'Open',
    publishStatus: 'Published',
    openings: 4,
    skills: 'B2B Sales, Loan Sourcing, DSA Network, Relationship Management'
  },
  {
    title: 'Accounts & Loan Settlement Officer',
    type: 'Full Time',
    department: 'OFFICIAL WORK',
    location: 'Mumbai, MAHARASHTRA',
    description: 'Handle loan disbursement vouchers, EMI payment receipt vouchers, bank reconciliation, and customer clearance NOCs.',
    status: 'Open',
    publishStatus: 'Published',
    openings: 2,
    skills: 'Tally, Bank Reconciliation, Loan Accounting, Ledger Auditing'
  },
  {
    title: 'Area Collections & Recovery Manager',
    type: 'Full Time',
    department: 'COLLECTIONS',
    location: 'Patna, BIHAR',
    description: 'Lead the regional recovery team, track 30-90+ DPD overdue accounts, assign recovery routes, and manage legal recovery notices.',
    status: 'Open',
    publishStatus: 'Published',
    openings: 4,
    skills: 'NPA Recovery, Team Handling, Legal Notice Coordination, DPD Management'
  },
  {
    title: 'Customer Onboarding & Documentation Specialist',
    type: 'Full Time',
    department: 'OPERATIONAL',
    location: 'Bengaluru, KARNATAKA',
    description: 'Review applicant digital KYC, verify Aadhaar/PAN, ensure regulatory compliance, and execute loan agreements.',
    status: 'Open',
    publishStatus: 'Published',
    openings: 5,
    skills: 'KYC Verification, Document Scrutiny, Loan Documentation, Compliance'
  },
  {
    title: 'Regional Field Sales Executive',
    type: 'Full Time',
    department: 'FIELD-SALES',
    location: 'Jaipur, RAJASTHAN',
    description: 'Identify customer loan requirements across local commercial hubs, gather documents, and coordinate with underwriting.',
    status: 'Open',
    publishStatus: 'Published',
    openings: 5,
    skills: 'Local Market Sales, Lead Generation, Field Pitching, Negotiation'
  }
];

const PREDEFINED_CANDIDATES = [
  {
    name: 'Siddharth Saxena',
    email: 'siddharth.saxena@gmail.com',
    phone: '9839123401',
    expectedSalary: '₹28,000/mo',
    noticePeriod: 'Immediate',
    status: 'Interview',
    source: 'Website',
    experience: [{ title: 'Telecaller', company: 'TeleFin India', location: 'Lucknow', startDate: '2022', endDate: '2024', summary: 'Handled outbound loan calling.' }],
    education: [{ degree: 'B.Com', institution: 'Lucknow University', districtState: 'UP', location: 'Lucknow', startDate: '2019', endDate: '2022' }]
  },
  {
    name: 'Manish Rawat',
    email: 'manish.rawat78@outlook.com',
    phone: '9792014522',
    expectedSalary: '₹24,000/mo',
    noticePeriod: '15 Days',
    status: 'Shortlisted',
    source: 'Indeed',
    experience: [{ title: 'Field Agent', company: 'Hero Fincorp Recovery', location: 'Kanpur', startDate: '2021', endDate: '2024', summary: 'Field collections.' }],
    education: [{ degree: 'B.A.', institution: 'CSJM Kanpur', districtState: 'UP', location: 'Kanpur', startDate: '2018', endDate: '2021' }]
  },
  {
    name: 'Deepika Malhotra',
    email: 'deepika.m.credit@gmail.com',
    phone: '9811456789',
    expectedSalary: '₹45,000/mo',
    noticePeriod: '30 Days',
    status: 'Reviewed',
    source: 'LinkedIn',
    experience: [{ title: 'Credit Analyst', company: 'Axis Bank LOS', location: 'Delhi', startDate: '2020', endDate: '2024', summary: 'Underwriting retail loans.' }],
    education: [{ degree: 'MBA Finance', institution: 'Delhi University', districtState: 'Delhi', location: 'New Delhi', startDate: '2018', endDate: '2020' }]
  },
  {
    name: 'Gaurav Singhal',
    email: 'gaurav.sales1@yahoo.com',
    phone: '9910223344',
    expectedSalary: '₹35,000/mo',
    noticePeriod: 'Immediate',
    status: 'Applied',
    source: 'Naukri.com',
    experience: [{ title: 'Sales Executive', company: 'ICICI Bank DSA', location: 'Noida', startDate: '2022', endDate: '2024', summary: 'Business loan sourcing.' }],
    education: [{ degree: 'BBA', institution: 'Amity University', districtState: 'UP', location: 'Noida', startDate: '2019', endDate: '2022' }]
  },
  {
    name: 'Archana Kulkarni',
    email: 'archana.kulkarni@gmail.com',
    phone: '9820556677',
    expectedSalary: '₹38,000/mo',
    noticePeriod: 'Joined',
    status: 'Hired',
    source: 'Referral',
    experience: [{ title: 'Accountant', company: 'Tata Capital Services', location: 'Mumbai', startDate: '2021', endDate: '2024', summary: 'Reconciliation & settlement.' }],
    education: [{ degree: 'M.Com', institution: 'Mumbai University', districtState: 'Maharashtra', location: 'Mumbai', startDate: '2019', endDate: '2021' }]
  }
];

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    const Admin = require('../models/Admin');
    const Job = require('../models/Job');
    const JobApplication = require('../models/JobApplication');

    let admin = await Admin.findOne({ role: 'Super Admin' });
    if (!admin) admin = await Admin.findOne({});
    const token = jwt.sign(
      { id: admin._id, role: admin.role, email: admin.email },
      process.env.JWT_SECRET || 'your_jwt_secret_here',
      { expiresIn: '7d' }
    );

    console.log(`\n======================================================`);
    console.log(`ADDING PREDEFINED JOBS VIA CURL TO /api/recruitment/jobs`);
    console.log(`======================================================\n`);

    const createdJobIds = [];

    for (const jobData of PREDEFINED_JOBS) {
      // Check if job with same title and location exists
      const existing = await Job.findOne({ title: jobData.title, location: jobData.location });
      if (existing) {
        console.log(`✓ Job already exists: "${jobData.title}" (${jobData.location}) - ID: ${existing._id}`);
        createdJobIds.push(existing._id);
        continue;
      }

      const jsonPayload = JSON.stringify(jobData);
      const escapedPayload = jsonPayload.replace(/"/g, '\\"');

      console.log(`--> Running curl for: "${jobData.title}" (${jobData.department} | ${jobData.location})`);
      const curlCmd = `curl -s -X POST http://localhost:5000/api/recruitment/jobs -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d "${escapedPayload}"`;
      
      try {
        const response = execSync(curlCmd, { encoding: 'utf-8' });
        const parsed = JSON.parse(response);
        if (parsed._id) {
          console.log(`    SUCCESS: Created Job ID ${parsed._id} | Openings: ${parsed.openings}`);
          createdJobIds.push(parsed._id);
        } else {
          console.log(`    Response:`, response);
        }
      } catch (err) {
        console.error(`    Curl error:`, err.message);
      }
    }

    console.log(`\n======================================================`);
    console.log(`ADDING PREDEFINED CANDIDATE APPLICATIONS VIA CURL`);
    console.log(`======================================================\n`);

    const jobs = await Job.find({ status: 'Open' });

    for (let i = 0; i < PREDEFINED_CANDIDATES.length; i++) {
      const candidate = PREDEFINED_CANDIDATES[i];
      const targetJob = jobs[i % jobs.length];

      const exists = await JobApplication.findOne({ email: candidate.email });
      if (exists) {
        console.log(`✓ Candidate already exists: ${candidate.name} (${candidate.email})`);
        continue;
      }

      candidate.jobId = targetJob._id;
      const jsonPayload = JSON.stringify(candidate);
      const escapedPayload = jsonPayload.replace(/"/g, '\\"');

      console.log(`--> Running curl apply for: "${candidate.name}" -> Job: "${targetJob.title}"`);
      const curlCmd = `curl -s -X POST http://localhost:5000/api/recruitment/jobs/${targetJob._id}/apply -H "Content-Type: application/json" -d "${escapedPayload}"`;

      try {
        const response = execSync(curlCmd, { encoding: 'utf-8' });
        const parsed = JSON.parse(response);
        if (parsed._id || parsed.application || parsed.message) {
          console.log(`    SUCCESS: Candidate Registered!`);
        } else {
          console.log(`    Response:`, response);
        }
      } catch (err) {
        console.error(`    Curl error:`, err.message);
      }
    }

    console.log(`\n======================================================`);
    console.log(`FINAL COUNTS VERIFICATION`);
    console.log(`======================================================`);
    const totalJobs = await Job.countDocuments();
    const totalJobApps = await JobApplication.countDocuments();
    console.log(`Total Job Openings in DB: ${totalJobs}`);
    console.log(`Total Candidate Applications in DB: ${totalJobApps}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
