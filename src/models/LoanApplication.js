const mongoose = require('mongoose');

const loanApplicationSchema = new mongoose.Schema({
  applicationId: { type: String, unique: true },
  customer: { type: String, required: true },
  email: { type: String },
  mobile: { type: String, required: true },
  address: { type: String },
  loanType: { 
    type: String, 
    enum: ['Personal Loan', 'Home Loan', 'Business Loan', 'Education Loan', 'Other'], 
    required: true 
  },
  amount: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Assigned', 'Under Review', 'Approved', 'Rejected', 'Disbursed', 'Overdue', 'Closed', 'Draft', 'In-Draft', 'Submitted', 'Initiated'], 
    default: 'Pending' 
  },
  // Tracking status for application progress (1-6)
  // 1 = LEAD Submission: Application
  // 2 = Credit Evaluation
  // 3 = Offer Acceptance Pending
  // 4 = Upload Additional Documents
  // 5 = e-sign Agreement, NACH & KYC Pending
  // 6 = Final Evaluation
  trackingStatus: { 
    type: Number, 
    enum: [1, 2, 3, 4, 5, 6], 
    default: 1 
  },
  emiAmount: { type: Number, default: 0 },
  outstandingAmount: { type: Number, default: 0 },
  overdueAmount: { type: Number, default: 0 },
  overdueDays: { type: Number, default: 0 },
  nextEmiDate: { type: String, default: '' },
  lastEmiDate: { type: String, default: '' },
  tenure: { type: String, default: '12 Months' },
  interestRate: { type: String, default: '10.5%' },
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
  source: { type: String, default: 'Customer App' },
  zone: { 
    type: String, 
    enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'ALL'], 
    default: 'NORTH' 
  },

  // Multi-Tier Workflow Stage (New Zonal Hierarchy)
  workflowStage: {
    type: String,
    enum: [
      'Field_Lead_Created',
      'RM_Telecaller_Review',
      'Customer_Confirmed',
      'Operations_KYC_Verification',
      'Sales_Head_Approval_Pending',
      'Sales_Head_Approved',
      'Bank_Dispatched',
      'Bank_Sanctioned_Offer',
      'Customer_Offer_Pending',
      'Customer_Accepted',
      'Customer_HOLD',
      'Disbursed',
      'Rejected'
    ],
    default: 'Field_Lead_Created'
  },

  // Zonal Sales Tree References
  rrmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  rrmName: { type: String, default: null },
  armId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  armName: { type: String, default: null },
  rmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  rmName: { type: String, default: null },
  telecallerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  telecallerName: { type: String, default: null },
  reRoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  reRoName: { type: String, default: null },

  // Source & Generator Tracking
  createdById: { type: String, default: null },
  createdByEmpId: { type: String, default: null },
  createdByRole: { type: String, default: null },
  createdByDesignation: { type: String, default: null },
  createdByName: { type: String, default: null },
  generatorType: { type: String, enum: ['Employee', 'Customer'], default: 'Customer' },

  // Stage Specific Audits
  telecallerConfirmedAt: { type: Date, default: null },
  telecallerConfirmedBy: { type: String, default: null },
  telecallerNotes: { type: String, default: '' },

  operationsVerifiedAt: { type: Date, default: null },
  operationsVerifiedBy: { type: String, default: null },
  operationsRemarks: { type: String, default: '' },

  salesHeadApprovedAt: { type: Date, default: null },
  salesHeadApprovedBy: { type: String, default: null },
  salesHeadRemarks: { type: String, default: '' },

  // Partner Bank Dispatch Details
  dispatchedBankName: { type: String, default: '' },
  dispatchedChannel: { type: String, enum: ['WhatsApp', 'Email', 'API', 'Portal', ''], default: '' },
  dispatchedAt: { type: Date, default: null },
  dispatchedBy: { type: String, default: '' },

  // Customer HOLD Escalation
  isHoldAlertActive: { type: Boolean, default: false },
  holdReason: { type: String, default: '' },
  holdAt: { type: Date, default: null },
  holdFollowUpBy: { type: String, default: '' },
  holdFollowUpRemarks: { type: String, default: '' },
  holdResolvedAt: { type: Date, default: null },

  pan: { type: String },
  aadhar: { type: String },
  avatar: { type: String },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  userId: { type: String },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  documents: [{
    type: { type: String, required: true },
    fileUrl: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    uploadedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true, collection: 'loanapplications' });

loanApplicationSchema.pre('save', function() {
  if (!this.applicationId) {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    this.applicationId = 'APP-' + year + '-' + random;
  }
});

const LoanApplication = mongoose.model('LoanApplication', loanApplicationSchema);

module.exports = LoanApplication;
