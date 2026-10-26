require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function seedData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for seeding rich real live data...');

    const Lead = require('./src/models/Lead');
    const HiringRequisition = require('./src/models/HiringRequisition');
    const Employee = require('./src/models/Employee');

    // 1. Seed comprehensive realistic Leads across all 5 zones and workflows
    const leadsToInsert = [
      // NORTH ZONE
      {
        leadId: 'LD-9101',
        name: 'Sunil Malhotra',
        mobile: '9810234567',
        zone: 'NORTH',
        productCategory: 'MORTGAGE LOAN',
        productSubtype: 'Home Loan',
        expectedAmount: '4500000',
        loanAmount: '4500000',
        workflowStage: 'Disbursed',
        status: 'Disbursed',
        isHoldAlertActive: false,
        createdAt: new Date('2026-04-12')
      },
      {
        leadId: 'LD-9102',
        name: 'Rajesh Khanna',
        mobile: '9810987654',
        zone: 'NORTH',
        productCategory: 'MORTGAGE LOAN',
        productSubtype: 'LAP',
        expectedAmount: '3500000',
        loanAmount: '3500000',
        workflowStage: 'Sales_Head_Approval_Pending',
        status: 'Under Review',
        isHoldAlertActive: false,
        createdAt: new Date('2026-05-18')
      },
      {
        leadId: 'LD-9103',
        name: 'Anil Tyagi',
        mobile: '9810345678',
        zone: 'NORTH',
        productCategory: 'Un-Secured Loan',
        productSubtype: 'Business Loan',
        expectedAmount: '1200000',
        loanAmount: '1200000',
        workflowStage: 'Customer_HOLD',
        status: 'HOLD',
        isHoldAlertActive: true,
        holdReason: 'Interest rate discount demanded by client',
        createdAt: new Date('2026-06-10')
      },
      {
        leadId: 'LD-9104',
        name: 'Meenakshi Sundaram',
        mobile: '9810456789',
        zone: 'NORTH',
        productCategory: 'Un-Secured Loan',
        productSubtype: 'Personal Loan',
        expectedAmount: '600000',
        loanAmount: '600000',
        workflowStage: 'Operations_KYC_Verification',
        status: 'Under Review',
        isHoldAlertActive: false,
        createdAt: new Date('2026-07-22')
      },
      {
        leadId: 'LD-9105',
        name: 'Kavita Joshi',
        mobile: '9810567890',
        zone: 'NORTH',
        productCategory: 'Asset Loans',
        productSubtype: 'Gold Loan',
        expectedAmount: '850000',
        loanAmount: '850000',
        workflowStage: 'Disbursed',
        status: 'Disbursed',
        isHoldAlertActive: false,
        createdAt: new Date('2026-08-15')
      },
      {
        leadId: 'LD-9106',
        name: 'Praveen Kumar',
        mobile: '9810678901',
        zone: 'NORTH',
        productCategory: 'MORTGAGE LOAN',
        productSubtype: 'Home Loan',
        expectedAmount: '6200000',
        loanAmount: '6200000',
        workflowStage: 'Customer_Confirmed',
        status: 'In Progress',
        isHoldAlertActive: false,
        createdAt: new Date('2026-09-02')
      },

      // SOUTH ZONE
      {
        leadId: 'LD-9201',
        name: 'Venkatesh Rao',
        mobile: '9840112233',
        zone: 'SOUTH',
        productCategory: 'MORTGAGE LOAN',
        productSubtype: 'Home Loan',
        expectedAmount: '5500000',
        loanAmount: '5500000',
        workflowStage: 'Disbursed',
        status: 'Disbursed',
        isHoldAlertActive: false,
        createdAt: new Date('2026-05-04')
      },
      {
        leadId: 'LD-9202',
        name: 'Karthik Subramanian',
        mobile: '9840223344',
        zone: 'SOUTH',
        productCategory: 'Un-Secured Loan',
        productSubtype: 'Business Loan',
        expectedAmount: '2800000',
        loanAmount: '2800000',
        workflowStage: 'Bank_Dispatched',
        status: 'In Progress',
        isHoldAlertActive: false,
        createdAt: new Date('2026-06-25')
      },
      {
        leadId: 'LD-9203',
        name: 'Shalini Nair',
        mobile: '9840334455',
        zone: 'SOUTH',
        productCategory: 'Un-Secured Loan',
        productSubtype: 'Personal Loan',
        expectedAmount: '450000',
        loanAmount: '450000',
        workflowStage: 'Disbursed',
        status: 'Disbursed',
        isHoldAlertActive: false,
        createdAt: new Date('2026-07-19')
      },
      {
        leadId: 'LD-9204',
        name: 'Anand Reddy',
        mobile: '9840445566',
        zone: 'SOUTH',
        productCategory: 'MORTGAGE LOAN',
        productSubtype: 'LAP',
        expectedAmount: '4000000',
        loanAmount: '4000000',
        workflowStage: 'Customer_HOLD',
        status: 'HOLD',
        isHoldAlertActive: true,
        holdReason: 'Awaiting property tax receipts from customer',
        createdAt: new Date('2026-08-28')
      },
      {
        leadId: 'LD-9205',
        name: 'Deepa Krishnan',
        mobile: '9840556677',
        zone: 'SOUTH',
        productCategory: 'Asset Loans',
        productSubtype: 'Loan Against Vehicle',
        expectedAmount: '750000',
        loanAmount: '750000',
        workflowStage: 'Sales_Head_Approval_Pending',
        status: 'Under Review',
        isHoldAlertActive: false,
        createdAt: new Date('2026-09-11')
      },

      // WEST ZONE
      {
        leadId: 'LD-9301',
        name: 'Nitin Deshmukh',
        mobile: '9820112233',
        zone: 'WEST',
        productCategory: 'Un-Secured Loan',
        productSubtype: 'Business Loan',
        expectedAmount: '3500000',
        loanAmount: '3500000',
        workflowStage: 'Disbursed',
        status: 'Disbursed',
        isHoldAlertActive: false,
        createdAt: new Date('2026-04-20')
      },
      {
        leadId: 'LD-9302',
        name: 'Tanvi Shah',
        mobile: '9820223344',
        zone: 'WEST',
        productCategory: 'MORTGAGE LOAN',
        productSubtype: 'Home Loan',
        expectedAmount: '7800000',
        loanAmount: '7800000',
        workflowStage: 'Sales_Head_Approved',
        status: 'Qualified',
        isHoldAlertActive: false,
        createdAt: new Date('2026-06-14')
      },
      {
        leadId: 'LD-9303',
        name: 'Harsh Patel',
        mobile: '9820334455',
        zone: 'WEST',
        productCategory: 'MORTGAGE LOAN',
        productSubtype: 'LAP',
        expectedAmount: '5000000',
        loanAmount: '5000000',
        workflowStage: 'Disbursed',
        status: 'Disbursed',
        isHoldAlertActive: false,
        createdAt: new Date('2026-07-08')
      },
      {
        leadId: 'LD-9304',
        name: 'Chirag Parekh',
        mobile: '9820445566',
        zone: 'WEST',
        productCategory: 'Un-Secured Loan',
        productSubtype: 'Personal Loan',
        expectedAmount: '800000',
        loanAmount: '800000',
        workflowStage: 'Customer_HOLD',
        status: 'HOLD',
        isHoldAlertActive: true,
        holdReason: 'Customer out of country for 10 days',
        createdAt: new Date('2026-08-30')
      },

      // EAST ZONE
      {
        leadId: 'LD-9401',
        name: 'Subhashish Mukherjee',
        mobile: '9830112233',
        zone: 'EAST',
        productCategory: 'MORTGAGE LOAN',
        productSubtype: 'Home Loan',
        expectedAmount: '3200000',
        loanAmount: '3200000',
        workflowStage: 'Disbursed',
        status: 'Disbursed',
        isHoldAlertActive: false,
        createdAt: new Date('2026-05-22')
      },
      {
        leadId: 'LD-9402',
        name: 'Debashis Roy',
        mobile: '9830223344',
        zone: 'EAST',
        productCategory: 'Un-Secured Loan',
        productSubtype: 'Business Loan',
        expectedAmount: '1500000',
        loanAmount: '1500000',
        workflowStage: 'Bank_Dispatched',
        status: 'In Progress',
        isHoldAlertActive: false,
        createdAt: new Date('2026-06-18')
      },
      {
        leadId: 'LD-9403',
        name: 'Priyanka Bose',
        mobile: '9830334455',
        zone: 'EAST',
        productCategory: 'Asset Loans',
        productSubtype: 'Gold Loan',
        expectedAmount: '500000',
        loanAmount: '500000',
        workflowStage: 'Disbursed',
        status: 'Disbursed',
        isHoldAlertActive: false,
        createdAt: new Date('2026-07-29')
      },
      {
        leadId: 'LD-9404',
        name: 'Joydeep Sen',
        mobile: '9830445566',
        zone: 'EAST',
        productCategory: 'Un-Secured Loan',
        productSubtype: 'Personal Loan',
        expectedAmount: '350000',
        loanAmount: '350000',
        workflowStage: 'Sales_Head_Approval_Pending',
        status: 'Under Review',
        isHoldAlertActive: false,
        createdAt: new Date('2026-09-08')
      },

      // CENTRAL ZONE
      {
        leadId: 'LD-9501',
        name: 'Mahendra Chouhan',
        mobile: '9870112233',
        zone: 'CENTRAL',
        productCategory: 'MORTGAGE LOAN',
        productSubtype: 'Home Loan',
        expectedAmount: '2900000',
        loanAmount: '2900000',
        workflowStage: 'Disbursed',
        status: 'Disbursed',
        isHoldAlertActive: false,
        createdAt: new Date('2026-04-10')
      },
      {
        leadId: 'LD-9502',
        name: 'Vikram Bundela',
        mobile: '9870223344',
        zone: 'CENTRAL',
        productCategory: 'Un-Secured Loan',
        productSubtype: 'Business Loan',
        expectedAmount: '1800000',
        loanAmount: '1800000',
        workflowStage: 'Customer_HOLD',
        status: 'HOLD',
        isHoldAlertActive: true,
        holdReason: 'Awaiting co-applicant ITR documents',
        createdAt: new Date('2026-06-03')
      },
      {
        leadId: 'LD-9503',
        name: 'Sangeeta Sahu',
        mobile: '9870334455',
        zone: 'CENTRAL',
        productCategory: 'Asset Loans',
        productSubtype: 'Loan Against Vehicle',
        expectedAmount: '650000',
        loanAmount: '650000',
        workflowStage: 'Operations_KYC_Verification',
        status: 'Under Review',
        isHoldAlertActive: false,
        createdAt: new Date('2026-08-11')
      },
      {
        leadId: 'LD-9504',
        name: 'Ashok Tiwari',
        mobile: '9870445566',
        zone: 'CENTRAL',
        productCategory: 'MORTGAGE LOAN',
        productSubtype: 'LAP',
        expectedAmount: '4200000',
        loanAmount: '4200000',
        workflowStage: 'Disbursed',
        status: 'Disbursed',
        isHoldAlertActive: false,
        createdAt: new Date('2026-09-14')
      }
    ];

    for (const lead of leadsToInsert) {
      await Lead.findOneAndUpdate(
        { leadId: lead.leadId },
        { $set: lead },
        { upsert: true, new: true }
      );
    }
    console.log(`Leads seeded / updated. Total: ${await Lead.countDocuments()}`);

    // 2. Seed Sample Hiring Requisitions
    const sampleReqs = [
      { reqId: 'REQ-101', zone: 'NORTH', role: 'RO', requiredCount: 6, hiredCount: 3, priority: 'High', status: 'In-Process', notes: 'Field officers for Lucknow & Noida territory' },
      { reqId: 'REQ-102', zone: 'SOUTH', role: 'ARM', requiredCount: 3, hiredCount: 1, priority: 'Medium', status: 'In-Process', notes: 'Area managers for Bengaluru and Chennai branches' },
      { reqId: 'REQ-103', zone: 'WEST', role: 'Telecaller', requiredCount: 5, hiredCount: 5, priority: 'Urgent', status: 'Fulfilled', notes: 'Lead qualification desk Mumbai' },
      { reqId: 'REQ-104', zone: 'EAST', role: 'RM', requiredCount: 4, hiredCount: 1, priority: 'High', status: 'In-Process', notes: 'Reporting managers for Kolkata and Bhubaneswar' },
      { reqId: 'REQ-105', zone: 'CENTRAL', role: 'RO', requiredCount: 4, hiredCount: 2, priority: 'Low', status: 'In-Process', notes: 'Bhopal and Indore field expansion' }
    ];

    await HiringRequisition.deleteMany({});
    await HiringRequisition.insertMany(sampleReqs);
    console.log(`Hiring requisitions seeded. Total: ${await HiringRequisition.countDocuments()}`);

    await mongoose.disconnect();
    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Error during seeding:', err);
  }
}

seedData();
