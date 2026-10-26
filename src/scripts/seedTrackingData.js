require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const Lead = require('../models/Lead');
const LoanApplication = require('../models/LoanApplication');
const Employee = require('../models/Employee');
const User = require('../models/User');

async function seedData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB successfully.');

    // 1. Check & Seed Employees if needed
    const empCount = await Employee.countDocuments();
    console.log(`Current Employees count: ${empCount}`);
    let employees = await Employee.find({});
    if (empCount < 5) {
      const sampleEmployees = [
        { empId: 'EMP-101', name: 'Pooja Sharma', email: 'pooja.tele@loanmg.com', mobile: '9876543210', role: 'Telecaller', department: 'Sales', status: 'Active', joiningDate: new Date('2024-01-15') },
        { empId: 'EMP-102', name: 'Rohan Verma', email: 'rohan.tele@loanmg.com', mobile: '9876543211', role: 'Telecaller', department: 'Sales', status: 'Active', joiningDate: new Date('2024-02-10') },
        { empId: 'EMP-103', name: 'Vikram Singh', email: 'vikram.agent@loanmg.com', mobile: '9876543212', role: 'Field Agent', department: 'Recovery', status: 'Active', joiningDate: new Date('2024-01-20') },
        { empId: 'EMP-104', name: 'Suresh Yadav', email: 'suresh.agent@loanmg.com', mobile: '9876543213', role: 'Field Agent', department: 'Recovery', status: 'Active', joiningDate: new Date('2024-03-01') },
        { empId: 'EMP-105', name: 'Anjali Mishra', email: 'anjali.ops@loanmg.com', mobile: '9876543214', role: 'Operations', department: 'Operations', status: 'Active', joiningDate: new Date('2023-11-05') },
        { empId: 'EMP-106', name: 'Deepak Gupta', email: 'deepak.acc@loanmg.com', mobile: '9876543215', role: 'Accountant', department: 'Finance', status: 'Active', joiningDate: new Date('2023-10-12') },
        { empId: 'EMP-107', name: 'Kavita Patel', email: 'kavita.hr@loanmg.com', mobile: '9876543216', role: 'HR', department: 'Human Resources', status: 'Active', joiningDate: new Date('2023-09-01') },
      ];
      for (const emp of sampleEmployees) {
        const exists = await Employee.findOne({ email: emp.email });
        if (!exists) {
          await Employee.create(emp);
        }
      }
      employees = await Employee.find({});
      console.log(`Seeded sample employees. Total now: ${employees.length}`);
    }

    // 2. Check & Seed Jobs
    const jobCount = await Job.countDocuments();
    console.log(`Current Job Openings count: ${jobCount}`);
    let jobs = await Job.find({});
    if (jobCount < 3) {
      const sampleJobs = [
        {
          title: 'Senior Telecaller Executive',
          type: 'Full Time',
          department: 'Sales & Calling',
          location: 'Lucknow / On-site',
          description: 'Responsible for outbound customer verification calls, loan lead follow-ups, and customer acquisition.',
          status: 'Open',
          publishStatus: 'Published',
          openings: 5,
          skills: 'Communication, Hindi/English, Loan Lead Management, Telesales'
        },
        {
          title: 'Field Verification & Recovery Officer',
          type: 'Full Time',
          department: 'Field Operations',
          location: 'Lucknow / Field',
          description: 'Conduct residential and business physical verifications, KYC checks, and overdue collection visits.',
          status: 'Open',
          publishStatus: 'Published',
          openings: 8,
          skills: 'Field Verification, Customer Relationship, Two-wheeler Driving, Cash Collection'
        },
        {
          title: 'Credit Underwriting Specialist',
          type: 'Full Time',
          department: 'Operations & Credit',
          location: 'Lucknow / On-site',
          description: 'Analyze borrower financial statements, CIBIL reports, ITR/GST filings, and risk parameters.',
          status: 'Open',
          publishStatus: 'Published',
          openings: 2,
          skills: 'Credit Analysis, CIBIL, CAM Preparation, Banking Underwriting'
        },
        {
          title: 'Junior Accounts & Finance Associate',
          type: 'Full Time',
          department: 'Finance',
          location: 'Lucknow / On-site',
          description: 'Manage daily loan disbursement entries, EMI receipts, reconciliation, and bank statements.',
          status: 'Open',
          publishStatus: 'Published',
          openings: 2,
          skills: 'Tally, Excel, Cashbook, Loan Accounting, Reconciliation'
        }
      ];
      for (const j of sampleJobs) {
        const exists = await Job.findOne({ title: j.title });
        if (!exists) {
          await Job.create(j);
        }
      }
      jobs = await Job.find({});
      console.log(`Seeded sample jobs. Total now: ${jobs.length}`);
    }

    // 3. Check & Seed Job Applications
    const appCount = await JobApplication.countDocuments();
    console.log(`Current Job Applications count: ${appCount}`);
    if (appCount < 6 && jobs.length > 0) {
      const sampleApplicants = [
        {
          name: 'Aman Saxena',
          email: 'aman.saxena99@gmail.com',
          phone: '9839011223',
          jobId: jobs[0]._id,
          status: 'Interview',
          source: 'Career Portal',
          expectedSalary: '₹25,000/mo',
          noticePeriod: 'Immediate',
          education: [{ degree: 'B.Com', institution: 'Lucknow University', endDate: '2022' }],
          experience: [{ title: 'Telecaller', company: 'Pinnacle BPO', startDate: '2022', endDate: '2024' }]
        },
        {
          name: 'Neha Srivastava',
          email: 'neha.sri1997@gmail.com',
          phone: '9792033445',
          jobId: jobs[0]._id,
          status: 'Shortlisted',
          source: 'Indeed',
          expectedSalary: '₹22,000/mo',
          noticePeriod: '15 Days',
          education: [{ degree: 'B.A.', institution: 'Kanpur University', endDate: '2021' }],
          experience: [{ title: 'Customer Care Executive', company: 'TelePerformance', startDate: '2021', endDate: '2023' }]
        },
        {
          name: 'Rajesh Maurya',
          email: 'rajesh.m.field@yahoo.com',
          phone: '9450122334',
          jobId: jobs[1] ? jobs[1]._id : jobs[0]._id,
          status: 'Applied',
          source: 'Website',
          expectedSalary: '₹20,000/mo',
          noticePeriod: 'Immediate',
          education: [{ degree: 'Intermediate', institution: 'UP Board', endDate: '2019' }],
          experience: [{ title: 'Field Agent', company: 'Bajaj Finserv Collection', startDate: '2020', endDate: '2023' }]
        },
        {
          name: 'Priyanka Pandey',
          email: 'priyanka.credit@gmail.com',
          phone: '9125677889',
          jobId: jobs[2] ? jobs[2]._id : jobs[0]._id,
          status: 'Hired',
          source: 'LinkedIn',
          expectedSalary: '₹40,000/mo',
          noticePeriod: 'Joined',
          education: [{ degree: 'MBA Finance', institution: 'Amity University', endDate: '2020' }],
          experience: [{ title: 'Credit Officer', company: 'HDFC Bank LOS', startDate: '2020', endDate: '2024' }]
        },
        {
          name: 'Mohd. Imran',
          email: 'imran.finance1@gmail.com',
          phone: '9651234567',
          jobId: jobs[3] ? jobs[3]._id : jobs[0]._id,
          status: 'Reviewed',
          source: 'Naukri.com',
          expectedSalary: '₹28,000/mo',
          noticePeriod: '30 Days',
          education: [{ degree: 'M.Com', institution: 'Integral University', endDate: '2021' }],
          experience: [{ title: 'Accounts Executive', company: 'Sahu Finvest', startDate: '2021', endDate: '2024' }]
        },
        {
          name: 'Sunil Kashyap',
          email: 'sunil.kashyap77@gmail.com',
          phone: '9889123450',
          jobId: jobs[1] ? jobs[1]._id : jobs[0]._id,
          status: 'Rejected',
          source: 'Walk-in',
          expectedSalary: '₹18,000/mo',
          noticePeriod: 'Immediate'
        }
      ];
      for (const app of sampleApplicants) {
        await JobApplication.create(app);
      }
      console.log(`Seeded ${sampleApplicants.length} job applications.`);
    }

    // 4. Check & Seed Leads
    const leadCount = await Lead.countDocuments();
    console.log(`Current Leads count: ${leadCount}`);
    if (leadCount < 6) {
      const sampleLeads = [
        {
          name: 'Rameshwar Dayal',
          mobile: '9838112233',
          email: 'rameshwar.d@gmail.com',
          address: 'Alambagh, Lucknow',
          source: 'Website',
          loanPurpose: 'Personal Loan',
          expectedAmount: '350000',
          status: 'New',
          priority: 'High',
          remarks: 'Needs urgent loan for medical emergency, ITR available.'
        },
        {
          name: 'Sunita Chauhan',
          mobile: '9415223344',
          email: 'sunita.ch@outlook.com',
          address: 'Gomti Nagar, Lucknow',
          source: 'Tele Calling',
          loanPurpose: 'Business Loan',
          expectedAmount: '1200000',
          status: 'Contacted',
          priority: 'High',
          assignedTo: 'Pooja Sharma',
          remarks: 'Followup scheduled tomorrow 11 AM, boutique shop expansion.'
        },
        {
          name: 'Amitabh Sen',
          mobile: '9935445566',
          email: 'amitabh.sen@rediffmail.com',
          address: 'Hazratganj, Lucknow',
          source: 'Referral',
          loanPurpose: 'Home Loan',
          expectedAmount: '2800000',
          status: 'Qualified',
          priority: 'High',
          assignedTo: 'Rohan Verma',
          remarks: 'Govt employee, CIBIL 780, interested in home renovation.'
        },
        {
          name: 'Mohit Agarwal',
          mobile: '9871556677',
          email: 'mohit.agarwal@gmail.com',
          address: 'Indira Nagar, Lucknow',
          source: 'Website',
          loanPurpose: 'Business Loan',
          expectedAmount: '800000',
          status: 'Converted',
          priority: 'Medium',
          assignedTo: 'Pooja Sharma',
          remarks: 'Application created APP-2024-8841. Sent to operations.'
        },
        {
          name: 'Karan Mehra',
          mobile: '9650998877',
          email: 'karan.m@gmail.com',
          address: 'Vikas Nagar, Lucknow',
          source: 'Social Media',
          loanPurpose: 'Personal Loan',
          expectedAmount: '150000',
          status: 'Lost',
          priority: 'Low',
          remarks: 'Interest rate expectation too low, opted out.'
        }
      ];
      for (const l of sampleLeads) {
        await Lead.create(l);
      }
      console.log(`Seeded ${sampleLeads.length} leads.`);
    }

    // 5. Check & Seed Loan Applications
    const loanCount = await LoanApplication.countDocuments();
    console.log(`Current Loan Applications count: ${loanCount}`);
    if (loanCount < 6) {
      const sampleLoans = [
        {
          customer: 'Mohit Agarwal',
          mobile: '9871556677',
          email: 'mohit.agarwal@gmail.com',
          loanType: 'Business Loan',
          amount: '800000',
          status: 'Disbursed',
          address: 'Indira Nagar, Lucknow',
          source: 'Telecaller Portal',
          pan: 'ABCDE1234F',
          aadhar: '1234-5678-9012'
        },
        {
          customer: 'Anurag Kashyap',
          mobile: '9452334455',
          email: 'anurag.kashyap@gmail.com',
          loanType: 'Personal Loan',
          amount: '250000',
          status: 'Approved',
          address: 'Mahanagar, Lucknow',
          source: 'Website App',
          pan: 'PQRST5678K',
          aadhar: '9876-5432-1098'
        },
        {
          customer: 'Rekha Tiwari',
          mobile: '9839445566',
          email: 'rekha.t@gmail.com',
          loanType: 'Home Loan',
          amount: '1500000',
          status: 'Under Review',
          address: 'Ashiyana, Lucknow',
          source: 'Field Agent',
          pan: 'FGHIJ9012M',
          aadhar: '4567-8901-2345'
        },
        {
          customer: 'Dharmendra Yadav',
          mobile: '9918223344',
          email: 'dharmendra.y@yahoo.com',
          loanType: 'Personal Loan',
          amount: '100000',
          status: 'Pending',
          address: 'Chinhat, Lucknow',
          source: 'Website App',
          pan: 'UVWXY3456N',
          aadhar: '2345-6789-0123'
        },
        {
          customer: 'Gaurav Khanna',
          mobile: '9793112244',
          email: 'gaurav.khanna@gmail.com',
          loanType: 'Education Loan',
          amount: '500000',
          status: 'Rejected',
          address: 'Jankipuram, Lucknow',
          source: 'Website App',
          pan: 'KLMNO7890Z',
          aadhar: '6789-0123-4567'
        }
      ];
      for (const loan of sampleLoans) {
        await LoanApplication.create(loan);
      }
      console.log(`Seeded ${sampleLoans.length} loan applications.`);
    }

    console.log('Seeding verification complete!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
}

seedData();
