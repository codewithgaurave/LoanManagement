const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
  empId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
  },
  role: {
    type: String,
    required: true,
  },
  designation: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  joiningDate: {
    type: Date,
    default: Date.now
  },
  shift: {
    type: String,
    default: '24/7'
  },
  shiftTiming: {
    type: String,
    default: '24/7 Unrestricted'
  },
  dutyStatus: {
    type: String,
    enum: ['ON DUTY', 'OFF DUTY'],
    default: 'ON DUTY'
  },
  dutyStartTime: {
    type: Date,
    default: Date.now
  },
  // Late Login Lock & HR Approval fields
  isLateLocked: {
    type: Boolean,
    default: false
  },
  lateLockReason: {
    type: String,
    default: ''
  },
  hrLoginApprovedDate: {
    type: String, // 'YYYY-MM-DD' formatted date when HR approved late login
    default: ''
  },
  hrApprovedBy: {
    type: String,
    default: ''
  },
  // In-app Login Unlock Request / Query
  unblockRequest: {
    status: {
      type: String,
      enum: ['None', 'Pending', 'Approved', 'Rejected'],
      default: 'None'
    },
    queryText: {
      type: String,
      default: ''
    },
    requestedAt: {
      type: Date,
      default: null
    },
    hrActionDate: {
      type: Date,
      default: null
    },
    hrRemark: {
      type: String,
      default: ''
    }
  },
  onboardingStatus: {
    type: String,
    enum: ['Pending', 'Submitted', 'Done'],
    default: 'Pending'
  },
  // Department & Head Hierarchy
  isDepartmentHead: { type: Boolean, default: false },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  department: { type: String, default: 'Operations' },
  zonalRole: {
    type: String,
    enum: ['Sales Head', 'RRM', 'ARM', 'RM', 'RO', 'RE', 'Telecaller', 'Operation Manager', 'Operation Admin', 'Collection Staff', 'HR Head', 'HR Manager', 'HR Executive', 'Other'],
    default: 'Other'
  },
  zone: {
    type: String,
    enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'ALL'],
    default: 'NORTH'
  },
  reportsToHeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  reportsToHeadName: { type: String, default: null },
  reportsToManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  reportsToManagerName: { type: String, default: null },
  
  // Zonal Sales Hierarchy Links
  rrmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  rrmName: { type: String, default: null },
  armId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  armName: { type: String, default: null },
  rmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  rmName: { type: String, default: null },
  
  assignedTelecallerId: { type: String, default: null },
  assignedTelecallerName: { type: String, default: null },
  telecallerChaserNotes: { type: String, default: '' },
  assignedHRId: { type: String, default: null },
  assignedHRName: { type: String, default: null },
  assignedHRAt: { type: Date, default: null },
  lastAssignedLeadAt: { type: Date, default: null },
  totalAssignedLeads: { type: Number, default: 0 },
  // Detailed Employee Info
  mobile: { type: String },
  division: { type: String },
  pincode: { type: String },
  district: { type: String },
  state: { type: String },
  city: { type: String },
  pan: { type: String },
  aadhar: { type: String },
  
  // Salary Structure
  grossMonthly: { type: Number },
  transportation: { type: Number },
  performance: { type: Number },
  achievement: { type: Number },
  incentives: { type: Number },

  // Personal Details
  fathersName: { type: String },
  mothersName: { type: String },
  fathersMobile: { type: String },
  maritalStatus: { type: String },
  spouseName: { type: String },
  drivingLicence: { type: String },
  vehicleNumber: { type: String },

  // Address Details
  presentAddress: { type: String },
  permanentAddress: { type: String }, // legacy / fallback
  landmark: { type: String },
  isPermanentSameAsCurrent: { type: Boolean, default: false },

  // Structured permanent address
  permAddress: { type: String },
  permArea: { type: String },
  permPincode: { type: String },
  permDistrict: { type: String },
  permState: { type: String },

  // References
  ref1Rel: { type: String },
  ref1Name: { type: String },
  ref1Mobile: { type: String },
  ref1Address: { type: String },
  ref2Rel: { type: String },
  ref2Name: { type: String },
  ref2Mobile: { type: String },
  ref2Address: { type: String },

  // Qualification (legacy flat fields)
  qual1Type: { type: String },
  qual1Inst: { type: String },
  qual1Dist: { type: String },
  qual1Year: { type: String },
  qual1Perc: { type: String },

  // Qualifications – structured array (from onboarding / application)
  qualifications: [
    {
      degree:      { type: String },
      institution: { type: String },
      subject:     { type: String },
      passingYear: { type: String },
      percentage:  { type: String },
      grade:       { type: String },
    }
  ],

  // Experience
  expCompany: { type: String },
  expPosition: { type: String },
  expPhone: { type: String },
  expStart: { type: String },
  expEnd: { type: String },
  expGross: { type: String },
  expMonthly: { type: String },
  expReason: { type: String },
  expAddress: { type: String },
  expRmName: { type: String },
  expRmDesig: { type: String },
  expRmMobile: { type: String },
  expRmEmail: { type: String },
  expRmBranch: { type: String },

  // Bank Details
  bankAccType: { type: String },
  bankAccName: { type: String },
  bankName: { type: String },
  bankBranch: { type: String },
  bankAccNum: { type: String },
  bankIfsc: { type: String },

  // Documents
  documents: [{
    name: { type: String },
    key: { type: String }, // e.g. 'aadhar', 'pan', 'degree'
    fileUrl: { type: String },
    status: { type: String, enum: ['Pending', 'Verified', 'Rejected', 'Re-upload Required'], default: 'Pending' },
    rejectReason: { type: String, default: '' },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Re-upload link (generated when senior rejects any document)
  reuploadToken: { type: String, default: '' },
  reuploadTokenExpiry: { type: Date, default: null },

  // Company Issued Documents (Offer Letter, Performance Certificate, Appointment Letter, Appraisal Letter, etc.)
  companyDocuments: [{
    title: { type: String, required: true },
    type: { type: String, enum: ['Offer Letter', 'Appointment Letter', 'Performance Certificate', 'Appraisal Letter', 'Relieving Letter', 'Policy Document', 'Other'], default: 'Other' },
    issuedDate: { type: Date, default: Date.now },
    documentNo: { type: String },
    fileUrl: { type: String, default: '' },
    description: { type: String, default: '' },
    issuedBy: { type: String, default: 'HAUS NUO-PAY HR' }
  }],

  // Attendance
  attendance: [{
    date: { type: String, required: true }, // YYYY-MM-DD
    checkIn: { type: String },
    checkOut: { type: String },
    status: { type: String, enum: ['Present', 'Absent', 'Late', 'Half Day', 'Leave'] },
    hours: { type: String }
  }],

  // Leaves (Two-tier approval: Reporting Manager + HR Manager)
  leaves: [{
    ticketId: { type: String, default: '' },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    type: { type: String, enum: ['Sick Leave', 'Casual Leave', 'Earned Leave', 'Emergency Leave', 'Half Day'], default: 'Casual Leave' },
    status: { type: String, enum: ['Pending', 'RM Approved', 'Approved', 'Rejected'], default: 'Pending' },
    reason: { type: String },
    adminComment: { type: String, default: '' },
    assignedHr: { type: String, default: '' },
    assignedHrId: { type: String, default: '' },
    // Step 1: Reporting Manager Approval
    rmApproval: {
      status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
      managerId: { type: String, default: '' },
      managerName: { type: String, default: 'Reporting Manager' },
      comment: { type: String, default: '' },
      actionDate: { type: Date, default: null }
    },
    // Step 2: HR Manager Approval (Mandatory Final Approval)
    hrApproval: {
      status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
      hrId: { type: String, default: '' },
      hrName: { type: String, default: 'HR Manager' },
      comment: { type: String, default: '' },
      actionDate: { type: Date, default: null }
    },
    appliedOn: { type: Date, default: Date.now }
  }],

  // RBAC Permissions (for employees who are also sub-admins)
  permissions: {
    type: [String],
    default: []
  },

  // Permission-based allowed loan categories/types for Lead Creation
  allowedLoanTypes: {
    type: [String],
    default: []
  },

  // Profile fields (for employees who are also sub-admins)
  phone: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  },
  fcmToken: {
    type: String,
    default: null
  }

}, { timestamps: true });

// Hash password before saving
employeeSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  if (!this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match entered password to hashed password in database
employeeSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

const Employee = mongoose.model('Employee', employeeSchema);
module.exports = Employee;
