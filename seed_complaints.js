const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Complaint = require('./src/models/Complaint');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

const seedComplaints = async () => {
  try {
    const complaints = [
      {
        customer: "Rajesh Kumar",
        phone: "+91 9876512345",
        subject: "EMI Deduction twice",
        priority: "High",
        status: "Pending"
      },
      {
        customer: "Priya Sharma",
        phone: "+91 8765412345",
        subject: "Loan application stuck in verification",
        priority: "Medium",
        status: "In Progress"
      }
    ];

    for (let c of complaints) {
      const newComplaint = new Complaint(c);
      await newComplaint.save();
      console.log(`Created complaint for ${c.customer}`);
    }

    console.log('Seeding successful');
    process.exit();
  } catch (error) {
    console.error('Error with data import', error);
    process.exit(1);
  }
};

seedComplaints();
