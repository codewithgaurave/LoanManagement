const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const LoanApplication = require('../models/LoanApplication');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');
const { getAutoAssignedRMAndTelecaller } = require('../utils/leadAssignmentHelper');

// @desc    Create a new Lead with Auto-Assignment (Zone-Specific RM + Round-Robin Telecaller)
// @route   POST /api/leads
// @access  Private
const createLead = async (req, res) => {
  try {
    const emp = req.admin ? await Employee.findById(req.admin._id) : null;
    const resolvedEmpId = emp?.empId || req.admin?.empId || req.body.createdByEmpId || req.body.createdById;
    const targetZone = (req.body.zone || emp?.zone || req.admin?.zone || 'NORTH').toUpperCase();

    // 1. Auto-assign Zone RM & Alternate Telecaller (Round-Robin Pan-India)
    const { rm: autoRM, telecaller: autoTelecaller } = await getAutoAssignedRMAndTelecaller(targetZone);

    const isEmployeeGenerated = Boolean(req.admin || req.body.createdById || req.body.createdByEmpId);
    const creatorName = emp ? emp.name : (req.admin ? `${req.admin.firstName || req.admin.name || ''}`.trim() : (req.body.createdByName || 'Customer Direct'));
    const creatorDesignation = emp ? (emp.designation || emp.zonalRole || emp.role) : (req.admin ? req.admin.role : 'Customer Self');
    const creatorRole = emp ? (emp.zonalRole || emp.role) : (req.admin ? req.admin.role : 'Customer');
    const creatorEmpId = resolvedEmpId || null;

    // Normalization for Mobile App & Web inputs to match Schema Enums
    const rawProgram = (req.body.programType || 'FRESH').toString().trim().toUpperCase();
    const programTypeMap = {
      'EXISTING': 'EXISTING',
      'FRESH': 'FRESH',
      'TOP-UP': 'TOP-UP',
      'TOPUP': 'TOP-UP',
      'BT': 'BT LOAN',
      'BT LOAN': 'BT LOAN',
      'OTHER': 'OTHER'
    };
    const normalizedProgramType = programTypeMap[rawProgram] || 'FRESH';

    const rawConstitution = (req.body.constitutionType || 'Sole Proprietor').toString().trim();
    const constitutionMap = {
      'SP': 'Sole Proprietor',
      'Sole Proprietor': 'Sole Proprietor',
      'PS': 'Partnership',
      'Partnership': 'Partnership',
      'LLP': 'LLP-Limited Liability Partnership',
      'LLP-Limited Liability Partnership': 'LLP-Limited Liability Partnership',
      'OPC': 'OPC-One Person Company',
      'OPC-One Person Company': 'OPC-One Person Company',
      'Pvt Ltd': 'Private Limited',
      'Private Limited': 'Private Limited',
      'PL': 'Public Limited',
      'Public Limited': 'Public Limited',
      'Individual': 'Individual'
    };
    const normalizedConstitutionType = constitutionMap[rawConstitution] || 'Sole Proprietor';

    const rawFacility = (req.body.facilityType || 'Term Loan').toString().trim();
    const facilityMap = {
      'Term Loan': 'Term Loan',
      'Working Capital': 'Working Capital',
      'Flexi OD': 'Flexi OD Loan',
      'Flexi OD Loan': 'Flexi OD Loan',
      'Other': 'Other'
    };
    const normalizedFacilityType = facilityMap[rawFacility] || 'Term Loan';

    const rawFinancial = (req.body.financialProgram || 'ABB').toString().trim();
    const financialMap = {
      'ABB': 'ABB',
      'GST': 'GST',
      'GST-R': 'GST',
      'DSCR': 'DSCR',
      'Non-DSCR': 'Non-DSCR',
      'General': 'General'
    };
    const normalizedFinancialProgram = financialMap[rawFinancial] || 'ABB';

    // Pipeline Stage & Draft Classification:
    // When a lead is initiated/added:
    // - Default goes to Draft with draftStatus: 'Application Pending'
    // - If documents are missing, 'Doc\'s Pending'
    // - If marked as on hold, 'Custom HOLD'
    const docs = Array.isArray(req.body.documents) ? req.body.documents : [];
    const hasUploadedDocs = docs.length > 0;
    const isHold = Boolean(req.body.isHold || req.body.holdReason || req.body.draftStatus === 'Custom HOLD');

    let initialIsDraft = true;
    let initialDraftStatus = 'Application Pending';
    let initialInProcessStage = req.body.inProcessStage || 'Logins';
    let initialStatus = 'In-Draft';

    if (isHold) {
      initialDraftStatus = 'Custom HOLD';
      initialStatus = 'HOLD';
    } else if (req.body.draftStatus === "Doc's Pending" || req.body.draftStatus === 'Documents Pending') {
      initialDraftStatus = "Doc's Pending";
      initialStatus = 'Documents Pending';
    } else if (req.body.isDraft === false && hasUploadedDocs) {
      // If user submits with all documents uploaded, it qualifies for Submitted (In-Process)
      initialIsDraft = false;
      initialDraftStatus = 'Application Pending';
      initialStatus = 'Submitted';
    }

    const leadData = {
      ...req.body,
      isDraft: req.body.isDraft !== undefined ? req.body.isDraft : initialIsDraft,
      draftStatus: req.body.draftStatus || initialDraftStatus,
      inProcessStage: initialInProcessStage,
      status: req.body.status || initialStatus,
      submissionType: initialIsDraft ? 'LINK_GENERATED' : 'SUBMITTED',
      name: req.body.name || req.body.customName || 'Customer',
      mobile: req.body.mobile || req.body.mobNo || '',
      programType: normalizedProgramType,
      constitutionType: normalizedConstitutionType,
      facilityType: normalizedFacilityType,
      financialProgram: normalizedFinancialProgram,
      
      // Generator & Source Tracking
      generatorType: isEmployeeGenerated ? 'Employee' : 'Customer',
      source: req.body.source || (isEmployeeGenerated ? 'Employee App' : 'Customer App'),
      createdById: req.body.createdById || creatorEmpId || (req.admin ? req.admin._id.toString() : null),
      createdByEmpId: req.body.createdByEmpId || creatorEmpId || (emp ? emp.empId : null),
      createdByRole: req.body.createdByRole || creatorRole,
      createdByDesignation: req.body.createdByDesignation || creatorDesignation,
      createdByName: req.body.createdByName || creatorName,

      // Directly sent to both Telecaller & RM (No manual approval needed to start calling)
      workflowStage: req.body.workflowStage || 'RM_Telecaller_Review',
      zone: targetZone,
      rrmId: req.body.rrmId || emp?.rrmId || null,
      rrmName: req.body.rrmName || emp?.rrmName || null,
      armId: req.body.armId || emp?.armId || null,
      armName: req.body.armName || emp?.armName || null,
      
      // Auto-assign Zone-specific RM
      rmId: req.body.rmId || autoRM?._id || emp?.rmId || null,
      rmName: req.body.rmName || autoRM?.name || emp?.rmName || null,

      // Auto-assign Pan-India Telecaller (Round-Robin Alternate)
      telecallerId: req.body.telecallerId || autoTelecaller?._id || null,
      telecallerName: req.body.telecallerName || autoTelecaller?.name || null,
      assignedTo: req.body.assignedTo || autoTelecaller?.name || null,
      assignedToId: req.body.assignedToId || (autoTelecaller ? autoTelecaller._id.toString() : null),
      assignedAt: new Date(),
      assignedBy: 'System Auto-Assign',

      reRoId: req.admin ? req.admin._id : null,
      reRoName: req.admin ? req.admin.name : null
    };

    const lead = new Lead(leadData);
    const createdLead = await lead.save();

    // Send notifications to assigned RM & Telecaller
    const { notifyEmployeeOrZone } = require('../services/firebaseService');
    if (autoTelecaller) {
      await notifyEmployeeOrZone({
        recipientId: autoTelecaller._id,
        empId: autoTelecaller.empId || null,
        zone: targetZone,
        title: `📞 New Lead Assigned [${targetZone} Zone]: ${createdLead.name}`,
        body: `Lead ${createdLead.leadId || createdLead.name} (${targetZone} Zone, Amount: ₹${createdLead.expectedAmount || 0}) auto-assigned to you for calling.`,
        data: {
          type: 'info',
          leadId: createdLead.leadId || createdLead._id.toString(),
          customerName: createdLead.name
        }
      }).catch(e => console.warn('Notification error (Telecaller):', e.message));
    }

    if (autoRM) {
      await notifyEmployeeOrZone({
        recipientId: autoRM._id,
        empId: autoRM.empId || null,
        zone: targetZone,
        title: `📋 New Lead For RM Review [${targetZone} Zone]: ${createdLead.name}`,
        body: `New lead ${createdLead.leadId || createdLead.name} created and active for review in ${targetZone} zone.`,
        data: {
          type: 'info',
          leadId: createdLead.leadId || createdLead._id.toString(),
          customerName: createdLead.name
        }
      }).catch(e => console.warn('Notification error (RM):', e.message));
    }

    res.status(201).json({ success: true, lead: createdLead });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get all Leads
// @route   GET /api/leads
// @access  Private
const getLeads = async (req, res) => {
  try {
    const { status, source, unassigned, assignedToId, zone, approvalStage } = req.query;
    let query = {};

    const roleLower = (req.admin?.role || '').toLowerCase();
    const zonalLower = (req.admin?.zonalRole || '').toLowerCase();
    const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'sales head', 'sales_head', 'operations head', 'operation admin'].includes(roleLower) || zonalLower === 'sales head';
    const adminZone = req.admin?.zone;

    // Zonal Filtering
    if (zone && zone !== 'ALL' && zone !== 'all') {
      query.zone = zone.toUpperCase();
    } else if (!isMasterAdmin && adminZone && adminZone !== 'ALL') {
      // Zonal Head or Staff restricted to their Zone
      query.zone = adminZone;
    }

    if (isMasterAdmin) {
      if (unassigned === 'true') {
        query.assignedToId = null;
      } else if (unassigned === 'false') {
        query.assignedToId = { $ne: null };
      }
      
      if (assignedToId) {
        query.assignedToId = assignedToId;
      }
    } else {
      // Check if user is a Zonal Head / RRM / ARM / RM / TL / Credit / Accounts
      const isHeadOrManager = ['hr head', 'zonal head', 'sales head', 'rrm', 'arm', 'rm', 'branch manager', 'team leader', 'credit manager', 'accountant', 'operation manager'].some(r => roleLower.includes(r) || zonalLower.includes(r));
      
      if (!isHeadOrManager) {
        // Field Officer (RO / RE) or Telecaller
        const adminIdStr = req.admin ? req.admin._id.toString() : '';
        const adminEmpId = req.admin ? req.admin.empId : '';
        const adminNameStr = req.admin ? req.admin.name : '';
        const isTele = roleLower.includes('tele');

        if (isTele) {
          query.$or = [
            { workflowStage: 'RM_Telecaller_Review' },
            { telecallerConfirmedAt: { $ne: null } },
            { telecallerId: adminIdStr },
            { telecallerName: adminNameStr },
            { assignedToId: adminIdStr },
            ...(adminEmpId ? [{ assignedToId: adminEmpId }, { telecallerId: adminEmpId }] : []),
            { assignedTo: adminNameStr },
            { "followUps.0": { $exists: true } },
            { status: { $in: ['Under Review', 'Interested', 'Follow-up', 'Documents Pending', 'Contacted'] } }
          ];
        } else {
          // Field RO / RE: Strictly leads created by or assigned to this officer
          const roCriteria = [
            { createdById: adminIdStr },
            { assignedToId: adminIdStr },
            { reRoId: adminIdStr }
          ];
          if (adminEmpId) {
            roCriteria.push({ createdById: adminEmpId });
            roCriteria.push({ createdByEmpId: adminEmpId });
            roCriteria.push({ assignedToId: adminEmpId });
            roCriteria.push({ reRoId: adminEmpId });
          }
          if (adminNameStr) {
            roCriteria.push({ createdByName: adminNameStr });
            roCriteria.push({ assignedTo: adminNameStr });
            roCriteria.push({ reRoName: adminNameStr });
          }
          query.$or = roCriteria;
        }
      }
    }

    // Strict Role Stage Gating & Desk Filtering
    const desk = req.query.desk;
    const isOpsUser = roleLower.includes('operation') || desk === 'operations';

    if (isOpsUser) {
      // Operations ONLY sees files that have been explicitly forwarded by Telecaller/RM
      // They MUST NOT see 'RM_Telecaller_Review' or unforwarded initial leads
      query.workflowStage = {
        $in: [
          'Operations_KYC_Verification',
          'Sales_Head_Approval_Pending',
          'Sales_Head_Approved',
          'Ready_For_Bank_Dispatch',
          'Bank_Dispatched',
          'Bank_Sanctioned_Offer',
          'Customer_Decision',
          'Customer_Accepted',
          'Customer_HOLD',
          'Disbursed'
        ]
      };
    }

    if (status && status !== 'all') query.status = status;
    if (source && source !== 'all') query.source = source;
    if (approvalStage && approvalStage !== 'all') query.approvalStage = approvalStage;

    const leads = await Lead.find(query).sort({ createdAt: -1 });
    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single Lead
// @route   GET /api/leads/:id
// @access  Private
const getLeadById = async (req, res) => {
  try {
    const idParam = req.params.id;
    let lead = null;
    
    if (mongoose.Types.ObjectId.isValid(idParam)) {
      lead = await Lead.findById(idParam);
    }
    
    if (!lead) {
      lead = await Lead.findOne({
        $or: [
          { leadId: idParam },
          { lanId: idParam }
        ]
      });
    }

    if (lead) {
      res.status(200).json(lead);
    } else {
      res.status(404).json({ message: 'Lead not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Public Lead by LeadId (for Application Link Landing Page)
// @route   GET /api/leads/public/:leadId
// @access  Public
const getPublicLeadByLeadId = async (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = await Lead.findOne({ 
      $or: [{ leadId: leadId }, { _id: leadId.match(/^[0-9a-fA-F]{24}$/) ? leadId : null }]
    }).select('leadId name entityName mobile email expectedAmount productCategory productSubtype programType status applicationLink createdAt');
    
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Invalid or expired loan application link' });
    }
    res.status(200).json({ success: true, lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Lead Status & Pipeline Stages
const updateLeadStatus = async (req, res) => {
  try {
    const { status, reason, remarks, notes, inProcessStage, draftStatus } = req.body;
    const target = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(target);
    let lead = isObjectId 
      ? (await Lead.findById(target) || await Lead.findOne({ leadId: target }))
      : await Lead.findOne({ leadId: target });

    if (lead) {
      if (status) lead.status = status;
      if (inProcessStage) lead.inProcessStage = inProcessStage;
      if (draftStatus) lead.draftStatus = draftStatus;

      // Handle specific workflow transitions requested:
      // 1. If marked as hold -> custom hold
      if (status === 'HOLD' || draftStatus === 'Custom HOLD') {
        lead.isDraft = true;
        lead.draftStatus = 'Custom HOLD';
        lead.status = 'HOLD';
      }
      // 2. If documents missing -> Doc's Pending
      else if (status === 'Documents Pending' || draftStatus === "Doc's Pending") {
        lead.isDraft = true;
        lead.draftStatus = "Doc's Pending";
        lead.status = 'Documents Pending';
      }
      // 3. In-Process stages: Lender Selection, Financial Decision, Lender Approved, Disbursal On Hold, Not Eligible
      else if (['Lender Selection', 'Financial Decision', 'Lender Approved', 'Disbursal On Hold', 'Not Eligible', 'Disbursed'].includes(inProcessStage)) {
        lead.isDraft = false;
        lead.submissionType = 'SUBMITTED';
        lead.inProcessStage = inProcessStage;
        if (inProcessStage === 'Lender Approved') {
          lead.status = 'Approved';
        } else if (inProcessStage === 'Disbursed') {
          lead.status = 'Converted';
        } else if (inProcessStage === 'Not Eligible') {
          lead.status = 'Rejected';
        } else {
          lead.status = 'Submitted';
        }
      }

      const callerName = req.admin?.name || req.admin?.email || 'Telecaller';
      const remarkText = reason || remarks || notes || '';

      if (remarkText) {
        lead.telecallerNotes = remarkText;
        lead.telecallerConfirmedBy = callerName;
        lead.telecallerConfirmedAt = new Date();

        if (!lead.followUps) lead.followUps = [];
        lead.followUps.push({
          type: 'Call',
          status: status || lead.status || 'Contacted',
          remarks: remarkText,
          notes: remarkText,
          addedBy: callerName,
          scheduledAt: new Date()
        });
      }

      // If customer is verified / interested / converted / application submitted -> move to Customer_Confirmed
      if (['Contacted', 'Interested', 'Converted', 'Application Ready', 'Application Submitted', 'Documents Received'].includes(lead.status)) {
        lead.workflowStage = 'Customer_Confirmed';
      }

      const updatedLead = await lead.save();

      // Broadcast Notification to RM, RE/RO & Team that Telecaller has completed calling
      try {
        const { notifyEmployeeOrZone } = require('../services/firebaseService');
        await notifyEmployeeOrZone({
          recipientId: lead.rmId || lead.reRoId || null,
          empId: lead.assignedToId || lead.createdById || null,
          zone: lead.zone,
          title: `✅ Lead Status Update [${lead.zone} Zone]: ${lead.name}`,
          body: `Telecaller ${callerName} updated lead ${lead.leadId || lead.name}. Status: [${status}]. Remarks: "${remarkText.slice(0, 80)}"`,
          data: {
            type: 'info',
            leadId: lead.leadId || lead._id.toString(),
            customerName: lead.name
          }
        });
      } catch (notifErr) {
        console.error('Telecaller update notification error:', notifErr);
      }

      return res.status(200).json({ success: true, message: 'Status updated successfully', lead: updatedLead });
    }

    // Fallback: Check if target is a LoanApplication
    if (isObjectId) {
      const loanApp = await LoanApplication.findById(target);
      if (loanApp) {
        loanApp.status = status || loanApp.status;
        const callerName = req.admin?.name || req.admin?.email || 'Telecaller';
        const remarkText = reason || remarks || notes || '';
        if (remarkText) {
          loanApp.telecallerNotes = remarkText;
          loanApp.telecallerConfirmedBy = callerName;
          loanApp.telecallerConfirmedAt = new Date();
        }
        if (['Contacted', 'Interested', 'Converted', 'Application Ready', 'Application Submitted', 'Documents Received'].includes(status)) {
          loanApp.workflowStage = 'Customer_Confirmed';
        }
        const updatedApp = await loanApp.save();
        return res.status(200).json({ success: true, message: 'Status updated successfully', lead: updatedApp });
      }
    }

    return res.status(404).json({ success: false, message: 'Lead not found' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Assign Lead
// @route   PUT /api/leads/:id/assign
// @access  Private
const assignLead = async (req, res) => {
  try {
    const { assignedTo, assignedToId, assignedTeam, priority, assignmentRemarks } = req.body;
    const lead = await Lead.findById(req.params.id);

    if (lead) {
      const previousAssignee = lead.assignedTo || 'Unassigned';
      lead.assignedTo = assignedTo || lead.assignedTo;
      lead.assignedToId = assignedToId || lead.assignedToId;
      lead.assignedTeam = assignedTeam || lead.assignedTeam;
      lead.priority = priority || lead.priority;
      lead.assignmentRemarks = assignmentRemarks || lead.assignmentRemarks;
      lead.assignedBy = req.admin ? `${req.admin.name || req.admin.email} (${req.admin.role})` : 'Admin';
      lead.assignedAt = new Date();

      if (!lead.assignmentHistory) lead.assignmentHistory = [];
      lead.assignmentHistory.push({
        assignedTo: lead.assignedTo,
        assignedToId: lead.assignedToId,
        assignedBy: lead.assignedBy,
        assignedAt: lead.assignedAt,
        previousAssignee
      });

      if (lead.status === 'Unassigned' || lead.status === 'New' || lead.status === 'Rejected') {
         lead.status = 'Assigned';
      }

      const updatedLead = await lead.save();

      // Trigger Push Notification to assigned Employee
      try {
        const { notifyEmployeeOrZone } = require('../services/firebaseService');
        await notifyEmployeeOrZone({
          recipientId: lead.assignedToId,
          empId: lead.assignedToId,
          zone: lead.zone,
          title: `📌 Lead Assigned: ${lead.name}`,
          body: `Lead ${lead.leadId || lead.name} has been assigned to you by ${lead.assignedBy}. Priority: ${lead.priority || 'Normal'}.`,
          data: {
            type: 'lead_assigned',
            leadId: lead.leadId || lead._id.toString(),
            customerName: lead.name
          }
        }).catch(e => console.warn('Assign push error:', e.message));
      } catch (err) {
        console.warn('Assign notification dispatch error:', err.message);
      }

      res.status(200).json(updatedLead);
    } else {
      res.status(404).json({ message: 'Lead not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Bulk Assign Leads
// @route   PUT /api/leads/bulk-assign
// @access  Private
const bulkAssignLeads = async (req, res) => {
  try {
    const { leadIds, assignedTo, assignedToId, assignedTeam, priority } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ message: 'No lead IDs provided' });
    }

    const assignedBy = req.admin ? `${req.admin.name || req.admin.email} (${req.admin.role})` : 'Admin';
    const assignedAt = new Date();

    const leads = await Lead.find({ _id: { $in: leadIds } });
    for (const lead of leads) {
      const previousAssignee = lead.assignedTo || 'Unassigned';
      lead.assignedTo = assignedTo;
      lead.assignedToId = assignedToId;
      if (assignedTeam) lead.assignedTeam = assignedTeam;
      if (priority) lead.priority = priority;
      lead.assignedBy = assignedBy;
      lead.assignedAt = assignedAt;

      if (!lead.assignmentHistory) lead.assignmentHistory = [];
      lead.assignmentHistory.push({
        assignedTo,
        assignedToId,
        assignedBy,
        assignedAt,
        previousAssignee
      });

      if (lead.status === 'Unassigned' || lead.status === 'New' || lead.status === 'Rejected') {
        lead.status = 'Assigned';
      }

      await lead.save();
    }

    res.status(200).json({ message: `${leads.length} leads assigned successfully` });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Add Follow-up
// @route   POST /api/leads/:id/followup
// @access  Private
const addFollowUp = async (req, res) => {
  try {
    const { type, scheduledAt, status, notes, addedBy } = req.body;
    const target = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(target);
    let lead = isObjectId 
      ? (await Lead.findById(target) || await Lead.findOne({ leadId: target }))
      : await Lead.findOne({ leadId: target });

    if (lead) {
      const followUp = {
        type: type || 'Call',
        scheduledAt: scheduledAt || new Date().toISOString().split('T')[0],
        status: status || 'Upcoming',
        notes: notes || '',
        addedBy: addedBy || req.admin?.name || 'Telecaller'
      };

      if (!lead.followUps) lead.followUps = [];
      lead.followUps.push(followUp);
      lead.nextFollowUp = scheduledAt || lead.nextFollowUp;
      
      const updatedLead = await lead.save();
      return res.status(201).json(updatedLead);
    }

    // Fallback: Check if target is a LoanApplication
    if (isObjectId) {
      const loanApp = await LoanApplication.findById(target);
      if (loanApp) {
        loanApp.telecallerNotes = notes || loanApp.telecallerNotes;
        loanApp.telecallerConfirmedBy = addedBy || req.admin?.name || 'Telecaller';
        loanApp.telecallerConfirmedAt = new Date();
        const updatedApp = await loanApp.save();
        return res.status(201).json(updatedApp);
      }
    }

    return res.status(404).json({ message: 'Lead not found' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update Follow-up Status
// @route   PUT /api/leads/:id/followup/:followupId/status
// @access  Private
const updateFollowUpStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const lead = await Lead.findById(req.params.id);

    if (lead) {
      const followUp = lead.followUps.id(req.params.followupId);
      if (followUp) {
        followUp.status = status;
        const updatedLead = await lead.save();
        res.status(200).json(updatedLead);
      } else {
        res.status(404).json({ message: 'Follow-up not found' });
      }
    } else {
      res.status(404).json({ message: 'Lead not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update Multi-Tier Approval Stage for Lead
// @route   PUT /api/leads/:id/approval-stage
// @access  Private
const updateLeadApprovalStage = async (req, res) => {
  try {
    const { stage, remarks } = req.body;
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const validStages = [
      'LEAD_SUBMITTED',
      'TL_VERIFIED',
      'CREDIT_APPROVED',
      'SANCTIONED',
      'DISBURSED',
      'REJECTED'
    ];

    if (!validStages.includes(stage)) {
      return res.status(400).json({ success: false, message: 'Invalid approval stage' });
    }

    lead.approvalStage = stage;
    lead.approvalRemarks = remarks || '';

    if (!lead.approvalHistory) lead.approvalHistory = [];
    lead.approvalHistory.push({
      stage,
      actionBy: req.admin ? `${req.admin.name || req.admin.email}` : 'Admin',
      actionById: req.admin ? req.admin._id : null,
      role: req.admin ? req.admin.role : 'Admin',
      remarks: remarks || '',
      timestamp: new Date()
    });

    // If Sanctioned or Disbursed, update main status
    if (stage === 'SANCTIONED') {
      lead.status = 'Qualified';
    } else if (stage === 'DISBURSED') {
      lead.status = 'Converted';
    } else if (stage === 'REJECTED') {
      lead.status = 'Rejected';
    }

    const updatedLead = await lead.save();
    res.status(200).json({
      success: true,
      message: `Lead stage progressed to ${stage}`,
      lead: updatedLead
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Telecaller confirms customer interest & details
// @route   PUT /api/leads/:id/telecaller-confirm
// @access  Private
const telecallerConfirmLead = async (req, res) => {
  try {
    const { notes } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.workflowStage = 'Customer_Confirmed';
    lead.status = 'Contacted';
    lead.telecallerConfirmedAt = new Date();
    lead.telecallerConfirmedBy = req.admin?.name || 'Telecaller';
    lead.telecallerNotes = notes || 'Customer confirmed interest in loan facility';

    await lead.save();
    res.status(200).json({ success: true, message: 'Lead verified by Telecaller. Ready for RM handover to Operations.', lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Telecaller / RM hands over completed file to Operation Admin / Manager
// @route   PUT /api/leads/:id/handover-operations
// @access  Private (Telecaller / RM / ARM / Admin)
const handoverToOperations = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.workflowStage = 'Operations_KYC_Verification';
    lead.status = 'Submitted';
    lead.submissionType = 'SUBMITTED';
    lead.telecallerForwardedToOpsAt = new Date();
    lead.operationsRejectionRemark = null; // Clear previous rejection if re-forwarding
    await lead.save();

    // Trigger FCM & In-App Notification to Customer and Operation Team
    try {
      const { notifyCustomer, notifyEmployeeOrZone } = require('../services/firebaseService');
      await notifyCustomer({
        phone: lead.mobile,
        email: lead.email,
        title: 'Documents Verified by Telecaller',
        body: `Your loan file (${lead.leadId || lead.name}) has been verified and submitted to Operations for KYC clearance.`,
        data: {
          type: 'document_verified',
          leadId: lead.leadId || lead._id.toString(),
          actionScreen: 'PendingLoanDetailsScreen'
        }
      }).catch(e => console.warn('Customer handover push error:', e.message));

      await notifyEmployeeOrZone({
        zone: lead.zone,
        title: `📂 New File for KYC Verification [${lead.zone} Zone]`,
        body: `Lead ${lead.name} (${lead.leadId || ''}) documents verified by Telecaller. Ready for KYC review.`,
        data: {
          type: 'kyc_verification',
          leadId: lead.leadId || lead._id.toString(),
          customerName: lead.name
        }
      }).catch(e => console.warn('Ops handover push error:', e.message));
    } catch (err) {
      console.warn('Handover notification dispatch error:', err.message);
    }

    res.status(200).json({ success: true, message: 'File forwarded to Operation Manager for KYC verification.', lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Operation Manager Rejects Documents & Returns File to Telecaller Queue
// @route   PUT /api/leads/:id/operations-reject-doc
// @access  Private (Operation Manager / Admin)
const operationsRejectDocToTelecaller = async (req, res) => {
  try {
    const { reason } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.workflowStage = 'RM_Telecaller_Review';
    lead.status = 'Documents Pending';
    lead.operationsRejectionRemark = reason || 'Incomplete or blurry documents. Please re-call customer and get valid documents.';
    lead.operationsRejectedAt = new Date();
    lead.operationsRejectedBy = req.admin ? req.admin.name : 'Operation Manager';

    // Add note to followUps
    if (!Array.isArray(lead.followUps)) lead.followUps = [];
    lead.followUps.unshift({
      date: new Date(),
      status: 'Documents Pending',
      notes: `[Operations Rejected]: ${lead.operationsRejectionRemark}`,
      user: req.admin ? req.admin.name : 'Operation Manager'
    });

    await lead.save();

    // Trigger Real-Time FCM Push & In-App Notification to Customer and Telecaller
    const { notifyCustomer, notifyEmployeeOrZone } = require('../services/firebaseService');
    
    // 1. Notify Customer directly
    await notifyCustomer({
      phone: lead.mobile,
      email: lead.email,
      title: 'Action Required: Document Re-upload',
      body: `Your documents require correction: ${lead.operationsRejectionRemark}. Please re-upload in the app.`,
      data: {
        type: 'document_rejected',
        leadId: lead.leadId || lead._id.toString(),
        actionScreen: 'CustomerLoanApplicationScreen',
        reason: lead.operationsRejectionRemark
      }
    }).catch(e => console.warn('Customer push error:', e.message));

    // 2. Notify Assigned Telecaller
    if (lead.telecallerId || lead.assignedToId) {
      await notifyEmployeeOrZone({
        recipientId: lead.telecallerId || lead.assignedToId,
        title: 'Lead Returned by Operations',
        body: `Lead ${lead.name} (${lead.leadId}) returned: ${lead.operationsRejectionRemark}. Please call customer.`,
        data: {
          type: 'lead_returned',
          leadId: lead.leadId || lead._id.toString(),
          customerName: lead.name
        }
      }).catch(e => console.warn('Telecaller push error:', e.message));
    }

    res.status(200).json({
      success: true,
      message: 'File returned to Telecaller queue for document re-upload & customer calling.',
      lead
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Operations requests Sales Head approval
// @route   PUT /api/leads/:id/request-sales-approval
// @access  Private (Operation Manager / Admin)
const requestSalesHeadApproval = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.workflowStage = 'Sales_Head_Approval_Pending';
    lead.operationsVerifiedAt = new Date();
    await lead.save();
    res.status(200).json({ success: true, message: 'KYC verified. File submitted to Sales Head for approval.', lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Operation Manager Dispatches File to Partner Bank(s) / NBFCs (Email/WhatsApp)
// @route   POST /api/leads/:id/bank-dispatch
// @access  Private (Operation Manager / Admin)
const dispatchToBank = async (req, res) => {
  try {
    const { bankName, channel = 'WhatsApp', bankEmail, bankContact, selectedLenders } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    let lendersToDispatch = [];
    if (Array.isArray(selectedLenders) && selectedLenders.length > 0) {
      lendersToDispatch = selectedLenders.map(l => ({
        name: l.name || l.shortName,
        shortName: l.shortName || l.name,
        code: l.code || '',
        category: l.category || 'Commercial Bank',
        channel: channel,
        branch: l.defaultBranch || `${lead.zone || 'North'} Zonal Credit Desk`,
        ifsc: l.defaultIfsc || '',
        status: 'Dispatched',
        dispatchedAt: new Date()
      }));
    } else {
      lendersToDispatch = [{
        name: bankName || 'Partner Bank',
        shortName: bankName || 'Partner Bank',
        category: 'Commercial Bank',
        channel: channel,
        status: 'Dispatched',
        dispatchedAt: new Date()
      }];
    }

    lead.workflowStage = 'Bank_Dispatched';
    lead.dispatchedLenders = lendersToDispatch;
    const totalCount = lendersToDispatch.length;
    lead.dispatchedBankName = totalCount === 1 
      ? lendersToDispatch[0].name 
      : `${lendersToDispatch[0].shortName || lendersToDispatch[0].name} +${totalCount - 1} more (${totalCount} Lenders)`;
    lead.dispatchedChannel = channel;
    lead.dispatchedAt = new Date();
    lead.dispatchedBy = req.admin?.name || 'Operation Manager';

    await lead.save();
    res.status(200).json({
      success: true,
      message: `File dispatched to ${lead.dispatchedBankName} via ${channel} successfully.`,
      lead,
      totalLendersDispatched: totalCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit Bank Sanction Offer Details for Customer
// @route   POST /api/leads/:id/bank-offer
// @access  Private
const submitBankSanctionOffer = async (req, res) => {
  try {
    const { sanctionedAmount, roi, emi, tenure, bankName } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.workflowStage = 'Bank_Sanctioned_Offer';
    lead.offerAmount = sanctionedAmount || lead.expectedAmount;
    lead.roi = roi || '10.5%';
    lead.emi = emi || '';
    lead.lenderName = bankName || lead.dispatchedBankName || 'Partner Bank';
    lead.offerStatus = 'SANCTIONED';

    await lead.save();

    // Trigger FCM & In-App Notification to Customer & Assigned Employee
    try {
      const { notifyCustomer, notifyEmployeeOrZone } = require('../services/firebaseService');
      await notifyCustomer({
        phone: lead.mobile,
        email: lead.email,
        title: '🎉 Loan Sanction Offer Received!',
        body: `Congratulations! ${lead.lenderName} has sanctioned your loan offer of ₹${lead.offerAmount}. View details and accept in app.`,
        data: {
          type: 'offer',
          leadId: lead.leadId || lead._id.toString(),
          actionScreen: 'OfferDetailsScreen'
        }
      }).catch(e => console.warn('Customer offer push error:', e.message));

      if (lead.assignedToId || lead.createdById || lead.rmId) {
        await notifyEmployeeOrZone({
          recipientId: lead.assignedToId || lead.createdById || lead.rmId,
          empId: lead.assignedToId || lead.createdById,
          zone: lead.zone,
          title: `💰 Bank Offer Sanctioned: ${lead.name}`,
          body: `Bank offer of ₹${lead.offerAmount} received from ${lead.lenderName} for ${lead.name} (${lead.leadId}).`,
          data: {
            type: 'offer',
            leadId: lead.leadId || lead._id.toString(),
            customerName: lead.name
          }
        }).catch(e => console.warn('Emp offer push error:', e.message));
      }
    } catch (err) {
      console.warn('Offer notification dispatch error:', err.message);
    }

    res.status(200).json({ success: true, message: 'Bank sanction offer submitted and published to customer.', lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Customer / RO triggers HOLD on loan offer (triggers Red Alert)
// @route   POST /api/leads/:id/customer-hold
// @access  Public / Private
const customerHoldLead = async (req, res) => {
  try {
    const { reason } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.workflowStage = 'Customer_HOLD';
    lead.isHoldAlertActive = true;
    lead.holdReason = reason || 'Customer requested time to review / comparing interest rates';
    lead.holdAt = new Date();
    lead.isDraft = true;
    lead.draftStatus = 'Custom HOLD';
    lead.status = 'HOLD';

    await lead.save();
    res.status(200).json({
      success: true,
      message: 'Loan placed on HOLD. Red Alert triggered to Regional RRM, ARM, RM, and Field RO.',
      lead
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Customer accepts loan offer (Proceeds to Agreement & NACH)
// @route   POST /api/leads/:id/customer-accept
// @access  Public / Private
const customerAcceptLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.workflowStage = 'Customer_Accepted';
    lead.isHoldAlertActive = false;
    lead.status = 'Approved';
    lead.holdResolvedAt = new Date();

    await lead.save();

    // Notify Field RO, RM & Operations
    try {
      const { notifyEmployeeOrZone, notifyCustomer } = require('../services/firebaseService');
      await notifyCustomer({
        phone: lead.mobile,
        email: lead.email,
        title: 'Offer Accepted Successfully!',
        body: `You have accepted the sanction offer for ${lead.lenderName || 'Loan'}. Agreement and e-NACH setup is in progress.`,
        data: {
          type: 'approval',
          leadId: lead.leadId || lead._id.toString(),
          actionScreen: 'NachKycScreen'
        }
      }).catch(e => console.warn('Customer accept push error:', e.message));

      await notifyEmployeeOrZone({
        recipientId: lead.reRoId || lead.rmId || lead.assignedToId,
        empId: lead.assignedToId || lead.createdById,
        zone: lead.zone,
        title: `🤝 Customer Accepted Offer: ${lead.name}`,
        body: `Customer ${lead.name} accepted the loan sanction offer. Proceed with NACH and agreement execution.`,
        data: {
          type: 'approval',
          leadId: lead.leadId || lead._id.toString(),
          customerName: lead.name
        }
      }).catch(e => console.warn('Emp accept push error:', e.message));
    } catch (err) {
      console.warn('Accept notification dispatch error:', err.message);
    }

    res.status(200).json({ success: true, message: 'Offer accepted! Agreement signing and e-NACH initiated.', lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Disburse Loan and handover to Collection Team
// @route   POST /api/leads/:id/disburse
// @access  Private (Admin / Accounts)
const disburseLoanAndHandoverCollection = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.workflowStage = 'Disbursed';
    lead.status = 'Converted';
    lead.inProcessStage = 'Disbursed';

    await lead.save();

    // Notify Customer and Team of Successful Disbursal
    try {
      const { notifyCustomer, notifyEmployeeOrZone } = require('../services/firebaseService');
      await notifyCustomer({
        phone: lead.mobile,
        email: lead.email,
        title: '💸 Loan Disbursed Successfully!',
        body: `Congratulations! Your loan amount has been disbursed to your registered bank account. Thank you for choosing NUOG.`,
        data: {
          type: 'success',
          leadId: lead.leadId || lead._id.toString(),
          actionScreen: 'UpcomingEmiScreen'
        }
      }).catch(e => console.warn('Customer disburse push error:', e.message));

      await notifyEmployeeOrZone({
        recipientId: lead.reRoId || lead.rmId || lead.assignedToId,
        empId: lead.assignedToId || lead.createdById,
        zone: lead.zone,
        title: `🎊 Loan Disbursed: ${lead.name}`,
        body: `Lead ${lead.name} (${lead.leadId}) successfully disbursed and closed. Commission & milestone recorded.`,
        data: {
          type: 'success',
          leadId: lead.leadId || lead._id.toString(),
          customerName: lead.name
        }
      }).catch(e => console.warn('Emp disburse push error:', e.message));
    } catch (err) {
      console.warn('Disburse notification dispatch error:', err.message);
    }

    res.status(200).json({ success: true, message: 'Loan successfully disbursed. Handed over to Collections team.', lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload customer document to Lead (supports Front & Back sides)
// @route   POST /api/leads/:id/documents
// @access  Private (Telecaller / Employee / Operations)
const uploadLeadDocument = async (req, res) => {
  try {
    const { type, fileUrl, fileName, fileUrlBack, fileNameBack, hasBothSides, remark } = req.body;
    if (!type) {
      return res.status(400).json({ success: false, message: 'Document type is required' });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const newDoc = {
      type,
      fileUrl: fileUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=400',
      fileName: fileName || `${type} (Front).pdf`,
      fileUrlBack: fileUrlBack || '',
      fileNameBack: fileNameBack || (hasBothSides ? `${type} (Back).pdf` : ''),
      hasBothSides: Boolean(hasBothSides || fileUrlBack),
      remark: remark || '',
      status: 'Under Verification',
      uploadedBy: req.admin?.name || req.admin?.role || 'Telecaller',
      uploadedAt: new Date()
    };

    lead.documents.unshift(newDoc);

    // If documents are now uploaded, transition lead out of Doc's Pending
    // Moves to 'SUBMITTED' / In-Process so it shows in Submitted History & In-Process stages
    lead.isDraft = false;
    lead.submissionType = 'SUBMITTED';
    lead.status = 'Submitted';
    if (!lead.inProcessStage || lead.inProcessStage === 'Doc\'s Pending' || lead.inProcessStage === 'Logins') {
      lead.inProcessStage = 'Logins'; // Initial active submitted stage
    }

    await lead.save();
    res.status(200).json({ success: true, message: 'Document uploaded successfully with Front & Back verification. Lead advanced to Submitted (In-Process)', document: newDoc, lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all documents across leads for Telecaller / Operations desk
// @route   GET /api/leads/desk/documents
// @access  Private
const getAllDeskDocuments = async (req, res) => {
  try {
    const leadsWithDocs = await Lead.find({ 'documents.0': { $exists: true } })
      .select('name mobile leadId zone documents')
      .sort({ updatedAt: -1 })
      .lean();

    const flattened = [];
    leadsWithDocs.forEach(l => {
      (l.documents || []).forEach(d => {
        flattened.push({
          _id: d._id,
          leadId: l.leadId || l._id,
          rawLeadId: l._id,
          customer: l.name,
          mobile: l.mobile,
          zone: l.zone || 'NORTH',
          type: d.type,
          fileUrl: d.fileUrl,
          fileName: d.fileName,
          fileUrlBack: d.fileUrlBack,
          fileNameBack: d.fileNameBack,
          hasBothSides: d.hasBothSides,
          status: d.status,
          remark: d.remark,
          uploaded: d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString('en-IN') : 'Recent',
          uploadedBy: d.uploadedBy
        });
      });
    });

    res.status(200).json({ success: true, count: flattened.length, documents: flattened });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createLead,
  getLeads,
  getLeadById,
  getPublicLeadByLeadId,
  updateLeadStatus,
  updateLeadApprovalStage,
  assignLead,
  bulkAssignLeads,
  addFollowUp,
  updateFollowUpStatus,
  telecallerConfirmLead,
  handoverToOperations,
  operationsRejectDocToTelecaller,
  requestSalesHeadApproval,
  dispatchToBank,
  submitBankSanctionOffer,
  customerHoldLead,
  customerAcceptLead,
  disburseLoanAndHandoverCollection,
  uploadLeadDocument,
  getAllDeskDocuments
};

