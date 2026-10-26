require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Visit = require('../models/Visit');
const LoanApplication = require('../models/LoanApplication');
const Lead = require('../models/Lead');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/loan_management';
    const conn = await mongoose.connect(mongoUri);
    console.log(`Connected to Database: ${conn.connection.name} @ ${conn.connection.host}`);

    // 1. SEED TRANSACTIONS
    console.log('Seeding Transactions...');
    await Transaction.deleteMany({});

    const sampleTransactions = [
      {
        transactionId: 'TRX-982001',
        customerName: 'Priya Sharma',
        customerId: 'CUST-1001',
        loanId: 'APP-2025-001',
        type: 'Collection',
        amount: 15000,
        method: 'UPI',
        reference: 'UPI-9823749823',
        status: 'Completed',
        action: 'Matched',
        category: 'EMI Collection',
        remarks: 'June EMI paid on time',
        date: new Date(Date.now() - 2 * 3600 * 1000)
      },
      {
        transactionId: 'TRX-982002',
        customerName: 'Rahul Verma',
        customerId: 'CUST-1002',
        loanId: 'APP-2025-002',
        type: 'Collection',
        amount: 25000,
        method: 'Bank Transfer',
        reference: 'NEFT-883749281',
        status: 'Completed',
        action: 'Matched',
        category: 'EMI Collection',
        remarks: 'Home loan monthly instalment',
        date: new Date(Date.now() - 5 * 3600 * 1000)
      },
      {
        transactionId: 'TRX-982003',
        customerName: 'Amit Singh',
        customerId: 'CUST-1003',
        loanId: 'APP-2025-003',
        type: 'Payment',
        amount: 500000,
        method: 'Bank Transfer',
        reference: 'RTGS-993817263',
        status: 'Completed',
        action: 'Matched',
        category: 'Loan Disbursement',
        remarks: 'Tranche 1 Personal Loan Disbursed',
        date: new Date(Date.now() - 24 * 3600 * 1000)
      },
      {
        transactionId: 'TRX-982004',
        customerName: 'Sneha Patel',
        customerId: 'CUST-1004',
        loanId: 'APP-2025-004',
        type: 'Collection',
        amount: 8500,
        method: 'Cash',
        reference: 'RCPT-Cash-049',
        status: 'Completed',
        action: 'Matched',
        category: 'EMI Collection',
        remarks: 'Collected by Field Agent Rahul',
        date: new Date(Date.now() - 12 * 3600 * 1000)
      },
      {
        transactionId: 'TRX-982005',
        customerName: 'Vikas Kumar',
        customerId: 'CUST-1005',
        loanId: 'APP-2025-005',
        type: 'Refund',
        amount: 2500,
        method: 'Bank Transfer',
        reference: 'REF-83749283',
        status: 'Processing',
        action: 'Pending',
        category: 'Processing Fee Refund',
        reason: 'Excess processing fee deducted',
        remarks: 'Under accountant approval',
        date: new Date(Date.now() - 36 * 3600 * 1000)
      },
      {
        transactionId: 'TRX-982006',
        customerName: 'Super Admin',
        customerId: 'ORG-HQ',
        loanId: '',
        type: 'Expense',
        amount: 3500,
        method: 'UPI',
        reference: 'UPI-Office-1982',
        status: 'Approved',
        action: 'Matched',
        category: 'Office Stationary & Printing',
        remarks: 'Branch document printing paper & cartridges',
        date: new Date(Date.now() - 48 * 3600 * 1000)
      },
      {
        transactionId: 'TRX-982007',
        customerName: 'Field Team',
        customerId: 'ORG-OPS',
        loanId: '',
        type: 'Expense',
        amount: 2400,
        method: 'Cash',
        reference: 'RCPT-Fuel-882',
        status: 'Approved',
        action: 'Matched',
        category: 'Travel & Field Fuel',
        remarks: 'Customer field verification visits fuel allowance',
        date: new Date(Date.now() - 14 * 3600 * 1000)
      },
      {
        transactionId: 'TRX-982008',
        customerName: 'Kavita Gupta',
        customerId: 'CUST-1008',
        loanId: 'APP-2025-008',
        type: 'Collection',
        amount: 12400,
        method: 'UPI',
        reference: 'UPI-9182736450',
        status: 'Completed',
        action: 'Matched',
        category: 'Overdue EMI Recovery',
        remarks: 'Recovered after telecaller reminder',
        date: new Date()
      },
      {
        transactionId: 'TRX-982009',
        customerName: 'Suresh Patel',
        customerId: 'CUST-1009',
        loanId: 'APP-2025-009',
        type: 'Collection',
        amount: 18500,
        method: 'Bank Transfer',
        reference: 'IMPS-98237492',
        status: 'Failed',
        action: 'Unmatched',
        category: 'EMI Collection',
        remarks: 'Bank returned insufficient balance',
        date: new Date(Date.now() - 72 * 3600 * 1000)
      },
      {
        transactionId: 'TRX-982010',
        customerName: 'Arjun Reddy',
        customerId: 'CUST-1010',
        loanId: 'APP-2025-010',
        type: 'Refund',
        amount: 5000,
        method: 'Bank Transfer',
        reference: 'REF-7729182',
        status: 'Completed',
        action: 'Matched',
        category: 'Security Deposit Refund',
        reason: 'Loan successfully pre-closed',
        remarks: 'Processed successfully',
        date: new Date(Date.now() - 96 * 3600 * 1000)
      }
    ];

    await Transaction.insertMany(sampleTransactions);
    console.log(`Inserted ${sampleTransactions.length} Transactions.`);

    // 2. SEED FIELD AGENT VISITS
    console.log('Seeding Field Agent Visits...');
    await Visit.deleteMany({});

    const sampleVisits = [
      {
        visitId: 'VST-101',
        customerName: 'Amit Kumar',
        mobile: '9876543210',
        address: '12, Sector 5, Gomti Nagar',
        city: 'Lucknow',
        pincode: '226010',
        purpose: 'Address Verification',
        scheduledDate: new Date(Date.now() + 4 * 3600 * 1000),
        scheduledTime: '02:30 PM',
        agentName: 'Vikram Rathore',
        status: 'Scheduled',
        remarks: 'Verify residence proof and meet family members'
      },
      {
        visitId: 'VST-102',
        customerName: 'Priya Sharma',
        mobile: '9988776655',
        address: '45, Hazratganj Shopping Complex',
        city: 'Lucknow',
        pincode: '226001',
        purpose: 'Business Verification',
        scheduledDate: new Date(Date.now() + 8 * 3600 * 1000),
        scheduledTime: '04:00 PM',
        agentName: 'Vikram Rathore',
        status: 'Scheduled',
        remarks: 'Check stock, trade license & physical shop board'
      },
      {
        visitId: 'VST-103',
        customerName: 'Rahul Verma',
        mobile: '8877665544',
        address: '8, Aliganj Main Road',
        city: 'Lucknow',
        pincode: '226024',
        purpose: 'Document Collection',
        scheduledDate: new Date(Date.now() - 24 * 3600 * 1000),
        scheduledTime: '11:00 AM',
        agentName: 'Vikram Rathore',
        status: 'Completed',
        outcome: 'Collected 6-month bank statement and 3 salary slips',
        remarks: 'Customer submitted all physical KYC originals for xerox verification'
      },
      {
        visitId: 'VST-104',
        customerName: 'Deepak Yadav',
        mobile: '9765432109',
        address: 'Plot 44, Indira Nagar',
        city: 'Lucknow',
        pincode: '226016',
        purpose: 'EMI Recovery',
        scheduledDate: new Date(Date.now() - 48 * 3600 * 1000),
        scheduledTime: '01:00 PM',
        agentName: 'Vikram Rathore',
        status: 'Completed',
        outcome: 'PTP given for 28th August',
        remarks: 'Customer agreed to pay overdue ₹25,000 via UPI link'
      },
      {
        visitId: 'VST-105',
        customerName: 'Vijay Singh',
        mobile: '9900887766',
        address: '67, Vikas Nagar',
        city: 'Lucknow',
        pincode: '226022',
        purpose: 'Asset Inspection',
        scheduledDate: new Date(Date.now() + 28 * 3600 * 1000),
        scheduledTime: '12:00 PM',
        agentName: 'Vikram Rathore',
        status: 'Scheduled',
        remarks: 'Inspect machinery for MSME Business Loan application'
      }
    ];

    await Visit.insertMany(sampleVisits);
    console.log(`Inserted ${sampleVisits.length} Field Agent Visits.`);

    // 3. UPDATE / SEED OVERDUE & DISBURSED LOANS
    console.log('Ensuring Disbursed and Overdue loans in LoanApplication collection...');
    const overdueExists = await LoanApplication.findOne({ status: 'Overdue' });
    if (!overdueExists) {
      await LoanApplication.create({
        applicationId: 'LN-2025-1021',
        customer: 'Deepak Yadav',
        loanType: 'Personal Loan',
        amount: 250000,
        status: 'Overdue',
        mobile: '9765432109',
        email: 'deepak.yadav@example.com',
        tenure: '24 Months',
        interestRate: '14%',
        emiAmount: 12500,
        overdueAmount: 25000,
        overdueDays: 45,
        lastEmiDate: '05 Jul 2026',
        nextEmiDate: '05 Aug 2026',
        city: 'Lucknow',
        address: 'Plot 44, Indira Nagar, Lucknow'
      });
      console.log('Added Overdue loan for Deepak Yadav.');
    }

    const disbursedExists = await LoanApplication.findOne({ applicationId: 'LN-2025-1001' });
    if (!disbursedExists) {
      await LoanApplication.create({
        applicationId: 'LN-2025-1001',
        customer: 'Priya Sharma',
        loanType: 'Home Loan',
        amount: 1500000,
        status: 'Disbursed',
        mobile: '9988776655',
        email: 'priya.sharma@example.com',
        tenure: '15 Years',
        interestRate: '8.5%',
        emiAmount: 14780,
        outstandingAmount: 1420000,
        nextEmiDate: '10 Sep 2026',
        city: 'Lucknow',
        address: '45, Hazratganj, Lucknow'
      });
      console.log('Added Disbursed active loan for Priya Sharma.');
    }

    // 4. POPULATE FOLLOWUPS ON LEADS
    console.log('Populating leads & followups...');
    let leads = await Lead.find({});
    if (leads.length === 0) {
      const sampleLeads = [
        {
          leadId: 'LD-2026-10245',
          name: 'Amit Kumar',
          mobile: '9876543210',
          altMobile: '9123456780',
          email: 'amit@example.com',
          address: '12, Sector 5, Gomti Nagar, Lucknow',
          source: 'Tele Calling',
          loanPurpose: 'Home Loan',
          expectedAmount: '₹25,00,000',
          preferredBranch: 'Hazratganj',
          priority: 'High',
          status: 'Contacted',
          remarks: 'Customer interested in 25L home loan, needs rate comparison',
          followUps: [
            {
              type: 'Call',
              scheduledAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
              status: 'Upcoming',
              notes: 'Discuss interest rate options (8.5% vs 8.75%)',
              addedBy: 'Telecaller Priya'
            }
          ]
        },
        {
          leadId: 'LD-2026-10246',
          name: 'Priya Sharma',
          mobile: '9988776655',
          altMobile: '9090909090',
          email: 'priya.sharma@example.com',
          address: '45, Hazratganj, Lucknow',
          source: 'Website',
          loanPurpose: 'Business Loan',
          expectedAmount: '₹50,00,000',
          preferredBranch: 'Hazratganj',
          priority: 'High',
          status: 'Qualified',
          remarks: 'Needs business expansion loan for boutique chain',
          followUps: [
            {
              type: 'Meeting',
              scheduledAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString().split('T')[0],
              status: 'Upcoming',
              notes: 'Field agent to collect GST returns and audited P&L',
              addedBy: 'Telecaller Rahul'
            }
          ]
        },
        {
          leadId: 'LD-2026-10247',
          name: 'Rahul Verma',
          mobile: '8877665544',
          altMobile: '',
          email: 'rahul.verma@example.com',
          address: '8, Aliganj, Lucknow',
          source: 'Referral',
          loanPurpose: 'Personal Loan',
          expectedAmount: '₹5,00,000',
          preferredBranch: 'Aliganj',
          priority: 'Medium',
          status: 'New',
          remarks: 'Emergency medical expenses requirement',
          followUps: [
            {
              type: 'Call',
              scheduledAt: new Date().toISOString().split('T')[0],
              status: 'Due Today',
              notes: 'First contact call to explain documentation required',
              addedBy: 'Telecaller Sunita'
            }
          ]
        },
        {
          leadId: 'LD-2026-10248',
          name: 'Sunita Devi',
          mobile: '7766554433',
          altMobile: '',
          email: 'sunita.devi@example.com',
          address: '22, Indira Nagar, Lucknow',
          source: 'Walk-in',
          loanPurpose: 'Education Loan',
          expectedAmount: '₹12,00,000',
          preferredBranch: 'Indira Nagar',
          priority: 'Medium',
          status: 'Contacted',
          remarks: 'Higher education loan for son at UK university',
          followUps: [
            {
              type: 'Call',
              scheduledAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString().split('T')[0],
              status: 'Upcoming',
              notes: 'Followup after offer letter is received',
              addedBy: 'Telecaller Priya'
            }
          ]
        },
        {
          leadId: 'LD-2026-10249',
          name: 'Vijay Singh',
          mobile: '9900887766',
          altMobile: '8811223344',
          email: 'vijay.singh@example.com',
          address: '67, Vikas Nagar, Lucknow',
          source: 'Social Media',
          loanPurpose: 'Personal Loan',
          expectedAmount: '₹3,50,000',
          preferredBranch: 'Hazratganj',
          priority: 'Low',
          status: 'Converted',
          remarks: 'Documents verified and loan application created',
          followUps: [
            {
              type: 'Call',
              scheduledAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0],
              status: 'Completed',
              notes: 'Customer confirmed loan application submitted',
              addedBy: 'Telecaller Rahul'
            }
          ]
        }
      ];

      // Delete any broken lead with leadId: null
      await Lead.deleteMany({ leadId: null });
      for (const l of sampleLeads) {
        await Lead.create(l);
      }
      console.log(`Created ${sampleLeads.length} sample leads.`);
      leads = await Lead.find({});
    }

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      if (!lead.followUps || lead.followUps.length === 0) {
        lead.followUps = [
          {
            type: 'Call',
            scheduledAt: new Date(Date.now() + (i + 1) * 24 * 3600 * 1000).toISOString().split('T')[0],
            status: i % 2 === 0 ? 'Upcoming' : 'Due Today',
            notes: 'Followup regarding loan documents submission and interest rates',
            addedBy: 'Telecaller'
          }
        ];
        lead.nextFollowUp = lead.followUps[0].scheduledAt;
        await lead.save();
      }
    }
    console.log(`Updated followups for ${leads.length} leads.`);

    console.log('SUCCESS: All module data seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedData();
