require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { execSync } = require('child_process');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/loan_management');
  console.log('MongoDB Connected');

  let admin = await Admin.findOne({ role: { $regex: /superadmin|super admin/i } });
  if (!admin) {
    admin = await Admin.findOne({});
  }

  if (!admin) {
    console.error('No admin found to sign token');
    process.exit(1);
  }

  const token = jwt.sign(
    { id: admin._id, role: admin.role, email: admin.email },
    process.env.JWT_SECRET || 'your_jwt_secret_here',
    { expiresIn: '7d' }
  );

  console.log(`Generated Token for Admin: ${admin.name} (${admin.email})`);

  const allJobs = [
    // ── 1. UTTAR PRADESH (NORTH ZONE) ──
    {
      title: 'Branch Operations and Credit Underwriter',
      type: 'Full Time',
      department: 'OPERATIONAL',
      location: 'Lucknow, UTTAR PRADESH',
      description: 'Manage credit file evaluation, applicant documentation scrutiny, and branch loan disbursements.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 4,
      skills: 'Credit Underwriting, CIBIL, Operations, Documentation'
    },
    {
      title: 'Field Loan Acquisition Officer',
      type: 'Full Time',
      department: 'FIELD-SALES',
      location: 'Varanasi, UTTAR PRADESH',
      description: 'Drive ground customer leads, conduct doorstep customer visits, and collect KYC files.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 5,
      skills: 'Field Sales, Customer Acquisition, Retail Loans, KYC'
    },
    {
      title: 'Branch Relationship Manager - Retail Loans',
      type: 'Full Time',
      department: 'BRANCH SALES',
      location: 'Kanpur, UTTAR PRADESH',
      description: 'Responsible for branch walk-in customer conversions, cross-selling loan products, and target achievements.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'Branch Sales, Relationship Management, Retail Banking'
    },
    {
      title: 'Area Recovery and Field Collection Officer',
      type: 'Full Time',
      department: 'COLLECTIONS',
      location: 'Agra, UTTAR PRADESH',
      description: 'Manage 30-90 DPD overdue recovery routes, coordinate with borrowers, and update live collection status in app.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 4,
      skills: 'Field Collection, NPA Recovery, DPD Resolution, Customer Handling'
    },
    {
      title: 'Senior Loan Settlement and Accounts Executive',
      type: 'Full Time',
      department: 'OFFICIAL WORK',
      location: 'Ghaziabad, UTTAR PRADESH',
      description: 'Audit disbursement entries, reconcile banking statements, issue foreclosure letters, and generate NOCs.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 2,
      skills: 'Loan Accounting, Bank Reconciliation, Tally, Foreclosure'
    },

    // ── 2. DELHI-NCR (CENTRAL ZONE) ──
    {
      title: 'Regional Credit Risk & Compliance Head',
      type: 'Full Time',
      department: 'OPERATIONAL',
      location: 'New Delhi, DELHI-NCR',
      description: 'Oversee credit underwriting policies, fraud prevention, and audit compliance across regional branches.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 2,
      skills: 'Risk Management, Underwriting, Regulatory Compliance, Credit Policy'
    },
    {
      title: 'Direct Sales Agency (DSA) Channel Manager',
      type: 'Full Time',
      department: 'FIELD-SALES',
      location: 'Noida, DELHI-NCR',
      description: 'Empanel DSA channel partners, manage loan distributor networks, and drive business volumes.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'DSA Channel Management, Business Development, Loan Distribution'
    },
    {
      title: 'Branch Sales Manager - Consumer Loans',
      type: 'Full Time',
      department: 'BRANCH SALES',
      location: 'Gurugram, DELHI-NCR',
      description: 'Supervise branch retail sales executives, manage walk-in queries, and achieve lending targets.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'Consumer Loans, Branch Management, Target Achievement'
    },
    {
      title: 'Central Overdue Calling & Tele-Recovery Officer',
      type: 'Full Time',
      department: 'COLLECTIONS',
      location: 'Faridabad, DELHI-NCR',
      description: 'Engage with delinquent accounts, explain repayment plans, and process instant UPI payment receipts.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 4,
      skills: 'Telecalling, DPD Recovery, Customer Negotiation'
    },
    {
      title: 'Head Office Central Documentation Officer',
      type: 'Full Time',
      department: 'OFFICIAL WORK',
      location: 'New Delhi, DELHI-NCR',
      description: 'Validate NACH mandate submissions, perform quality check on branch files, and archive loan records.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 2,
      skills: 'NACH, Quality Control, Documentation Auditing'
    },

    // ── 3. MAHARASHTRA (WEST ZONE) ──
    {
      title: 'Housing Loan Operations Lead',
      type: 'Full Time',
      department: 'OPERATIONAL',
      location: 'Mumbai, MAHARASHTRA',
      description: 'Lead mortgage loan processing, title search legal verification, and centralized disbursement workflow.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'Home Loan Operations, Legal & Technical, Mortgage Processing'
    },
    {
      title: 'Field Loan Consultant - Auto & Business',
      type: 'Full Time',
      department: 'FIELD-SALES',
      location: 'Pune, MAHARASHTRA',
      description: 'Acquire commercial business and auto loan clients across city industrial and retail hubs.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 4,
      skills: 'Business Loans, Field Sourcing, KYC Collection'
    },
    {
      title: 'Branch Head & Retail Relationship Manager',
      type: 'Full Time',
      department: 'BRANCH SALES',
      location: 'Nagpur, MAHARASHTRA',
      description: 'Drive overall branch lending growth, customer service excellence, and cross-sell portfolio products.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 2,
      skills: 'Branch Head, Retail Sales, Portfolio Management'
    },
    {
      title: 'Hard Recovery & Field Enforcement Specialist',
      type: 'Full Time',
      department: 'COLLECTIONS',
      location: 'Nashik, MAHARASHTRA',
      description: 'Conduct field visits to 60-90+ DPD accounts, execute legal notices, and secure loan settlements.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'Field Recovery, NPA Settlement, Customer Negotiation'
    },
    {
      title: 'Branch Cashier and Accounts Executive',
      type: 'Full Time',
      department: 'OFFICIAL WORK',
      location: 'Mumbai, MAHARASHTRA',
      description: 'Manage daily counter collections, ledger postings, bank deposits, and customer NOC requests.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 2,
      skills: 'Cash Counter, Tally, Bank Deposit, NOC Clearance'
    },

    // ── 4. GUJARAT & RAJASTHAN (WEST ZONE) ──
    {
      title: 'Commercial Vehicle Finance Executive',
      type: 'Full Time',
      department: 'FIELD-SALES',
      location: 'Ahmedabad, GUJARAT',
      description: 'Partner with vehicle dealerships and commercial fleet owners for auto and asset loans.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 4,
      skills: 'Auto Loan, Dealership Management, Asset Finance'
    },
    {
      title: 'SME Loan Business Development Lead',
      type: 'Full Time',
      department: 'FIELD-SALES',
      location: 'Jaipur, RAJASTHAN',
      description: 'Acquire high-ticket business loans from manufacturing units, exporters, and retail chains in Rajasthan.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'SME Finance, B2B Acquisition, Commercial Lending'
    },
    {
      title: 'Branch Credit Appraisal Officer',
      type: 'Full Time',
      department: 'OPERATIONAL',
      location: 'Surat, GUJARAT',
      description: 'Underwrite textile and trade business loans, evaluate cash flow, and set sanction limits.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'Credit Appraisal, Cash Flow Analysis, Underwriting'
    },

    // ── 5. KARNATAKA & TAMIL NADU (SOUTH ZONE) ──
    {
      title: 'Digital Customer Onboarding & KYC Specialist',
      type: 'Full Time',
      department: 'OPERATIONAL',
      location: 'Bengaluru, KARNATAKA',
      description: 'Verify digital customer e-KYC, Aadhaar biometric logs, and ensure seamless LOS pipeline onboarding.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 6,
      skills: 'e-KYC, Digital Onboarding, LOS Workflow, Verification'
    },
    {
      title: 'Territory Sales Manager - Housing Loans',
      type: 'Full Time',
      department: 'FIELD-SALES',
      location: 'Chennai, TAMIL NADU',
      description: 'Drive affordable housing loan acquisitions across builder projects and direct property buyers.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 4,
      skills: 'Affordable Housing, Builder Tie-ups, Field Sales'
    },
    {
      title: 'Branch Retail Lending Executive',
      type: 'Full Time',
      department: 'BRANCH SALES',
      location: 'Coimbatore, TAMIL NADU',
      description: 'Counsel customers on personal and gold loan schemes, eligibility calculations, and documentation.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'Personal Loans, Customer Counseling, Branch Sales'
    },
    {
      title: 'Tele-Collections and Early Bucket Executive',
      type: 'Full Time',
      department: 'COLLECTIONS',
      location: 'Mysuru, KARNATAKA',
      description: 'Execute soft telecalling reminders for early bucket dues (1-30 DPD) and schedule UPI repayment links.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 5,
      skills: 'Telecalling, Soft Collections, EMI Reminders, Negotiation'
    },
    {
      title: 'Senior Banking Reconciliation Specialist',
      type: 'Full Time',
      department: 'OFFICIAL WORK',
      location: 'Bengaluru, KARNATAKA',
      description: 'Reconcile daily payment gateway settlements, Razorpay webhooks, and core banking transactions.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 2,
      skills: 'Bank Reconciliation, Payment Gateway, Accounting'
    },

    // ── 6. TELANGANA & ANDHRA PRADESH (SOUTH ZONE) ──
    {
      title: 'Credit Appraisal Officer - Secured Loans',
      type: 'Full Time',
      department: 'OPERATIONAL',
      location: 'Hyderabad, TELANGANA',
      description: 'Conduct valuation assessment, document verification, and sanctioning for secured credit products.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'Secured Lending, CAM Preparation, Mortgage Assessment'
    },
    {
      title: 'Rural Micro-Enterprise Loan Officer',
      type: 'Full Time',
      department: 'FIELD-SALES',
      location: 'Visakhapatnam, ANDHRA PRADESH',
      description: 'Source micro loans for local shopkeepers, women self-help groups, and small businesses.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 4,
      skills: 'Microfinance, Rural Lending, Group Loans, Field Sourcing'
    },

    // ── 7. BIHAR, JHARKHAND & WEST BENGAL (EAST ZONE) ──
    {
      title: 'Zonal Collection Manager - East',
      type: 'Full Time',
      department: 'COLLECTIONS',
      location: 'Patna, BIHAR',
      description: 'Supervise regional field collection agents, monitor daily bucket resolution, and enforce compliance.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'Collection Management, Team Leadership, DPD Control, Route Planning'
    },
    {
      title: 'Regional Credit & Fraud Verification Analyst',
      type: 'Full Time',
      department: 'OPERATIONAL',
      location: 'Kolkata, WEST BENGAL',
      description: 'Investigate applicant employer authenticity, bank statements, and identify forged document submissions.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'Fraud Detection, Bank Statement Analysis, Verification, Risk'
    },
    {
      title: 'Branch Relationship Officer',
      type: 'Full Time',
      department: 'BRANCH SALES',
      location: 'Ranchi, JHARKHAND',
      description: 'Attend branch walk-in clients, assist in digital loan form filling, and manage customer queries.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'Customer Service, Product Knowledge, Form Filling, Sales'
    },
    {
      title: 'Field Verification and RCU Agent',
      type: 'Full Time',
      department: 'FIELD-SALES',
      location: 'Bhubaneswar, ORISSA',
      description: 'Perform physical residential and business address verification visits with geotagged app photos.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 4,
      skills: 'RCU Verification, Field Visit, Address Verification, Mobile App'
    },

    // ── 8. MADHYA PRADESH & CHHATTISGARH (WEST / EAST ZONES) ──
    {
      title: 'Branch Business Development Manager',
      type: 'Full Time',
      department: 'BRANCH SALES',
      location: 'Indore, MADHYA PRADESH',
      description: 'Manage total branch profitability, oversee staff productivity, and achieve quarterly lending targets.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 2,
      skills: 'Branch Management, Team Handling, Target Achievement, P&L'
    },
    {
      title: 'Disbursement Documentation Auditor',
      type: 'Full Time',
      department: 'OFFICIAL WORK',
      location: 'Raipur, CHHATTISGARH',
      description: 'Scrutinize signed loan agreements, NACH mandates, stamp papers, and sanction letters prior to disbursement.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 2,
      skills: 'Document Auditing, NACH Mandates, Legal Documentation, Compliance'
    },

    // ── 9. PUNJAB, HARYANA, CHANDIGARH & UTTARAKHAND (NORTH ZONE) ──
    {
      title: 'Agricultural & Tractor Loan Officer',
      type: 'Full Time',
      department: 'FIELD-SALES',
      location: 'Ludhiana, PUNJAB',
      description: 'Connect with rural farmers, tractor dealerships, and agri-businesses for customized farm credit.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 4,
      skills: 'Agri Lending, Tractor Finance, Rural Field Sales'
    },
    {
      title: 'Senior Portfolio Recovery Specialist',
      type: 'Full Time',
      department: 'COLLECTIONS',
      location: 'Gurugram, HARYANA',
      description: 'Engage with delinquent high-balance accounts, structure repayment terms, and resolve critical default files.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'High-Balance Recovery, Settlement Restructuring, Debt Management'
    },
    {
      title: 'Customer Helpdesk & NOC Clearance Officer',
      type: 'Full Time',
      department: 'OFFICIAL WORK',
      location: 'Chandigarh, CHANDIGARH',
      description: 'Assist closed loan clients with No Objection Certificates, security release, and customer query resolution.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 2,
      skills: 'Helpdesk, NOC Issuance, Customer Support, Records'
    },
    {
      title: 'Branch Sales Representative - Personal Credit',
      type: 'Full Time',
      department: 'BRANCH SALES',
      location: 'Dehradun, UTTARAKHAND',
      description: 'Guide salaried professionals on low-interest personal loans, quick digital approvals, and tenure options.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 3,
      skills: 'Personal Loan Sales, Customer Guidance, Branch Operations'
    },
    {
      title: 'North-East Regional Lending Coordinator',
      type: 'Full Time',
      department: 'OPERATIONAL',
      location: 'Guwahati, ASSAM',
      description: 'Supervise regional application flow, coordinate with state nodal offices, and monitor onboarding turnaround time.',
      status: 'Open',
      publishStatus: 'Published',
      openings: 2,
      skills: 'Regional Coordination, TAT Management, Operations, Reporting'
    }
  ];

  const tempPath = require('path').resolve(__dirname, 'temp_curl_job.json');

  console.log(`\n================================================================`);
  console.log(`  EXECUTING LIVE CURL COMMANDS TO ADD JOBS ACROSS ALL DEPARTMENTS & LOCATIONS`);
  console.log(`  Total Jobs to Add: ${allJobs.length}`);
  console.log(`================================================================\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < allJobs.length; i++) {
    const job = allJobs[i];
    fs.writeFileSync(tempPath, JSON.stringify(job));
    try {
      const cmd = `curl.exe -s -X POST http://127.0.0.1:5000/api/recruitment/jobs -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" --data-binary @"${tempPath}"`;
      const output = execSync(cmd, { encoding: 'utf-8' });
      const parsed = JSON.parse(output);
      if (parsed._id) {
        successCount++;
        console.log(`[${successCount}/${allJobs.length}] ✅ Created Job: "${parsed.title}" | Dept: [${parsed.department}] | Loc: [${parsed.location}] | ID: ${parsed._id}`);
      } else {
        errorCount++;
        console.error(`[FAIL] ${job.title}: ${output}`);
      }
    } catch(e) {
      errorCount++;
      console.error(`[ERROR] ${job.title}:`, e.message);
    }
  }

  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  console.log(`\n================================================================`);
  console.log(`  CURL EXECUTION COMPLETE`);
  console.log(`  Total Successfully Added via CURL: ${successCount}`);
  console.log(`  Failed: ${errorCount}`);
  console.log(`================================================================\n`);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
