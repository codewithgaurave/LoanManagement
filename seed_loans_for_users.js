const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const loans = [
  {
    applicationId: "LN-250512-001",
    customer: "Ravi Kumar",
    userId: "USR-10245",
    email: "ravi.kumar@gmail.com",
    mobile: "+91 9876543210",
    address: "123, Green Park, Lucknow, Uttar Pradesh - 226001",
    loanType: "Home Loan",
    amount: "2500000",
    status: "Under Review",
    pan: "ABCDE1234F",
    aadhar: "XXXX XXXX 1234",
    documents: [],
    createdAt: new Date("2025-05-12T00:00:00Z"),
  },
  {
    applicationId: "LN-250425-001",
    customer: "Ravi Kumar",
    userId: "USR-10245",
    email: "ravi.kumar@gmail.com",
    mobile: "+91 9876543210",
    address: "123, Green Park, Lucknow, Uttar Pradesh - 226001",
    loanType: "Personal Loan",
    amount: "500000",
    status: "Approved",
    pan: "ABCDE1234F",
    aadhar: "XXXX XXXX 1234",
    documents: [],
    createdAt: new Date("2025-04-25T00:00:00Z"),
  },
  {
    applicationId: "LN-250310-001",
    customer: "Ravi Kumar",
    userId: "USR-10245",
    email: "ravi.kumar@gmail.com",
    mobile: "+91 9876543210",
    address: "123, Green Park, Lucknow, Uttar Pradesh - 226001",
    loanType: "Business Loan",
    amount: "1500000",
    status: "Rejected",
    pan: "ABCDE1234F",
    aadhar: "XXXX XXXX 1234",
    documents: [],
    createdAt: new Date("2025-03-10T00:00:00Z"),
  }
];

const seedLoans = async () => {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log('MongoDB Connected for Loans Seeding');
    
    const db = client.db();
    
    // Clear specific mock loans or just all (we'll just delete existing mock ones)
    await db.collection('loanapplications').deleteMany({ userId: "USR-10245" });
    
    // Insert new loans
    await db.collection('loanapplications').insertMany(loans);
    console.log('Dummy loans inserted');

    await client.close();
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

seedLoans();
