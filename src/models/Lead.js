const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema({
  type: { type: String, enum: ['Call', 'Meeting', 'WhatsApp', 'Email', 'Visit', 'Remark', 'Status Update'], default: 'Call' },
  scheduledAt: { type: String, default: () => new Date().toISOString().split('T')[0] },
  status: { type: String, default: 'Upcoming' },
  remarks: { type: String, default: '' },
  notes: { type: String, default: '' },
  addedBy: { type: String, default: 'Telecaller' },
}, { _id: true, timestamps: true });

const addressDetailsSchema = new mongoose.Schema({
  houseNo: { type: String, default: '' },
  street: { type: String, default: '' },
  landmark: { type: String, default: '' },
  area: { type: String, default: '' },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },
  formattedAddress: { type: String, default: '' },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
}, { _id: false });

const leadSchema = new mongoose.Schema({
  leadId: { type: String, unique: true },
  name: { type: String, required: true }, // Custom Name
  entityName: { type: String, default: '' },
  mobile: { type: String, required: true },
  altMobile: { type: String },
  email: { type: String },
  gstApc: { type: String, default: '' },
  gstPincode: { type: String, default: '' },
  gstAddress: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  aadhaarApc: { type: String, default: '' },
  aadhaarPincode: { type: String, default: '' },
  aadhaarAddress: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  customerPhoto: { type: String, default: '' },
  businessPic: { type: String, default: '' },
  agentCustomerPic: { type: String, default: '' },
  salariedIdPic: { type: String, default: '' },
  panNumber: { type: String, default: '' },
  offerStatus: { type: String, default: '' },
  offerAmount: { type: String, default: '' },
  documents: [{
    type: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, default: '' },
    fileUrlBack: { type: String, default: '' },
    fileNameBack: { type: String, default: '' },
    hasBothSides: { type: Boolean, default: false },
    remark: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Verified', 'Under Verification', 'Rejected', 'Re-upload Required'], default: 'Pending' },
    uploadedBy: { type: String, default: 'Telecaller' },
    uploadedAt: { type: Date, default: Date.now }
  }],

  // CREATED LEAD - Business Product & Program Configuration
  productCategory: {
    type: String,
    default: 'Un-Secured Loan'
    // Categories: HAUS - NUO HEALTH INSURED Products Funding, MORTGAGE LOAN, Un-Secured Loan, Nuo-G Loan, Asset Loans
  },
  productSubtype: {
    type: String,
    default: 'Personal Loan'
    // Subtypes: Salary Loan, Insure Loan, Hospi Loan, EV Loan, Consumer Loan, Home Loan, LAP, UB Loan, Personal Loan, Dr’s Loan, Gold Loan, Group Loan, Loan Against Vehicle, Equipment Loan
  },
  programType: {
    type: String,
    enum: ['EXISTING', 'FRESH', 'TOP-UP', 'BT LOAN', 'OTHER', 'Existing', 'Fresh', 'Top-Up', 'BT'],
    default: 'FRESH'
  },
  preferredARM: {
    type: String,
    enum: ['I\'ll Choose', 'Auto Assign', 'None'],
    default: 'Auto Assign'
  },
  facilityType: {
    type: String,
    enum: ['Term Loan', 'Working Capital', 'Flexi OD Loan', 'Flexi OD', 'Other'],
    default: 'Term Loan'
  },
  financialProgram: {
    type: String,
    enum: ['ABB', 'GST', 'GST-R', 'DSCR', 'Non-DSCR', 'General'],
    default: 'ABB'
  },
  constitutionType: {
    type: String,
    enum: [
      'Sole Proprietor',
      'Partnership',
      'LLP-Limited Liability Partnership',
      'OPC-One Person Company',
      'Private Limited',
      'Public Limited',
      'Individual',
      'SP',
      'PS',
      'LLP',
      'OPC',
      'Pvt Ltd',
      'PL'
    ],
    default: 'Sole Proprietor'
  },

  // Required Amount, Tenure & EMI budget
  expectedAmount: { type: String, default: '' },
  tenure: { type: String, default: '' },
  comfortEmi: { type: String, default: '' },

  // Unified Address System (Current & Permanent)
  currentAddressDetails: { type: addressDetailsSchema, default: () => ({}) },
  permanentAddressDetails: { type: addressDetailsSchema, default: () => ({}) },
  isPermanentSameAsCurrent: { type: Boolean, default: false },

  // Legacy flat fields kept for backward compatibility with older UI
  address: { type: String },
  pincode: { type: String },
  state: { type: String },
  city: { type: String },
  district: { type: String },
  area: { type: String },
  houseNo: { type: String },
  streetAddress: { type: String },
  landmark: { type: String },

  // Zonal & Multi-Tier Verification Tracking
  zone: {
    type: String,
    enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'ALL'],
    default: 'NORTH'
  },
  branch: { type: String, default: '' },
  reportingManagerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  approvalStage: {
    type: String,
    enum: [
      'LEAD_SUBMITTED',     // Stage 1: Field boy created lead
      'TL_VERIFIED',        // Stage 2: Team Leader / Branch Manager approved
      'CREDIT_APPROVED',    // Stage 3: Credit Desk approved
      'SANCTIONED',         // Stage 4: Zonal Head / Admin sanctioned
      'DISBURSED',          // Stage 5: Accountant released bank payout
      'REJECTED'            // Rejected with reason
    ],
    default: 'LEAD_SUBMITTED'
  },
  approvalRemarks: { type: String, default: '' },
  approvalHistory: [{
    stage: String,
    actionBy: String,
    actionById: mongoose.Schema.Types.ObjectId,
    role: String,
    remarks: String,
    timestamp: { type: Date, default: Date.now }
  }],

  // Submission & Link Generation
  submissionType: {
    type: String,
    enum: ['SUBMITTED', 'LINK_GENERATED'],
    default: 'LINK_GENERATED'
  },
  applicationLink: { type: String, default: '' },
  customerFormStatus: {
    type: String,
    enum: ['Pending', 'Completed'],
    default: 'Pending'
  },
  customerFilledAt: { type: Date, default: null },

  // Lead Pipeline & History Stages
  isDraft: { type: Boolean, default: false },
  draftStatus: {
    type: String,
    enum: ['Application Pending', 'Doc\'s Pending', 'Custom HOLD', 'Not Interested', 'NPA-False', 'Draft'],
    default: 'Application Pending'
  },
  inProcessStage: {
    type: String,
    enum: [
      'Logins',
      'Lender Selection',
      'Financial Decision',
      'Lender Approved',
      'Disbursal On Hold',
      'Doc\'s Pending',
      'Disbursed',
      'HOLD',
      'Not Eligible'
    ],
    default: 'Logins'
  },
  initiatedStage: {
    type: String,
    enum: [
      'Initiated',
      'Decision Hold',
      'Approved',
      'Disbursed',
      'Cancelled',
      'Rejected',
      "Defaulter's"
    ],
    default: 'Initiated'
  },
  processorName: { type: String, default: 'AMIT SINGH' },
  dla: { type: String, default: '' },
  lanId: { type: String },
  reason: { type: String, default: '' },
  lenderName: { type: String, default: '' },
  sla: { type: String, default: '48 Hrs' },
  roi: { type: String, default: '10.5%' },
  emi: { type: String, default: '' },

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

  // Stage Specific Audits
  // RM Review Audit
  rmReviewedAt: { type: Date, default: null },
  rmReviewedBy: { type: String, default: null },
  rmReviewAction: { type: String, enum: ['Approved', 'Rejected', 'Notes', 'Reject', 'Assign_Ops', ''], default: '' },
  rmReviewRemarks: { type: String, default: '' },

  telecallerConfirmedAt: { type: Date, default: null },
  telecallerConfirmedBy: { type: String, default: null },
  telecallerNotes: { type: String, default: '' },

  operationsVerifiedAt: { type: Date, default: null },
  operationsVerifiedBy: { type: String, default: null },
  operationsRemarks: { type: String, default: '' },
  operationsRejectionRemark: { type: String, default: null },
  operationsRejectedAt: { type: Date, default: null },
  operationsRejectedBy: { type: String, default: null },
  rejectedDocumentTypes: [{ type: String }],

  salesHeadApprovedAt: { type: Date, default: null },
  salesHeadApprovedBy: { type: String, default: null },
  salesHeadRemarks: { type: String, default: '' },

  // Partner Bank & NBFC Dispatch Details (Supports Bulk Multi-Lender Selection)
  dispatchedBankName: { type: String, default: '' },
  dispatchedBankBranch: { type: String, default: '' },
  dispatchedBankIfsc: { type: String, default: '' },
  dispatchedBankCode: { type: String, default: '' },
  dispatchedChannel: { type: String, enum: ['WhatsApp', 'Email', 'API', 'Portal', 'Direct Banking', 'Email & WhatsApp', ''], default: '' },
  dispatchedAt: { type: Date, default: null },
  dispatchedBy: { type: String, default: '' },
  bankOfficerName: { type: String, default: '' },
  bankOfficerDesignation: { type: String, default: '' },
  bankOfficerEmail: { type: String, default: '' },
  bankOfficerPhone: { type: String, default: '' },

  // Multi-Lender Bulk Dispatch Tracking
  dispatchedLenders: [
    {
      name: { type: String, required: true },
      shortName: { type: String },
      code: { type: String },
      category: { type: String, enum: ['Commercial Bank', 'NBFC', 'Housing Finance', 'Other'], default: 'Commercial Bank' },
      channel: { type: String, default: 'Email' },
      branch: { type: String, default: '' },
      ifsc: { type: String, default: '' },
      contactEmail: { type: String, default: '' },
      contactPhone: { type: String, default: '' },
      status: { type: String, enum: ['Dispatched', 'Under Review', 'Sanctioned', 'Rejected', 'Hold'], default: 'Dispatched' },
      dispatchedAt: { type: Date, default: Date.now }
    }
  ],

  // Customer HOLD Escalation
  isHoldAlertActive: { type: Boolean, default: false },
  holdReason: { type: String, default: '' },
  holdAt: { type: Date, default: null },
  holdFollowUpBy: { type: String, default: '' },
  holdFollowUpRemarks: { type: String, default: '' },
  holdResolvedAt: { type: Date, default: null },

  source: {
    type: String,
    enum: ['Website', 'Referral', 'Walk-in', 'Tele Calling', 'Social Media', 'Employee App', 'Customer App', 'Other'],
    default: 'Employee App'
  },
  loanPurpose: {
    type: String,
    default: 'Business Loan'
  },
  preferredBranch: { type: String },
  remarks: { type: String },
  status: {
    type: String,
    enum: [
      'New', 'Contacted', 'Interested', 'Follow-up', 'Documents Pending', 'Application Submitted',
      'Qualified', 'Converted', 'Lost', 'Unassigned', 'Assigned', 'Rejected', 'Draft', 'HOLD',
      'Under Review', 'Approved', 'Disbursed', 'In Progress', 'Pending', 'In-Draft', 'Submitted', 'Initiated'
    ],
    default: 'New'
  },
  assignedTo: { type: String, default: null },
  assignedToId: { type: String, default: null },
  assignedTeam: { type: String, default: null },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  assignmentRemarks: { type: String },
  assignedBy: { type: String, default: null },
  assignedAt: { type: Date, default: null },
  assignmentHistory: [{
    assignedTo: String,
    assignedToId: String,
    assignedBy: String,
    assignedAt: { type: Date, default: Date.now },
    previousAssignee: String
  }],
  followUps: [followUpSchema],
  nextFollowUp: { type: String, default: '-' },
  createdById: { type: String, default: null },
  createdByEmpId: { type: String, default: null },
  createdByRole: { type: String, default: null },
  createdByName: { type: String, default: null },
}, { timestamps: true });

leadSchema.pre('save', function () {
  if (!this.leadId) {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    this.leadId = 'NuoGM-LD-' + year + '-' + random;
  }

  if (!this.lanId && this.leadId) {
    this.lanId = 'LAN-' + this.leadId.replace('NuoGM-LD-', '');
  }

  // Synchronize currentAddressDetails to flat fields if needed
  if (this.currentAddressDetails && this.currentAddressDetails.city) {
    this.city = this.currentAddressDetails.city;
    this.district = this.currentAddressDetails.district;
    this.state = this.currentAddressDetails.state;
    this.pincode = this.currentAddressDetails.pincode;
    this.area = this.currentAddressDetails.area;
    this.landmark = this.currentAddressDetails.landmark;
    this.houseNo = this.currentAddressDetails.houseNo;
    this.streetAddress = this.currentAddressDetails.street;

    if (!this.address) {
      this.address = this.currentAddressDetails.formattedAddress || [
        this.houseNo,
        this.streetAddress,
        this.landmark ? `Near ${this.landmark}` : '',
        this.area,
        this.city,
        this.state,
        this.pincode ? `- ${this.pincode}` : ''
      ].filter(Boolean).join(', ');
    }
  }

  // Auto assign Zone if state is available
  if (this.state) {
    try {
      const { getZoneFromState } = require('../utils/zoneHelper');
      const calculatedZone = getZoneFromState(this.state);
      if (calculatedZone) {
        this.zone = calculatedZone;
      }
    } catch (zErr) {
      console.warn('Could not auto-map lead zone:', zErr.message);
    }
  }

  // Handle permanent address sync
  if (this.isPermanentSameAsCurrent) {
    this.permanentAddressDetails = this.currentAddressDetails;
  }

  // Generate self-application link if not present and submissionType is LINK_GENERATED
  if (this.submissionType === 'LINK_GENERATED' && !this.applicationLink) {
    this.applicationLink = `https://loanportal.nuogm.com/apply/${this.leadId}`;
  }
});

module.exports = mongoose.model('Lead', leadSchema);
