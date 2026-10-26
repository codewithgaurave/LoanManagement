const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, default: '' },
  password: { type: String, default: '' },
  googleAuth: { type: Boolean, default: false },
  photoUrl: { type: String, default: '' },
  alternatePhone: { type: String, default: 'N/A' },

  kycStatus: { type: String, enum: ['Pending', 'Verified', 'Blocked'], default: 'Pending' },
  status: { type: String, enum: ['Active', 'Inactive', 'Blocked'], default: 'Active' },

  pan: { type: String, default: 'Pending' },
  aadhaar: { type: String, default: 'Pending' },
  dob: { type: String },
  gender: { type: String },
  maritalStatus: { type: String },
  nationality: { type: String, default: 'Indian' },
  avatar: { type: String },

  fatherName: { type: String, default: '' },
  motherName: { type: String, default: '' },
  spouseName: { type: String, default: '' },
  landmark: { type: String, default: '' },
  residenceType: { type: String, default: 'Owned' },

  businessName: { type: String, default: '' },
  gstNumber: { type: String, default: '' },
  businessType: { type: String, default: '' },
  yearsInBusiness: { type: String, default: '' },
  businessAddress: { type: String, default: '' },

  nomineeName: { type: String, default: '' },
  nomineeRelation: { type: String, default: '' },
  nomineePhone: { type: String, default: '' },

  reference1Name: { type: String, default: '' },
  reference1Phone: { type: String, default: '' },
  reference1Relation: { type: String, default: '' },
  reference2Name: { type: String, default: '' },
  reference2Phone: { type: String, default: '' },
  reference2Relation: { type: String, default: '' },

  address: { type: String },
  currentAddress: { type: String },
  permanentAddress: { type: String },

  occupation: { type: String },
  annualIncome: { type: String },
  education: { type: String },
  gstRegistered: { type: String, default: 'No' },

  // Employment Details
  employerName: { type: String, default: 'N/A' },
  designation: { type: String, default: 'N/A' },
  totalExperience: { type: String, default: 'N/A' },
  officialEmail: { type: String, default: 'N/A' },
  workPhone: { type: String, default: 'N/A' },
  officeAddress: { type: String, default: 'N/A' },

  // Bank Details
  bankName: { type: String, default: 'N/A' },
  branch: { type: String, default: 'N/A' },
  accountHolderName: { type: String, default: 'N/A' },
  accountNumber: { type: String, default: 'N/A' },
  ifscCode: { type: String, default: 'N/A' },
  accountType: { type: String, default: 'Savings' },

  // Income Overview
  monthlyNetSalary: { type: String, default: 'N/A' },
  existingEmis: { type: String, default: 'N/A' },
  foir: { type: String, default: 'N/A' },

  creditScore: { type: Number, default: 0 },
  creditStatus: { type: String, default: 'Pending' },

  activeLoans: { type: Number, default: 0 },
  closedLoans: { type: Number, default: 0 },
  totalLoanAmount: { type: String, default: '₹0' },
  outstandingAmount: { type: String, default: '₹0' },

  totalApplications: { type: Number, default: 0 },
  approvedApplications: { type: Number, default: 0 },
  underReviewApplications: { type: Number, default: 0 },
  rejectedApplications: { type: Number, default: 0 },
  totalUploadedDocuments: { type: Number, default: 0 },

  preferredCommunication: { type: String, default: 'Email' },
  source: { type: String, default: 'Direct' },

  assignedTo: { type: String, default: null },
  assignedToId: { type: String, default: null },
  assignedBy: { type: String, default: null },
  assignedAt: { type: Date, default: null },
  assignmentHistory: [{
    assignedTo: String,
    assignedToId: String,
    assignedBy: String,
    assignedAt: { type: Date, default: Date.now },
    previousAssignee: String
  }],

  registeredOn: { type: String },
  lastLogin: { type: String },
  mpin: { type: String },
  otp: { type: String },
  otpExpires: { type: Date },
  fcmToken: { type: String, default: null },

  // Arrays for complex data
  documents: [{
    name: { type: String },
    type: { type: String },
    size: { type: String },
    date: { type: String },
    url: { type: String },
    status: { type: String, default: 'Pending' }
  }],
  activities: [{
    title: { type: String },
    date: { type: String },
    description: { type: String },
    type: { type: String }
  }],
  notes: [{
    text: { type: String },
    author: { type: String },
    date: { type: String },
    type: { type: String }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
