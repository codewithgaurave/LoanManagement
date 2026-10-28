const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const LoanApplication = require('../models/LoanApplication');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');
const HiringRequisition = require('../models/HiringRequisition');

// @desc    Get National & Zonal Metrics for Sales Head Command Dashboard
// @route   GET /api/sales/dashboard-metrics
// @access  Private (Sales Head / Admin / RRM)
const getSalesDashboardMetrics = async (req, res) => {
  try {
    const { zone } = req.query;
    const filter = {};
    if (zone && zone !== 'ALL' && zone !== 'all') {
      filter.zone = zone.toUpperCase();
    }

    // 1. Leads counts
    const totalLeads = await Lead.countDocuments(filter);
    const activeLeads = await Lead.countDocuments({ ...filter, workflowStage: { $nin: ['Disbursed', 'Rejected'] } });
    const confirmedLeads = await Lead.countDocuments({ ...filter, workflowStage: { $in: ['Customer_Confirmed', 'Operations_KYC_Verification', 'Sales_Head_Approval_Pending', 'Sales_Head_Approved', 'Bank_Dispatched', 'Bank_Sanctioned_Offer', 'Customer_Accepted', 'Disbursed'] } });
    const pendingSalesApproval = await Lead.countDocuments({ ...filter, workflowStage: 'Sales_Head_Approval_Pending' });
    const bankDispatched = await Lead.countDocuments({ ...filter, workflowStage: 'Bank_Dispatched' });
    const activeHoldAlerts = await Lead.countDocuments({ ...filter, isHoldAlertActive: true });
    const disbursedLeads = await Lead.countDocuments({ ...filter, workflowStage: 'Disbursed' });

    // Calculate disbursed amount
    const disbursedDocs = await Lead.find({ ...filter, workflowStage: 'Disbursed' }).select('expectedAmount loanAmount');
    let disbursedAmount = 0;
    for (const doc of disbursedDocs) {
      const val = parseFloat(doc.loanAmount || doc.expectedAmount || 0);
      if (!isNaN(val)) disbursedAmount += val;
    }

    const targetAmount = 50000000; // 5 Cr default target
    const targetAchievementPercent = Math.min(Math.round((disbursedAmount / targetAmount) * 100), 100);

    // 2. Zone-wise comparison aggregation
    const zones = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'];
    const zonesMap = {};
    const zoneStats = await Promise.all(
      zones.map(async (z) => {
        const count = await Lead.countDocuments({ zone: z });
        const active = await Lead.countDocuments({ zone: z, workflowStage: { $nin: ['Disbursed', 'Rejected'] } });
        const confirmed = await Lead.countDocuments({ zone: z, workflowStage: { $in: ['Customer_Confirmed', 'Sales_Head_Approved', 'Bank_Dispatched', 'Customer_Accepted', 'Disbursed'] } });
        const hold = await Lead.countDocuments({ zone: z, isHoldAlertActive: true });
        const disbursed = await Lead.countDocuments({ zone: z, workflowStage: 'Disbursed' });
        const staffCount = await Employee.countDocuments({ zone: z, status: 'Active' });
        
        // Sum disbursed volume for this zone
        const zDisbursedDocs = await Lead.find({ zone: z, workflowStage: 'Disbursed' }).select('expectedAmount loanAmount');
        let zDisbursedAmount = 0;
        for (const doc of zDisbursedDocs) {
          const val = parseFloat(doc.loanAmount || doc.expectedAmount || 0);
          if (!isNaN(val)) zDisbursedAmount += val;
        }

        const stats = {
          zone: z,
          totalLeads: count,
          activeLeads: active,
          confirmedLeads: confirmed,
          holdLeads: hold,
          holdAlerts: hold,
          disbursedLeads: disbursed,
          disbursedAmount: zDisbursedAmount,
          activeStaff: staffCount
        };

        zonesMap[z] = stats;
        return stats;
      })
    );

    res.status(200).json({
      success: true,
      metrics: {
        totalLeads,
        activeLeads,
        confirmedLeads,
        approvalPendingCount: pendingSalesApproval,
        pendingSalesApproval,
        bankDispatched,
        holdLeads: activeHoldAlerts,
        activeHoldAlerts,
        disbursedLeads,
        disbursedAmount,
        targetAmount,
        targetAchievementPercent,
        zones: zonesMap
      },
      zoneStats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Zonal Sales Tree Hierarchy (RRM -> ARM -> RM -> RE/RO)
// @desc    Get Hierarchical Tree filtered by user's role scope (SuperAdmin -> All, RRM -> Zone/ARMs, ARM -> RMs/RE/RO)
// @route   GET /api/sales/zonal-tree
// @access  Private
const getZonalSalesTree = async (req, res) => {
  try {
    const { zone } = req.query;
    const currentUserRole = (req.admin?.zonalRole || req.admin?.role || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const currentUserId = req.admin?._id;
    const userZone = req.admin?.zone || 'NORTH';

    const query = { status: 'Active' };

    // Role-based scoping: Strictly show SUBORDINATES (exclude self)
    // 1. Super Admin / Admin: Sees all ground staff
    if (['superadmin', 'admin'].includes(currentUserRole)) {
      if (zone && zone !== 'ALL' && zone !== 'all') {
        query.zone = zone.toUpperCase();
      }
    } 
    // 2. RRM (Regional Reporting Manager): Locked to their Zone, sees only subordinates (exclude self RRM)
    else if (['rrm', 'saleshead'].includes(currentUserRole)) {
      query.zone = userZone;
      query._id = { $ne: currentUserId };
      query.role = { $nin: ['RRM', 'Sales Head', 'saleshead', 'rrm'] };
    }
    // 3. ARM (Area Reporting Manager): Locked to their Zone, sees only subordinates (RMs, RE, RO, Telecallers) under them
    else if (currentUserRole === 'arm') {
      query.zone = userZone;
      query._id = { $ne: currentUserId };
      query.$or = [
        { armId: currentUserId },
        { reportsToManagerId: currentUserId },
        { role: { $in: ['RM', 'RO', 'RE', 'Telecaller', 'rm', 'ro', 're', 'telecaller'] } }
      ];
    }
    // 4. RM (Reporting Manager): Only staff reporting to this RM (RE/RO/Telecallers)
    else if (currentUserRole === 'rm') {
      query.zone = userZone;
      query._id = { $ne: currentUserId };
      query.$or = [
        { rmId: currentUserId },
        { reportsToManagerId: currentUserId },
        { role: { $in: ['RO', 'RE', 'Telecaller', 'ro', 're', 'telecaller'] } }
      ];
    }

    const allStaff = await Employee.find(query).select('name email mobile empId role zonalRole zone designation rrmId rrmName armId armName rmId rmName reportsToManagerId');

    // Group by Zone
    const zones = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'];
    const treeByZone = {};

    zones.forEach(z => {
      const zoneStaff = allStaff.filter(s => (s.zone || 'NORTH') === z);
      const rrms = zoneStaff.filter(s => (s.zonalRole === 'RRM' || (s.role || '').toLowerCase().includes('rrm')));
      const arms = zoneStaff.filter(s => (s.zonalRole === 'ARM' || (s.role || '').toLowerCase().includes('arm')));
      const rms = zoneStaff.filter(s => (s.zonalRole === 'RM' || (s.role || '').toLowerCase().includes('rm') || (s.designation || '').toLowerCase().includes('reporting manager')));
      const reRos = zoneStaff.filter(s => (
        s.zonalRole === 'RO' || s.zonalRole === 'RE' || 
        (s.role || '').toLowerCase().includes('officer') || (s.role || '').toLowerCase().includes('executive') ||
        (s.role || '').toLowerCase().includes('agent') || (s.role || '').toLowerCase().includes('tele')
      ));

      // Build hierarchy tree
      let structuredRrms = rrms.map(rrm => ({
        ...rrm.toObject(),
        arms: arms.filter(a => !a.rrmId || a.rrmId.toString() === rrm._id.toString()).map(arm => ({
          ...arm.toObject(),
          rms: rms.filter(r => !r.armId || r.armId.toString() === arm._id.toString()).map(rm => ({
            ...rm.toObject(),
            reRos: reRos.filter(ro => !ro.rmId || ro.rmId.toString() === rm._id.toString())
          }))
        }))
      }));

      // If user is ARM and no RRM node is in query, synthesize direct ARM node
      if (currentUserRole === 'arm' && structuredRrms.length === 0 && arms.length > 0) {
        structuredRrms = arms.map(arm => ({
          ...arm.toObject(),
          isDirectNode: true,
          rms: rms.map(rm => ({
            ...rm.toObject(),
            reRos: reRos.filter(ro => !ro.rmId || ro.rmId.toString() === rm._id.toString())
          }))
        }));
      }

      treeByZone[z] = {
        zone: z,
        rrmCount: rrms.length,
        armCount: arms.length,
        rmCount: rms.length,
        reRoCount: reRos.length,
        totalStaff: zoneStaff.length,
        staffList: zoneStaff,
        rrms: structuredRrms,
        arms: arms,
        rms: rms,
        reRos: reRos,
        unassignedARMs: arms.filter(a => !a.rrmId),
        unassignedRMs: rms.filter(r => !r.armId),
        unassignedRERO: reRos.filter(ro => !ro.rmId)
      };
    });

    res.status(200).json({ 
      success: true, 
      tree: treeByZone,
      userScope: {
        role: currentUserRole,
        zone: userZone,
        userId: currentUserId
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Sales Head sends Hiring Requisition / Headcount Request to HR
// @route   POST /api/sales/hiring-request
// @access  Private (Sales Head / Admin)
const sendHiringRequestToHR = async (req, res) => {
  try {
    const { zone, role, requiredCount, notes, priority = 'High' } = req.body;

    if (!zone || !role || !requiredCount) {
      return res.status(400).json({ success: false, message: 'Zone, role, and required headcount are required' });
    }

    // Save hiring requisition to database
    const requisition = await HiringRequisition.create({
      zone: zone.toUpperCase(),
      role,
      requiredCount: Number(requiredCount),
      priority,
      notes: notes || '',
      requestedBy: req.admin?.name || 'Sales Head',
      requestedById: req.admin?._id || null,
      status: 'Pending'
    });

    const title = `🚨 Sales Head Hiring Requisition: ${requiredCount}x ${role} (${zone} Zone)`;
    const detail = `Sales Head has requested ${requiredCount} new ${role} position(s) for ${zone} Zone. Priority: ${priority}.\nNotes: ${notes || 'Immediate hiring requested for field sales expansion.'}`;

    // Create system notification targeted to HR
    const notification = await Notification.create({
      title,
      detail,
      type: 'alert',
      recipientId: null
    });

    res.status(201).json({
      success: true,
      message: `Hiring requisition for ${requiredCount} ${role} in ${zone} Zone submitted to HR Head & HR Executives.`,
      requisition,
      notification
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all Hiring Requisitions for tracking (Read-only for Sales Head)
// @route   GET /api/sales/hiring-requests
// @access  Private (Sales Head / Admin / RRM / HR)
const getHiringRequisitions = async (req, res) => {
  try {
    const { zone, status } = req.query;
    const filter = {};
    if (zone && zone !== 'ALL' && zone !== 'all') {
      filter.zone = zone.toUpperCase();
    }
    if (status && status !== 'ALL' && status !== 'all') {
      filter.status = status;
    }

    const requisitions = await HiringRequisition.find(filter).sort({ createdAt: -1 });

    // For each requisition, dynamically count hired staff in that zone & role if needed
    const enriched = await Promise.all(requisitions.map(async (reqItem) => {
      const doc = reqItem.toObject();
      // Count active employees in that zone matching the role
      const actualHired = await Employee.countDocuments({
        zone: doc.zone,
        $or: [
          { zonalRole: doc.role },
          { role: new RegExp(doc.role, 'i') },
          { designation: new RegExp(doc.role, 'i') }
        ]
      });
      // If hiredCount in doc is 0 or less, we can reflect actualHired or doc value
      doc.liveHiredCount = Math.max(doc.hiredCount || 0, actualHired);
      return doc;
    }));

    res.status(200).json({
      success: true,
      requisitions: enriched
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all files on Customer HOLD (Escalation Center)
// @route   GET /api/sales/hold-escalations
// @access  Private (Sales Head / RRM / ARM / RM / RO / RE)
const getHoldEscalations = async (req, res) => {
  try {
    const { zone } = req.query;
    const query = { isHoldAlertActive: true };
    const roleLower = (req.admin?.role || '').toLowerCase();
    const zonalLower = (req.admin?.zonalRole || '').toLowerCase();
    const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'sales head', 'sales_head'].includes(roleLower) || zonalLower === 'sales head';
    const userZone = req.admin?.zone;

    if (zone && zone !== 'ALL' && zone !== 'all') {
      query.zone = zone.toUpperCase();
    } else if (!isMasterAdmin && userZone && userZone !== 'ALL' && userZone !== 'all') {
      query.$or = [{ zone: userZone.toUpperCase() }, { zone: userZone }];
    }

    const holdLeads = await Lead.find(query).sort({ holdAt: -1 });

    const formatted = holdLeads.map(l => ({
      _id: l._id,
      leadId: l.leadId || 'N/A',
      customerName: l.name,
      mobile: l.mobile,
      zone: l.zone || 'NORTH',
      product: l.productSubtype || 'Personal Loan',
      loanAmount: l.loanAmount || l.expectedAmount || '0',
      holdReason: l.holdReason || 'Customer requested time / comparing offers',
      holdAt: l.holdAt || l.updatedAt,
      rrmName: l.rrmName || 'Zone Head',
      armName: l.armName || 'Area Manager',
      rmName: l.rmName || 'Reporting Manager',
      reRoName: l.reRoName || l.createdByName || 'Field Officer',
      holdFollowUpBy: l.holdFollowUpBy || '',
      holdFollowUpRemarks: l.holdFollowUpRemarks || '',
      status: l.status
    }));

    res.status(200).json({ success: true, total: formatted.length, escalations: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Log follow-up on HOLD case (RM / RO / RE / Sales Head)
// @route   POST /api/sales/hold-followup
// @access  Private
const logHoldFollowUp = async (req, res) => {
  try {
    const { leadId, remarks, action = 'Follow-up Call' } = req.body;
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    lead.holdFollowUpBy = req.admin?.name || 'Reporting Manager';
    lead.holdFollowUpRemarks = remarks;

    if (action === 'Converted' || action === 'Accept') {
      lead.isHoldAlertActive = false;
      lead.workflowStage = 'Customer_Accepted';
      lead.status = 'Approved';
      lead.holdResolvedAt = new Date();
    } else if (action === 'Lost' || action === 'Reject') {
      lead.isHoldAlertActive = false;
      lead.workflowStage = 'Rejected';
      lead.status = 'Lost';
      lead.holdResolvedAt = new Date();
    }

    await lead.save();
    res.status(200).json({ success: true, message: 'Follow-up remarks saved successfully', lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get files awaiting Sales Head approval
// @route   GET /api/sales/pending-approvals
// @access  Private (Sales Head / Admin)
const getPendingSalesHeadApprovals = async (req, res) => {
  try {
    const { zone } = req.query;
    const query = { workflowStage: { $in: ['Sales_Head_Approval_Pending', 'Operations_KYC_Verification'] } };
    if (zone && zone !== 'ALL' && zone !== 'all') {
      query.zone = zone.toUpperCase();
    }

    const files = await Lead.find(query).sort({ updatedAt: -1 });
    res.status(200).json({ success: true, total: files.length, files });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const PARTNER_BANKS = [
  'Kotak Mahindra Bank Limited',
  'IDFC First Bank Limited',
  'HDFC Bank Limited',
  'ICICI Bank Limited',
  'YES Bank Limited'
];

// @desc    Get List of Approved Partner Banks
// @route   GET /api/sales/partner-banks
// @access  Private
const getPartnerBanks = async (req, res) => {
  res.status(200).json({ success: true, banks: PARTNER_BANKS });
};

// @desc    Dispatches Sales Head Approved File to Partner Bank(s) / NBFCs (Executed by Operation Manager / Admin)
// @route   PUT /api/sales/:id/dispatch-bank
// @access  Private (Operation Manager / Sales Head / Admin)
const approveAndDispatchToBank = async (req, res) => {
  try {
    const { 
      bankName, 
      bankBranch, 
      bankIfsc, 
      bankCode,
      channel = 'Email', 
      bankContactName, 
      bankOfficerDesignation,
      bankContactEmail, 
      bankContactPhone, 
      remarks,
      selectedLenders // Array of { name, shortName, code, category, defaultBranch, defaultIfsc }
    } = req.body;

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    // Determine lenders list
    let lendersToDispatch = [];
    if (Array.isArray(selectedLenders) && selectedLenders.length > 0) {
      lendersToDispatch = selectedLenders.map(l => ({
        name: l.name || l.shortName,
        shortName: l.shortName || l.name,
        code: l.code || '',
        category: l.category || 'Commercial Bank',
        channel: channel,
        branch: l.defaultBranch || bankBranch || `${lead.zone || 'North'} Zonal Credit Desk`,
        ifsc: l.defaultIfsc || bankIfsc || '',
        contactEmail: l.contactEmail || bankContactEmail || '',
        contactPhone: l.contactPhone || bankContactPhone || '',
        status: 'Dispatched',
        dispatchedAt: new Date()
      }));
    } else if (bankName) {
      lendersToDispatch = [{
        name: bankName,
        shortName: bankName,
        code: bankCode || '',
        category: 'Commercial Bank',
        channel: channel,
        branch: bankBranch || '',
        ifsc: bankIfsc || '',
        contactEmail: bankContactEmail || '',
        contactPhone: bankContactPhone || '',
        status: 'Dispatched',
        dispatchedAt: new Date()
      }];
    } else {
      return res.status(400).json({ success: false, message: 'Please select at least one Partner Bank or NBFC' });
    }

    lead.workflowStage = 'Bank_Dispatched';
    if (!lead.salesHeadApprovedAt) {
      lead.salesHeadApprovedAt = new Date();
      lead.salesHeadApprovedBy = req.admin?.name || 'Sales Head';
    }

    // Assign multiple lenders
    lead.dispatchedLenders = lendersToDispatch;

    // Backward-compatible primary/summary bank field
    const primaryLender = lendersToDispatch[0];
    const totalCount = lendersToDispatch.length;
    lead.dispatchedBankName = totalCount === 1 
      ? primaryLender.name 
      : `${primaryLender.shortName || primaryLender.name} +${totalCount - 1} more (${totalCount} Lenders)`;
    lead.dispatchedBankBranch = primaryLender.branch || bankBranch || '';
    lead.dispatchedBankIfsc = primaryLender.ifsc || bankIfsc || '';
    lead.dispatchedBankCode = primaryLender.code || bankCode || '';
    lead.dispatchedChannel = channel;
    lead.dispatchedAt = new Date();
    lead.dispatchedBy = req.admin?.name || 'Operation Manager';
    lead.bankOfficerName = bankContactName || '';
    lead.bankOfficerDesignation = bankOfficerDesignation || 'Credit Manager / Branch ASM';
    lead.bankOfficerEmail = bankContactEmail || '';
    lead.bankOfficerPhone = bankContactPhone || '';
    lead.status = 'Under Review';
    if (remarks) {
      lead.remarks = remarks;
    }

    await lead.save();

    // Create Notification
    const lenderSummary = totalCount === 1 
      ? primaryLender.name 
      : `${totalCount} Banks & NBFCs (${lendersToDispatch.map(l => l.shortName || l.name).slice(0, 3).join(', ')}${totalCount > 3 ? '...' : ''})`;

    await Notification.create({
      title: `Loan File Dispatched: ${lead.name} to ${totalCount} Lenders`,
      detail: `File (${lead.leadId || lead._id}) verified by Operations, approved by Sales Head, and dispatched to ${lenderSummary} via ${channel}.`,
      type: 'info',
      recipientId: null
    });

    res.status(200).json({ 
      success: true, 
      message: `File successfully dispatched to ${lenderSummary} via ${channel}!`,
      lead,
      totalLendersDispatched: totalCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all Files Dispatched to Banks / In Bank Decision Pipeline
// @route   GET /api/sales/bank-submissions
// @access  Private (Sales Head / RRM / ARM / RM)
const getBankSubmissions = async (req, res) => {
  try {
    const { zone, bank, stage } = req.query;
    const query = {
      workflowStage: {
        $in: [
          'Bank_Dispatched',
          'Bank_Sanctioned_Offer',
          'Customer_Offer_Pending',
          'Customer_Accepted',
          'Customer_HOLD',
          'Disbursed'
        ]
      }
    };

    if (zone && zone !== 'ALL' && zone !== 'all') {
      query.zone = zone.toUpperCase();
    }
    if (bank && bank !== 'ALL' && bank !== 'all') {
      query.dispatchedBankName = bank;
    }
    if (stage && stage !== 'ALL' && stage !== 'all') {
      query.workflowStage = stage;
    }

    const submissions = await Lead.find(query).sort({ dispatchedAt: -1, updatedAt: -1 });

    res.status(200).json({
      success: true,
      total: submissions.length,
      submissions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Record Bank Decision & Sanction Offer
// @route   PUT /api/sales/:id/bank-decision
// @access  Private
const recordBankDecision = async (req, res) => {
  try {
    const { decision, sanctionedAmount, sanctionedRoi, sanctionedTenure, processingFee, sanctionLetterNo, bankRemarks } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    if (decision === 'Sanctioned') {
      lead.workflowStage = 'Bank_Sanctioned_Offer';
      lead.offerStatus = 'Offered';
      lead.offerAmount = sanctionedAmount || lead.expectedAmount;
      lead.roi = sanctionedRoi || lead.roi || '10.5%';
      lead.tenure = sanctionedTenure || lead.tenure || '36';
      lead.sanctionLetterNo = sanctionLetterNo || '';
      lead.bankDecisionRemarks = bankRemarks || 'Sanctioned by Bank';
      lead.bankDecisionAt = new Date();
      lead.status = 'Approved';

      // Send automated Notification & FCM Push to Customer & Assigned Employee
      const { notifyEmployeeOrZone, notifyCustomer } = require('../services/firebaseService');

      // 1. Notify Customer directly
      await notifyCustomer({
        phone: lead.mobile,
        email: lead.email,
        title: `🎉 Bank Loan Sanctioned: ₹${Number(lead.offerAmount).toLocaleString()}`,
        body: `Congratulations! Bank ${lead.dispatchedBankName || 'Lender'} has approved your loan of ₹${Number(lead.offerAmount).toLocaleString()} at ${lead.roi} ROI. View and accept your offer now.`,
        data: {
          type: 'offer',
          leadId: lead.leadId || lead._id.toString(),
          actionScreen: 'OfferDetailsScreen'
        }
      });

      // 2. Notify Assigned Employee / Zone
      await notifyEmployeeOrZone({
        empId: lead.assignedToId || lead.createdById,
        zone: lead.zone,
        title: `🎉 Lead Sanctioned [${lead.zone} Zone]: ${lead.name}`,
        body: `Bank ${lead.dispatchedBankName || 'Partner'} sanctioned loan of ₹${Number(lead.offerAmount).toLocaleString()} for ${lead.name} (${lead.leadId}).`,
        data: {
          type: 'offer',
          leadId: lead.leadId || lead._id.toString(),
          customerName: lead.name
        }
      });
    } else if (decision === 'Rejected') {
      lead.workflowStage = 'Rejected';
      lead.status = 'Rejected';
      lead.bankDecisionRemarks = bankRemarks || 'Declined by Bank';
      lead.bankDecisionAt = new Date();

      const { notifyEmployeeOrZone, notifyCustomer } = require('../services/firebaseService');
      await notifyCustomer({
        phone: lead.mobile,
        email: lead.email,
        title: `Loan Application Update: ${lead.name}`,
        body: `Your loan application ${lead.leadId || ''} could not be approved at this time: ${bankRemarks || 'Declined by Bank Partner'}.`,
        data: { type: 'rejection', leadId: lead.leadId || lead._id.toString() }
      });
      await notifyEmployeeOrZone({
        empId: lead.assignedToId || lead.createdById,
        zone: lead.zone,
        title: `Lead Declined [${lead.zone}]: ${lead.name}`,
        body: `Bank rejected application for ${lead.name}: ${bankRemarks || 'Criteria not met'}.`,
        data: { type: 'rejection', leadId: lead.leadId || lead._id.toString() }
      });
    } else if (decision === 'Query') {
      lead.bankDecisionRemarks = `[Bank Query]: ${bankRemarks || 'Additional documents required'}`;
    }

    await lead.save();
    res.status(200).json({ success: true, message: `Bank decision (${decision}) updated successfully!`, lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Customer Decision on Bank Offer (Accept vs HOLD)
// @route   PUT /api/sales/:id/customer-decision
// @access  Public / Private
const customerOfferDecision = async (req, res) => {
  try {
    const { action, reason = '' } = req.body; // 'Accept' or 'Hold'
    const target = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(target);
    let lead = isObjectId 
      ? (await Lead.findById(target) || await Lead.findOne({ leadId: target }))
      : await Lead.findOne({ leadId: target });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    if (action === 'Accept' || action === 'Accepted') {
      lead.workflowStage = 'Customer_Accepted';
      lead.initiatedStage = 'Approved'; // Customer accepted offer -> moves to Approved in Initiated pipeline
      lead.inProcessStage = 'Lender Approved';
      lead.isHoldAlertActive = false;
      lead.status = 'Approved';
      lead.customerDecisionAt = new Date();
      lead.holdResolvedAt = new Date();
      lead.customerDecisionRemarks = 'Customer accepted bank offer. Proceeding to agreement sign and disbursal.';

      // Broadcast notification to Sales Head, RM, RO
      await Notification.create({
        title: `CUSTOMER ACCEPTED OFFER: ${lead.name} (₹${Number(lead.offerAmount || lead.expectedAmount || 0).toLocaleString()})`,
        detail: `Customer ${lead.name} (${lead.zone} Zone) accepted loan offer from ${lead.dispatchedBankName || 'Bank'}. Moving to Agreement Sign & Disbursal. RM: ${lead.rmName || 'Assigned RM'}, RO: ${lead.reRoName || 'Field RO'}.`,
        type: 'success',
        leadId: lead.leadId || lead._id.toString(),
        customerName: lead.name
      });
    } else if (action === 'Hold' || action === 'HOLD') {
      lead.workflowStage = 'Customer_HOLD';
      lead.initiatedStage = 'Decision Hold'; // System/Customer hold -> moves to Decision Hold
      lead.inProcessStage = 'Disbursal On Hold';
      lead.isHoldAlertActive = true;
      lead.holdReason = reason || 'Customer requested time / evaluating ROI & terms';
      lead.holdAt = new Date();
      lead.status = 'HOLD';
      lead.customerDecisionRemarks = reason;

      // Create High Priority Escalation Notification to RRM, ARM, RM, RO, RE
      await Notification.create({
        title: `CUSTOMER ON HOLD ALERT: ${lead.name} (₹${Number(lead.offerAmount || lead.expectedAmount || 0).toLocaleString()})`,
        detail: `Customer ${lead.name} (${lead.zone} Zone) has placed the loan offer from ${lead.dispatchedBankName || 'Bank'} on HOLD. Reason: ${reason || 'ROI/Terms review requested'}. Assigned RM: ${lead.rmName || 'N/A'}, RO: ${lead.reRoName || 'N/A'}. Urgent re-engagement required!`,
        type: 'warning',
        leadId: lead.leadId || lead._id.toString(),
        customerName: lead.name,
        actionScreen: '/sales/hold-escalations'
      });
    }

    await lead.save();
    res.status(200).json({ 
      success: true, 
      message: action === 'Accept' ? 'Offer accepted! Moving to Agreement & Disbursal.' : 'Case marked on HOLD. Escalation alert generated for RRM, ARM, RM, RO, RE.',
      lead 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Sales Head Approves File for Bank Partner Dispatch
// @route   PUT /api/sales/:id/approve-file
// @access  Private (Sales Head / Admin)
const approveFileBySalesHead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    lead.workflowStage = 'Sales_Head_Approved';
    lead.salesHeadApprovedAt = new Date();
    lead.salesHeadApprovedBy = req.admin?.name || 'Sales Head';
    lead.salesHeadRemarks = req.body.remarks || 'Approved for Bank Partner Dispatch';
    lead.status = 'Qualified';

    await lead.save();
    res.status(200).json({ success: true, message: 'File approved by Sales Head. Ready for Bank Partner Dispatch.', lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Sales Head Returns/Rejects File with Query
// @route   PUT /api/sales/:id/reject-file
// @access  Private (Sales Head / Admin)
const rejectFileBySalesHead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    lead.workflowStage = 'Operations_KYC_Verification'; // Send back to operations
    lead.salesHeadRemarks = `[Query / Returned by Sales Head]: ${req.body.remarks || 'Need additional verification'}`;

    await lead.save();
    res.status(200).json({ success: true, message: 'File returned to Operations with query.', lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// @desc    Get Chart Analytics Data for Sales Dashboard
// @route   GET /api/sales/chart-analytics
// @access  Private (Sales Head / Admin)
const getChartAnalytics = async (req, res) => {
  try {
    const { zone } = req.query;
    const zoneFilter = (zone && zone !== 'ALL' && zone !== 'all') ? { zone: zone.toUpperCase() } : {};

    // 1. Monthly Lead Trend (last 6 months)
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      });
    }
    const monthlyTrend = await Promise.all(months.map(async (m) => {
      const leads = await Lead.countDocuments({ ...zoneFilter, createdAt: { $gte: m.start, $lte: m.end } });
      const disbursed = await Lead.countDocuments({ ...zoneFilter, workflowStage: 'Disbursed', createdAt: { $gte: m.start, $lte: m.end } });
      const hold = await Lead.countDocuments({ ...zoneFilter, isHoldAlertActive: true, createdAt: { $gte: m.start, $lte: m.end } });
      return { month: m.label, Leads: leads, Disbursed: disbursed, Hold: hold };
    }));

    // 2. Product Category Distribution (Pie Chart)
    const productAgg = await Lead.aggregate([
      { $match: zoneFilter },
      { $group: { _id: { $ifNull: ['$productSubtype', '$productCategory'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);
    const productData = productAgg.map(p => ({ name: p._id || 'Personal Loan', value: p.count }));

    // 3. Workflow Stage Funnel (Horizontal Bar)
    const stageLabels = {
      'Field_Lead_Created': 'New Lead',
      'Telecaller_Assigned': 'Telecaller',
      'Customer_Confirmed': 'Confirmed',
      'RM_Assigned': 'RM Assigned',
      'Operations_KYC_Verification': 'KYC Verify',
      'Sales_Head_Approval_Pending': 'Pending Approval',
      'Sales_Head_Approved': 'SH Approved',
      'Bank_Dispatched': 'Bank Sent',
      'Bank_Sanctioned_Offer': 'Bank Offer',
      'Customer_Accepted': 'Accepted',
      'Customer_HOLD': 'On Hold',
      'Disbursed': 'Disbursed',
      'Rejected': 'Rejected'
    };
    const stageFunnelAgg = await Lead.aggregate([
      { $match: zoneFilter },
      { $group: { _id: '$workflowStage', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const stageFunnel = stageFunnelAgg.map(s => ({
      stage: stageLabels[s._id] || s._id || 'Unknown',
      count: s.count
    }));

    // 4. Zone Comparison Bar Chart
    const zones = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'];
    const zoneComparison = await Promise.all(zones.map(async (z) => {
      const total = await Lead.countDocuments({ zone: z });
      const disbursed = await Lead.countDocuments({ zone: z, workflowStage: 'Disbursed' });
      const hold = await Lead.countDocuments({ zone: z, isHoldAlertActive: true });
      const approved = await Lead.countDocuments({ zone: z, workflowStage: { $in: ['Sales_Head_Approved', 'Bank_Dispatched', 'Bank_Sanctioned_Offer', 'Customer_Accepted', 'Disbursed'] } });
      return { zone: z, Total: total, Disbursed: disbursed, Hold: hold, Approved: approved };
    }));

    // 5. Loan Amount Distribution (Range Buckets)
    const amountBuckets = [
      { label: 'Under 1L', min: 0, max: 100000 },
      { label: '1L–5L', min: 100000, max: 500000 },
      { label: '5L–10L', min: 500000, max: 1000000 },
      { label: '10L–25L', min: 1000000, max: 2500000 },
      { label: '25L–50L', min: 2500000, max: 5000000 },
      { label: '50L+', min: 5000000, max: 999999999 }
    ];
    const amountDist = await Promise.all(amountBuckets.map(async (b) => {
      const count = await Lead.countDocuments({
        ...zoneFilter,
        $or: [
          { expectedAmount: { $gte: b.min, $lt: b.max } },
          { loanAmount: { $gte: b.min, $lt: b.max } }
        ]
      });
      return { range: b.label, count };
    }));

    res.status(200).json({
      success: true,
      charts: {
        monthlyTrend,
        productData,
        stageFunnel,
        zoneComparison,
        amountDist
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    RM assigns completed file to Operation Admin / Manager for KYC verification
// @route   PUT /api/sales/:id/assign-operations
// @access  Private (RM / Admin)
const assignFileToOperations = async (req, res) => {
  try {
    const { id } = req.params;
    const { operationsRemarks = 'File completed by RM & Telecaller, submitted for KYC verification' } = req.body;

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    lead.workflowStage = 'Operations_KYC_Verification';
    lead.operationsRemarks = operationsRemarks;
    lead.rmName = req.admin?.name || lead.rmName || 'RM';
    lead.rmId = req.admin?._id || lead.rmId;
    await lead.save();

    // Create Notification for Operations team
    await Notification.create({
      title: `📑 New File Assigned for KYC Verification: ${lead.name}`,
      detail: `RM ${lead.rmName} has completed lead ${lead.leadId || lead.name} (₹${lead.expectedAmount || lead.loanAmount || 0}) and assigned it to Operations.`,
      type: 'alert',
      recipientId: null
    });

    res.status(200).json({
      success: true,
      message: 'File successfully completed and assigned to Operation Manager for KYC verification!',
      lead
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Operation Manager completes KYC verification and submits file to Sales Head for Approval
// @route   PUT /api/sales/:id/submit-sales-approval
// @access  Private (Operation Manager / Admin)
const submitKYCToSalesHead = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks = 'KYC & Bank statement verified. Submitted for Sales Head approval.' } = req.body;

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    lead.workflowStage = 'Sales_Head_Approval_Pending';
    lead.operationsVerifiedAt = new Date();
    lead.operationsVerifiedBy = req.admin?.name || 'Operation Manager';
    lead.operationsRemarks = remarks;
    lead.status = 'Under Review';
    await lead.save();

    // Create Notification for Sales Head
    await Notification.create({
      title: `Approval Required: ${lead.name} (${lead.zone} Zone)`,
      detail: `Operation Manager ${lead.operationsVerifiedBy} has verified KYC for ${lead.leadId || lead.name} (₹${lead.expectedAmount || lead.loanAmount || 0}). Awaiting Sales Head approval before Bank Dispatch.`,
      type: 'alert',
      recipientId: null
    });

    res.status(200).json({
      success: true,
      message: 'KYC verified! File submitted to Sales Head for Approval.',
      lead
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSalesDashboardMetrics,
  getZonalSalesTree,
  sendHiringRequestToHR,
  getHiringRequisitions,
  getHoldEscalations,
  logHoldFollowUp,
  getPendingSalesHeadApprovals,
  submitKYCToSalesHead,
  approveFileBySalesHead,
  rejectFileBySalesHead,
  getChartAnalytics,
  getPartnerBanks,
  approveAndDispatchToBank,
  getBankSubmissions,
  recordBankDecision,
  customerOfferDecision,
  assignFileToOperations,
  getRMWorkflowMetrics,
  getRMLeadsForReview,
  rmReviewLeadAction
};


// ═══════════════════════════════════════════════════════════
// RM (Reporting Manager) Workflow Controllers
// ═══════════════════════════════════════════════════════════

// @desc    Get RM-specific dashboard KPI metrics
// @route   GET /api/sales/rm-metrics
// @access  Private (RM / Admin)
async function getRMWorkflowMetrics(req, res) {
  try {
    const { zone } = req.query;
    const adminZone = req.admin?.zone;
    const roleLower = (req.admin?.role || '').toLowerCase();
    const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'sales head', 'sales_head'].includes(roleLower);

    let zoneFilter = {};
    if (zone && zone !== 'ALL' && zone !== 'all') {
      zoneFilter.$or = [{ zone: zone.toUpperCase() }, { zone: zone }];
    } else if (!isMasterAdmin && adminZone && adminZone !== 'ALL' && adminZone !== 'all') {
      zoneFilter.$or = [{ zone: adminZone.toUpperCase() }, { zone: adminZone }];
    }

    const pendingReview = await Lead.countDocuments({
      ...zoneFilter,
      $or: [
        { workflowStage: 'Field_Lead_Created' },
        { workflowStage: 'RM_Telecaller_Review' },
        { workflowStage: { $exists: false } },
        { workflowStage: null },
        { workflowStage: '' },
        { status: { $in: ['New', 'Unassigned', 'Pending', 'Application Pending', 'Draft', 'LEAD_SUBMITTED', 'Under Review'] } }
      ],
      workflowStage: { $nin: ['Customer_Confirmed', 'Operations_KYC_Verification', 'Sales_Head_Approval_Pending', 'Sales_Head_Approved', 'Bank_Dispatched', 'Bank_Sanctioned_Offer', 'Customer_Accepted', 'Disbursed', 'Rejected'] }
    });

    const withTelecaller = await Lead.countDocuments({
      ...zoneFilter,
      $or: [
        { workflowStage: 'RM_Telecaller_Review' },
        { status: { $in: ['Contacted', 'Assigned', 'Under Review', 'Follow-up', 'In Progress', 'Calling'] } }
      ],
      workflowStage: { $nin: ['Customer_Confirmed', 'Operations_KYC_Verification', 'Sales_Head_Approval_Pending', 'Sales_Head_Approved', 'Bank_Dispatched', 'Bank_Sanctioned_Offer', 'Customer_Accepted', 'Disbursed', 'Rejected'] }
    });

    const customerConfirmed = await Lead.countDocuments({
      ...zoneFilter,
      $or: [
        { workflowStage: 'Customer_Confirmed' },
        { status: { $in: ['Interested', 'Application Submitted', 'Converted', 'Documents Received', 'Qualified', 'Approved'] } }
      ],
      workflowStage: { $nin: ['Operations_KYC_Verification', 'Sales_Head_Approval_Pending', 'Sales_Head_Approved', 'Bank_Dispatched', 'Bank_Sanctioned_Offer', 'Disbursed', 'Rejected'] }
    });

    const holdCases = await Lead.countDocuments({ ...zoneFilter, isHoldAlertActive: true });
    const disbursed = await Lead.countDocuments({ ...zoneFilter, workflowStage: 'Disbursed' });
    const totalActive = await Lead.countDocuments({
      ...zoneFilter,
      workflowStage: { $nin: ['Rejected', 'Disbursed'] }
    });

    // Disbursed amount
    const disbursedDocs = await Lead.find({ ...zoneFilter, workflowStage: 'Disbursed' }).select('expectedAmount loanAmount');
    let disbursedAmount = 0;
    for (const doc of disbursedDocs) {
      const val = parseFloat(doc.loanAmount || doc.expectedAmount || 0);
      if (!isNaN(val)) disbursedAmount += val;
    }

    // Field team count (RO/RE employees)
    const empZoneQuery = zoneFilter.$or ? { $or: zoneFilter.$or } : {};
    const fieldTeamCount = await Employee.countDocuments({
      ...empZoneQuery,
      status: 'Active'
    });

    res.status(200).json({
      success: true,
      metrics: {
        pendingReview,
        withTelecaller,
        customerConfirmed,
        holdCases,
        disbursed,
        totalActive,
        disbursedAmount,
        fieldTeamCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// @desc    Get leads at various RM-relevant workflow stages
// @route   GET /api/sales/rm-leads
// @access  Private (RM / Admin)
async function getRMLeadsForReview(req, res) {
  try {
    const { stage = 'pending', zone, page = 1, limit = 100 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = {};
    const adminZone = req.admin?.zone;
    const adminId = req.admin?._id?.toString();
    const adminName = req.admin?.name || '';
    const roleLower = (req.admin?.role || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const zonalLower = (req.admin?.zonalRole || '').toLowerCase();
    const isMasterAdmin = ['superadmin', 'admin', 'saleshead'].includes(roleLower) || ['super admin', 'sales head', 'operations head', 'operation admin'].includes((req.admin?.role || '').toLowerCase());
    const isRRM = roleLower === 'rrm' || zonalLower === 'rrm';
    const isARM = roleLower === 'arm' || zonalLower === 'arm';
    const isRM  = roleLower === 'rm'  || zonalLower === 'rm';

    // ─── Zone + RM Scope Filter ───────────────────────────────────────────────
    if (isMasterAdmin) {
      // Super Admin / Sales Head — see all zones; optionally filter by explicit zone param
      if (zone && zone !== 'ALL' && zone !== 'all') {
        filter.zone = zone.toUpperCase();
      }
    } else if (isRRM) {
      // RRM — sees only their zone
      const rmZone = (zone && zone !== 'ALL') ? zone.toUpperCase() : (adminZone && adminZone !== 'ALL' ? adminZone.toUpperCase() : null);
      if (rmZone) filter.zone = rmZone;
    } else if (isARM) {
      // ARM — sees only their zone leads
      const armZone = (zone && zone !== 'ALL') ? zone.toUpperCase() : (adminZone && adminZone !== 'ALL' ? adminZone.toUpperCase() : null);
      if (armZone) filter.zone = armZone;
      // Also restrict to leads whose armId matches this ARM
      filter.$or = [
        { armId: adminId },
        { armName: adminName },
        { zone: armZone || adminZone }
      ];
    } else if (isRM) {
      // RM — sees only their zone leads + leads assigned to them
      const rmZone = (zone && zone !== 'ALL') ? zone.toUpperCase() : (adminZone && adminZone !== 'ALL' ? adminZone.toUpperCase() : null);
      filter.$or = [
        { rmId: adminId },
        { rmName: adminName },
        ...(rmZone ? [{ zone: rmZone }] : [])
      ];
    } else {
      // Other roles — zone-restricted
      const targetZone = (zone && zone !== 'ALL') ? zone.toUpperCase() : (adminZone && adminZone !== 'ALL' ? adminZone.toUpperCase() : null);
      if (targetZone) filter.zone = targetZone;
    }

    if (stage === 'pending') {
      // Leads for RM to review (both fresh field leads and active telecaller calling leads)
      const pendingCriteria = {
        $or: [
          { workflowStage: 'Field_Lead_Created' },
          { workflowStage: 'RM_Telecaller_Review' },
          { workflowStage: { $exists: false } },
          { workflowStage: null },
          { workflowStage: '' },
          { status: { $in: ['New', 'Unassigned', 'Pending', 'Application Pending', 'Draft', 'LEAD_SUBMITTED', 'Under Review'] } }
        ],
        workflowStage: { $nin: ['Customer_Confirmed', 'Operations_KYC_Verification', 'Sales_Head_Approval_Pending', 'Sales_Head_Approved', 'Bank_Dispatched', 'Bank_Sanctioned_Offer', 'Customer_Accepted', 'Disbursed', 'Rejected'] }
      };

      if (filter.$or) {
        filter = { $and: [{ $or: filter.$or }, pendingCriteria] };
      } else {
        filter = { ...filter, ...pendingCriteria };
      }
    } else if (stage === 'telecaller') {
      // Leads currently with telecaller after RM approval
      const telecallerCriteria = {
        $or: [
          { workflowStage: 'RM_Telecaller_Review' },
          { status: { $in: ['Contacted', 'Assigned', 'Under Review', 'Follow-up', 'In Progress', 'Calling'] } }
        ],
        workflowStage: { $nin: ['Customer_Confirmed', 'Operations_KYC_Verification', 'Sales_Head_Approval_Pending', 'Sales_Head_Approved', 'Bank_Dispatched', 'Bank_Sanctioned_Offer', 'Customer_Accepted', 'Disbursed', 'Rejected'] }
      };

      if (filter.$or) {
        filter = { $and: [{ $or: filter.$or }, telecallerCriteria] };
      } else {
        filter = { ...filter, ...telecallerCriteria };
      }
    } else if (stage === 'completed') {
      // Telecaller confirmed - RM can now assign to Ops
      const completedCriteria = {
        $or: [
          { workflowStage: 'Customer_Confirmed' },
          { status: { $in: ['Interested', 'Application Submitted', 'Converted', 'Documents Received', 'Qualified', 'Approved'] } }
        ],
        workflowStage: { $nin: ['Operations_KYC_Verification', 'Sales_Head_Approval_Pending', 'Sales_Head_Approved', 'Bank_Dispatched', 'Bank_Sanctioned_Offer', 'Disbursed', 'Rejected'] }
      };

      if (filter.$or) {
        filter = { $and: [{ $or: filter.$or }, completedCriteria] };
      } else {
        filter = { ...filter, ...completedCriteria };
      }
    } else if (stage === 'hold') {
      filter.isHoldAlertActive = true;
    } else {
      // All active leads
      filter.workflowStage = { $nin: ['Disbursed', 'Rejected'] };
    }

    const total = await Lead.countDocuments(filter);
    const leads = await Lead.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('leadId name customName mobile mobNo altMobile email entityName panNumber expectedAmount loanAmount productCategory productSubtype programType facilityType constitutionType city state pincode currentAddressDetails permanentAddressDetails zone branch source status workflowStage rmName rmReviewAction isHoldAlertActive holdReason holdAt telecallerNotes telecallerConfirmedAt telecallerConfirmedBy createdAt rmReviewRemarks followUps');

    // Normalize field names so frontend always gets values reliably
    const normalizedLeads = leads.map(l => {
      const obj = l.toObject();
      return {
        ...obj,
        name: obj.name || obj.customName || 'Customer',
        mobile: obj.mobile || obj.mobNo || '',
        expectedAmount: obj.expectedAmount || obj.loanAmount || 0,
        zone: obj.zone || 'NORTH'
      };
    });

    res.status(200).json({
      success: true,
      leads: normalizedLeads,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// @desc    RM adds review notes/remarks on a lead (NO approval needed — lead already auto-forwarded to Telecaller)
// @route   PUT /api/sales/:id/rm-review
// @access  Private (RM / Admin)
async function rmReviewLeadAction(req, res) {
  try {
    const { id } = req.params;
    // action: 'Notes' (add review notes) | 'Reject' (RM can reject a bad/duplicate lead) | 'Assign_Ops' (send to Operations after Telecaller confirms)
    const { action = 'Notes', remarks = '' } = req.body;

    if (!['Notes', 'Reject', 'Assign_Ops', 'Approved', 'Rejected'].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'Notes', 'Reject', or 'Assign_Ops'" });
    }

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const reviewerName = req.admin?.name || 'RM';
    const reviewerId = req.admin?._id?.toString();

    // Always save RM review notes
    lead.rmReviewedAt = new Date();
    lead.rmReviewedBy = reviewerName;
    lead.rmReviewRemarks = remarks || lead.rmReviewRemarks;
    lead.rmReviewAction = action;

    if (action === 'Reject' || action === 'Rejected') {
      // RM can reject a bad/spam/duplicate lead
      lead.workflowStage = 'Rejected';
      lead.status = 'Rejected';

      await lead.save();
      return res.status(200).json({
        success: true,
        message: 'Lead rejected by RM.',
        lead
      });
    }

    if (action === 'Assign_Ops' || action === 'Approved') {
      // RM sends telecaller-confirmed file to Operations
      lead.workflowStage = 'Operations_KYC_Verification';
      lead.status = 'Under Review';
      lead.assignedToOpsAt = new Date();
      lead.assignedToOpsBy = reviewerName;
      lead.operationsRemarks = remarks || 'File sent to Operations by RM.';

      await Notification.create({
        title: `📁 File Assigned to Operations: ${lead.name} (${lead.zone} Zone)`,
        detail: `RM ${reviewerName} has sent lead ${lead.leadId || lead.name} (₹${lead.expectedAmount || 0}) to Operations for KYC Verification.`,
        type: 'info',
        recipientId: null
      });

      await lead.save();
      return res.status(200).json({
        success: true,
        message: 'File assigned to Operations for KYC verification!',
        lead
      });
    }

    // Default: Just save notes/remarks without changing workflowStage
    // Lead stays in RM_Telecaller_Review — both RM and Telecaller are working simultaneously
    await lead.save();

    res.status(200).json({
      success: true,
      message: 'RM review notes saved. Lead continues with Telecaller.',
      lead
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}



