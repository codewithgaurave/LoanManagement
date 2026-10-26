const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../src/models/User');
const LoanApplication = require('../src/models/LoanApplication');

async function populateUserData() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/loan_management';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    const userId = 'USR-00004';
    let user = await User.findOne({ userId });

    if (!user) {
      console.log(`User ${userId} not found, creating new user...`);
      user = new User({
        userId,
        name: 'Sachin Sharma',
        email: 'sachin@gmail.com',
        phone: '7875767778',
        password: '$2b$10$A7j9nX/psQmveJ9bMKztCu7pb.wZN06TMS0MUvNAADf1Tlh5SPShe'
      });
    }

    // 1. Personal & Identity Details
    user.name = 'Sachin Sharma';
    user.email = 'sachin@gmail.com';
    user.phone = '7875767778';
    user.alternatePhone = '9876543210';
    user.dob = '15-08-1996';
    user.gender = 'Male';
    user.maritalStatus = 'Single';
    user.nationality = 'Indian';
    user.pan = 'ABCPS1234F';
    user.aadhaar = '543210987654';
    user.kycStatus = 'Verified';
    user.status = 'Active';
    user.avatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80';

    // 2. Address Details
    user.address = 'Flat No. 302, Royal Residency, Sector 62, Noida, Gautam Buddha Nagar, UP - 201301';
    user.currentAddress = 'Flat No. 302, Royal Residency, Sector 62, Noida, UP - 201301';
    user.permanentAddress = 'Flat No. 302, Royal Residency, Sector 62, Noida, UP - 201301';

    // 3. Education & Profile
    user.education = 'B.Tech in Computer Science';
    user.occupation = 'Private Sector Employee';
    user.annualIncome = '₹12,50,000';
    user.gstRegistered = 'Yes';

    // 4. Employment Details
    user.employerName = 'DigiCoders Infotech Pvt Ltd';
    user.designation = 'Senior Lead Engineer';
    user.totalExperience = '5.5 Years';
    user.officialEmail = 'sachin@digicoders.com';
    user.workPhone = '0120-4123456';
    user.officeAddress = 'C-102, Sector 63, Noida, Uttar Pradesh - 201301';
    user.monthlyNetSalary = '₹95,000';
    user.existingEmis = '₹15,000';
    user.foir = '32%';

    // 5. Bank Account Details
    user.bankName = 'HDFC Bank';
    user.branch = 'Sector 62 Noida Branch';
    user.accountHolderName = 'Sachin Sharma';
    user.accountNumber = '50100456789012';
    user.ifscCode = 'HDFC0001234';
    user.accountType = 'Salary Account';

    // 6. Credit & Loan Overview Stats
    user.creditScore = 785;
    user.creditStatus = 'Excellent';
    user.activeLoans = 1;
    user.closedLoans = 2;
    user.totalLoanAmount = '₹15,00,000';
    user.outstandingAmount = '₹3,50,000';
    user.totalApplications = 3;
    user.approvedApplications = 2;
    user.underReviewApplications = 1;
    user.rejectedApplications = 0;

    // 7. Uploaded Documents
    user.documents = [
      {
        name: 'Aadhaar Card Front & Back',
        type: 'Personal Identification',
        size: '1.8 MB',
        date: new Date().toLocaleDateString('en-IN'),
        url: 'https://loanportal.nuogm.com/uploads/sample-aadhaar.pdf',
        status: 'Verified'
      },
      {
        name: 'PAN Card Certificate',
        type: 'Tax Identification',
        size: '1.2 MB',
        date: new Date().toLocaleDateString('en-IN'),
        url: 'https://loanportal.nuogm.com/uploads/sample-pan.pdf',
        status: 'Verified'
      },
      {
        name: 'Current Passport Photo',
        type: 'Personal Photo',
        size: '0.8 MB',
        date: new Date().toLocaleDateString('en-IN'),
        url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
        status: 'Verified'
      },
      {
        name: 'GSTIN Certificate',
        type: 'Business Document',
        size: '2.4 MB',
        date: new Date().toLocaleDateString('en-IN'),
        url: 'https://loanportal.nuogm.com/uploads/sample-gstin.pdf',
        status: 'Verified'
      },
      {
        name: 'UDYAM Registration Certificate',
        type: 'Business Document',
        size: '1.5 MB',
        date: new Date().toLocaleDateString('en-IN'),
        url: 'https://loanportal.nuogm.com/uploads/sample-udyam.pdf',
        status: 'Verified'
      },
      {
        name: 'Electricity / Utility Bill',
        type: 'Property & Address Proof',
        size: '2.1 MB',
        date: new Date().toLocaleDateString('en-IN'),
        url: 'https://loanportal.nuogm.com/uploads/sample-utility.pdf',
        status: 'Verified'
      },
      {
        name: '06 Months Bank Statement (HDFC)',
        type: 'Bank Statement',
        size: '4.5 MB',
        date: new Date().toLocaleDateString('en-IN'),
        url: 'https://loanportal.nuogm.com/uploads/sample-bank-statement.pdf',
        status: 'Verified'
      }
    ];
    user.totalUploadedDocuments = user.documents.length;

    // 8. Activities Timeline
    user.activities = [
      {
        title: 'Documents Verified',
        date: new Date().toLocaleDateString('en-IN'),
        description: 'All 7 mandatory KYC and business documents verified successfully.',
        type: 'Verification'
      },
      {
        title: 'Loan Application Approved',
        date: new Date().toLocaleDateString('en-IN'),
        description: 'Business Term Loan of ₹5,00,000 approved at 10.5% interest rate.',
        type: 'Loan'
      },
      {
        title: 'Customer Onboarded',
        date: user.registeredOn || new Date().toLocaleDateString('en-IN'),
        description: 'Account registered via Customer Mobile App.',
        type: 'Registration'
      }
    ];

    // 9. Staff Notes
    user.notes = [
      {
        text: 'CIBIL Credit score is strong (785) with clean repayment track record. Pre-approved limit ₹10,00,000.',
        author: 'Credit Underwriter',
        date: new Date().toLocaleDateString('en-IN'),
        type: 'Credit Assessment'
      },
      {
        text: 'Aadhaar e-KYC and PAN biometric matching verified.',
        author: 'Operations Team',
        date: new Date().toLocaleDateString('en-IN'),
        type: 'KYC'
      }
    ];

    await user.save();
    console.log('✅ User USR-00004 updated successfully with ALL comprehensive data!');

    // 10. Also ensure active LoanApplication records exist for this user
    await LoanApplication.deleteMany({ userId });
    
    const sampleLoans = [
      {
        applicationId: 'APP-2026-8801',
        customer: user.name,
        email: user.email,
        mobile: user.phone,
        userId: user.userId,
        loanType: 'Business Loan',
        amount: '500000',
        tenure: '24 Months',
        interestRate: '10.5%',
        emiAmount: 23190,
        outstandingAmount: 350000,
        status: 'Approved',
        trackingStatus: 4,
        nextEmiDate: '10-10-2026',
        lastEmiDate: '10-09-2026',
        source: 'Customer App',
        pan: user.pan,
        aadhar: user.aadhaar,
        address: user.address,
        details: {
          category: 'Un-Secured Loan',
          subtype: 'UB Loan',
          facilityType: 'Term Loan',
          constitutionType: 'Private Limited',
          disbursedAmount: '₹5,00,000',
          monthlySalary: user.monthlyNetSalary
        },
        documents: user.documents.map(d => ({
          type: d.name,
          fileUrl: d.url,
          status: 'Approved',
          uploadedAt: new Date()
        }))
      },
      {
        applicationId: 'APP-2026-9420',
        customer: user.name,
        email: user.email,
        mobile: user.phone,
        userId: user.userId,
        loanType: 'Personal Loan',
        amount: '300000',
        tenure: '12 Months',
        interestRate: '11.0%',
        emiAmount: 26516,
        outstandingAmount: 0,
        status: 'Closed',
        trackingStatus: 6,
        source: 'Employee App',
        pan: user.pan,
        aadhar: user.aadhaar,
        address: user.address,
        details: {
          category: 'Un-Secured Loan',
          subtype: 'Personal Loan',
          facilityType: 'Term Loan'
        }
      }
    ];

    await LoanApplication.insertMany(sampleLoans);
    console.log('✅ 2 Loan Applications added for USR-00004!');

    console.log('--- ALL DATA ADDED SUCCESSFULLY FOR USR-00004 ---');
    process.exit(0);
  } catch (error) {
    console.error('Error populating user data:', error);
    process.exit(1);
  }
}

populateUserData();
