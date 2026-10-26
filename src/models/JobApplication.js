const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  institution: String,
  districtState: String,
  degree: String,
  subject: String,
  passingYear: String,
  grade: String,
  percentage: String,
  location: String,
  startDate: String,
  endDate: String,
  summary: String
});

const experienceSchema = new mongoose.Schema({
  title: String,
  company: String,
  industry: String,
  location: String,
  startDate: String,
  endDate: String,
  grossPay: String,
  netPay: String,
  startingSalary: String,
  endingSalary: String,
  rmName: String,
  rmDesignation: String,
  rmPhone: String,
  rmEmail: String,
  responsibilitiesSummary: String,
  reasonOfLeaving: String,
  summary: String
});

const jobApplicationSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  
  // Personal Info
  name: { type: String, required: true },
  fatherName: String,
  motherName: String,
  maritalStatus: String,
  spouseName: String,
  email: { type: String, required: true },
  phone: { type: String, required: true },
  alternatePhone: String,
  aadhaar: String,
  pan: String,
  dob: String,
  gender: String,
  religion: String,
  nationality: String,
  pincode: String,
  state: String,
  district: String,
  area: String,
  flatHouseFloor: String,
  societyName: String,
  landmark: String,
  presentAddress: String,
  permanentAddress: String,
  profilePhotoUrl: String,
  
  // Education & Experience
  education: [educationSchema],
  experience: [experienceSchema],
  
  // Salary & NP
  expectedMonthlySalary: String,
  joinedComfortableDate: String,
  yearlyGrossSalary: String,
  monthlyNetSalary: String,
  expectedSalary: String,
  noticePeriod: String,
  reasonOfLeaving: String,
  
  // Candidate Type
  candidateType: {
    type: String,
    enum: ['Fresher', 'Experienced'],
    default: 'Fresher'
  },
  
  // Documents
  resumeUrl: String,
  coverLetterUrl: String,
  salarySlipUrl: String,
  experienceLetterUrl: String,
  relievingLetterUrl: String,

  // Application Number to prevent any data overwrite
  applicationNo: {
    type: String,
    unique: true,
    sparse: true
  },

  // Auto Zone Mapping
  zone: {
    type: String,
    enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'],
    default: 'NORTH'
  },

  // HR Tracking & Hierarchy Mapping
  status: {
    type: String,
    enum: ['Applied', 'Reviewed', 'Interview', 'Shortlisted', 'Rejected', 'Hired'],
    default: 'Applied'
  },
  source: {
    type: String,
    default: 'Website'
  },
  assignedHeadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  assignedHeadName: {
    type: String,
    default: 'HR Head'
  },
  assignedManagerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  assignedManagerName: {
    type: String,
    default: null
  },
  assignedExecutiveId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  assignedTo: {
    type: String,
    default: null
  },
  assignedToId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  assignedBy: {
    type: String,
    default: null
  },
  assignedAt: {
    type: Date,
    default: null
  },
  assignmentHistory: [{
    assignedTo: String,
    assignedToId: String,
    assignedBy: String,
    assignedAt: { type: Date, default: Date.now },
    previousAssignee: String
  }],
  onboardingStatus: {
    type: String,
    enum: ['Not Initiated', 'Pending', 'Submitted', 'Done'],
    default: 'Not Initiated'
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('JobApplication', jobApplicationSchema);
