const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const users = [
  {
    userId: "USR-10245",
    name: "Ravi Kumar",
    email: "ravi.kumar@gmail.com",
    phone: "+91 9876543210",
    kycStatus: "Verified",
    activeLoans: 1,
    closedLoans: 2,
    totalLoanAmount: "₹5,00,000",
    status: "Active",
    pan: "ABCDE1234F",
    aadhaar: "XXXX XXXX 1234",
    dob: "15 Aug 1990",
    gender: "Male",
    address: "123, Green Park, Lucknow, Uttar Pradesh - 226001",
    outstandingAmount: "₹3,20,000",
    totalApplications: 3,
    creditScore: 742,
    creditStatus: "Good",
    avatar: "https://i.pravatar.cc/150?u=1",
    maritalStatus: "Married",
    nationality: "Indian",
    alternatePhone: "+91 9123456789",
    currentAddress: "123, Green Park Society, Sector 45, Gurugram, Haryana - 122003",
    permanentAddress: "Vill. Rampur, Post - Bazar, District - Patna, Bihar - 800001",
    preferredCommunication: "Email",
    source: "Google Ads",
    occupation: "Salaried",
    annualIncome: "₹ 12,00,000",
    education: "B.Tech (Computer Science)",
    gstRegistered: "No",
    registeredOn: "12 May 2025, 10:30 AM",
    lastLogin: "31 May 2025, 04:45 PM",
    approvedApplications: 1,
    underReviewApplications: 1,
    rejectedApplications: 1,
    totalUploadedDocuments: 4,

    // New Fields
    employerName: "Tech Solutions Pvt Ltd",
    designation: "Senior Software Engineer",
    totalExperience: "5 Years 4 Months",
    officialEmail: "work.ravi@techsolutions.com",
    workPhone: "080-12345678",
    officeAddress: "Building 4, Mindspace IT Park, Hitech City, Hyderabad - 500081",

    bankName: "HDFC Bank",
    branch: "Sector 45, Gurugram",
    accountHolderName: "Ravi Kumar",
    accountNumber: "50100234567890",
    ifscCode: "HDFC0001234",
    accountType: "Savings Account",

    monthlyNetSalary: "₹ 1,00,000",
    existingEmis: "₹ 16,500",
    foir: "16.5%",

    documents: [
      { name: "PAN Card", type: "PDF", size: "1.2 MB", date: "12 May 2025", url: "https://images.unsplash.com/photo-1620228892461-1eb47ce7cb38?auto=format&fit=crop&q=80&w=800" },
      { name: "Aadhaar Front", type: "JPG", size: "2.5 MB", date: "12 May 2025", url: "https://images.unsplash.com/photo-1601597111158-2fceff292cdc?auto=format&fit=crop&q=80&w=800" },
      { name: "Bank Statement_Jan_Mar", type: "PDF", size: "4.8 MB", date: "13 May 2025", url: "https://images.unsplash.com/photo-1618044733300-9472054094ee?auto=format&fit=crop&q=80&w=800" },
      { name: "Salary Slip_April", type: "PDF", size: "0.8 MB", date: "13 May 2025", url: "https://images.unsplash.com/photo-1618044733300-9472054094ee?auto=format&fit=crop&q=80&w=800" }
    ],

    activities: [
      { title: "Home Loan Application Submitted", date: "12 May 2025, 02:30 PM", description: "User successfully submitted an application for Home Loan (LN-250512-001).", type: "blue" },
      { title: "KYC Verification Completed", date: "13 May 2025, 11:15 AM", description: "PAN and Aadhaar verified successfully via automated check.", type: "green" },
      { title: "Documents Uploaded", date: "13 May 2025, 10:45 AM", description: "User uploaded Bank Statements and Salary Slips.", type: "amber" }
    ],

    notes: [
      { text: "User is very responsive and provided documents on time.", author: "Admin", date: "21 May 2025, 03:12 PM", type: "amber" },
      { text: "Requested for higher loan amount. Follow up required.", author: "Neha (Relationship Manager)", date: "20 May 2025, 11:30 AM", type: "blue" }
    ]
  }
];

const seedUsers = async () => {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log('MongoDB Connected for Seeding');
    
    const db = client.db();
    
    // Clear existing users
    await db.collection('users').deleteMany({});
    console.log('Existing users cleared');

    // Insert new users
    await db.collection('users').insertMany(users);
    console.log('Dummy users inserted');

    await client.close();
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

seedUsers();
