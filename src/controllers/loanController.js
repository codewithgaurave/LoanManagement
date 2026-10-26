const LoanApplication = require('../models/LoanApplication');
const Notification = require('../models/Notification'); // Assuming a Notification model exists

// @desc    Get all Loan Applications
// @route   GET /api/loans
// @access  Private
// @desc    Get all Loan Applications
// @route   GET /api/loans
// @access  Private
const getApplications = async (req, res) => {
  try {
    const { status, source, unassigned, assignedToId } = req.query;
    let query = {};

    const roleLower = (req.admin?.role || '').toLowerCase();
    const isMasterAdmin = ['super admin', 'superadmin', 'admin'].includes(roleLower);

    if (isMasterAdmin) {
      if (unassigned === 'true') {
        query.assignedToId = null;
      } else if (assignedToId) {
        query.assignedToId = assignedToId;
      }
    } else {
      // Non-admin (credit manager, ops employee) only sees assigned loans
      const adminIdStr = req.admin ? req.admin._id.toString() : '';
      query.assignedToId = adminIdStr;
    }

    if (status && status !== 'all') query.status = status;
    if (source && source !== 'all') query.source = source;

    const applications = await LoanApplication.find(query).sort({ createdAt: -1 });
    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single Loan Application
// @route   GET /api/loans/:id
// @access  Private
const getApplicationById = async (req, res) => {
  try {
    const application = await LoanApplication.findById(req.params.id);
    if (application) {
      res.status(200).json(application);
    } else {
      res.status(404).json({ message: 'Application not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const Employee = require('../models/Employee');
const { getAutoAssignedRMAndTelecaller } = require('../utils/leadAssignmentHelper');

// @desc    Create a new Loan Application
// @route   POST /api/loans
// @access  Private / Public
const createApplication = async (req, res) => {
  try {
    const emp = req.admin ? await Employee.findById(req.admin._id) : null;
    const targetZone = (req.body.zone || emp?.zone || 'NORTH').toUpperCase();

    // Auto-assign Zone RM & Alternate Telecaller (Round-Robin Pan-India)
    const { rm: autoRM, telecaller: autoTelecaller } = await getAutoAssignedRMAndTelecaller(targetZone);

    const isEmployeeGenerated = Boolean(req.admin || req.body.createdById);
    const creatorName = emp ? emp.name : (req.admin ? `${req.admin.firstName || req.admin.name || ''}`.trim() : 'Customer Direct');
    const creatorDesignation = emp ? (emp.designation || emp.zonalRole || emp.role) : (req.admin ? req.admin.role : 'Customer Self');
    const creatorRole = emp ? (emp.zonalRole || emp.role) : (req.admin ? req.admin.role : 'Customer');
    const creatorEmpId = emp ? emp.empId : null;

    const applicationData = {
      ...req.body,
      zone: targetZone,
      generatorType: isEmployeeGenerated ? 'Employee' : 'Customer',
      source: req.body.source || (isEmployeeGenerated ? 'Employee App' : 'Customer App'),
      createdById: req.body.createdById || (req.admin ? req.admin._id.toString() : null),
      createdByEmpId: req.body.createdByEmpId || creatorEmpId,
      createdByRole: req.body.createdByRole || creatorRole,
      createdByDesignation: req.body.createdByDesignation || creatorDesignation,
      createdByName: req.body.createdByName || creatorName,

      // Auto-assign Zone RM
      rmId: req.body.rmId || autoRM?._id || emp?.rmId || null,
      rmName: req.body.rmName || autoRM?.name || emp?.rmName || null,

      // Auto-assign Pan-India Telecaller (Alternate)
      telecallerId: req.body.telecallerId || autoTelecaller?._id || null,
      telecallerName: req.body.telecallerName || autoTelecaller?.name || null,
      assignedTo: req.body.assignedTo || autoTelecaller?.name || null,
      assignedToId: req.body.assignedToId || (autoTelecaller ? autoTelecaller._id.toString() : null),
      assignedAt: new Date(),
      assignedBy: 'System Auto-Assign'
    };

    const application = new LoanApplication(applicationData);
    const createdApplication = await application.save();

    if (autoTelecaller) {
      const { notifyEmployeeOrZone, notifyCustomer } = require('../services/firebaseService');
      await notifyEmployeeOrZone({
        recipientId: autoTelecaller._id,
        empId: autoTelecaller.empId || null,
        zone: targetZone,
        title: `📞 Loan App Assigned [${targetZone} Zone]: ${createdApplication.customer}`,
        body: `Application ${createdApplication.applicationId} (${targetZone} Zone, ₹${createdApplication.amount || 0}) assigned to you.`,
        data: {
          type: 'application',
          leadId: createdApplication.applicationId,
          customerName: createdApplication.customer
        }
      }).catch(e => console.warn('Notification error:', e.message));

      await notifyCustomer({
        phone: createdApplication.mobile,
        email: createdApplication.email,
        title: `Loan Application Submitted`,
        body: `Your application ${createdApplication.applicationId} for ₹${createdApplication.amount} has been successfully submitted and is under credit review.`,
        data: {
          type: 'application',
          leadId: createdApplication.applicationId,
          actionScreen: 'PendingLoanDetailsScreen'
        }
      }).catch(e => console.warn('Customer notification error:', e.message));
    }

    res.status(201).json(createdApplication);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update Application Status
// @route   PUT /api/loans/:id/status
// @access  Private
const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const application = await LoanApplication.findById(req.params.id);

    if (application) {
      application.status = status;
      const updatedApplication = await application.save();

      // Trigger targeted notifications to customer and assigned employee
      try {
        const { notifyEmployeeOrZone, notifyCustomer } = require('../services/firebaseService');
        await notifyCustomer({
          phone: application.mobile,
          email: application.email,
          title: `Application Status: [${status}]`,
          body: `Your loan application ${application.applicationId} status has changed to ${status}.`,
          data: {
            type: status === 'Approved' ? 'offer' : (status === 'Rejected' ? 'rejection' : 'application'),
            leadId: application.applicationId
          }
        });

        await notifyEmployeeOrZone({
          empId: application.assignedToId,
          zone: application.zone,
          title: `Application [${status}]: ${application.customer}`,
          body: `Loan Application ${application.applicationId} (${application.zone} Zone) status updated to ${status}.`,
          data: {
            type: 'application',
            leadId: application.applicationId,
            customerName: application.customer
          }
        });
      } catch (err) {
        console.error('App status update notification error:', err.message);
      }

      res.status(200).json(updatedApplication);
    } else {
      res.status(404).json({ message: 'Application not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update Document Status
// @route   PUT /api/loans/:id/documents/:docId/status
// @access  Private
const updateDocumentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const application = await LoanApplication.findById(req.params.id);

    if (application) {
      const document = application.documents.id(req.params.docId);
      if (document) {
        document.status = status;
        await application.save();
        res.status(200).json(document);
      } else {
        res.status(404).json({ message: 'Document not found' });
      }
    } else {
      res.status(404).json({ message: 'Application not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Send Reminder
// @route   POST /api/loans/:id/remind
// @access  Private
const sendReminder = async (req, res) => {
  try {
    const { message, type } = req.body;
    const application = await LoanApplication.findById(req.params.id);

    if (application) {
      // In a real scenario, this would send an SMS/Email.
      // Here we just log it or create an in-app notification if the model exists.
      // For now, we simulate a successful reminder sent.
      res.status(200).json({ message: 'Reminder sent successfully' });
    } else {
      res.status(404).json({ message: 'Application not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Assign Application to Employee
// @route   PUT /api/loans/:id/assign
// @access  Private
const assignApplication = async (req, res) => {
  try {
    const { assignedTo, assignedToId } = req.body;
    const application = await LoanApplication.findById(req.params.id);

    if (application) {
      const previousAssignee = application.assignedTo || 'Unassigned';
      application.assignedTo = assignedTo;
      application.assignedToId = assignedToId || null;
      application.assignedBy = req.admin ? `${req.admin.name || req.admin.email} (${req.admin.role})` : 'Admin';
      application.assignedAt = new Date();
      application.status = 'Assigned';

      if (!application.assignmentHistory) application.assignmentHistory = [];
      application.assignmentHistory.push({
        assignedTo,
        assignedToId,
        assignedBy: application.assignedBy,
        assignedAt: application.assignedAt,
        previousAssignee
      });
      
      const updatedApplication = await application.save();
      res.status(200).json(updatedApplication);
    } else {
      res.status(404).json({ message: 'Application not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Bulk Assign Loan Applications
// @route   PUT /api/loans/bulk-assign
// @access  Private
const bulkAssignApplications = async (req, res) => {
  try {
    const { applicationIds, assignedTo, assignedToId } = req.body;
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ message: 'No applications provided' });
    }

    const assignedBy = req.admin ? `${req.admin.name || req.admin.email} (${req.admin.role})` : 'Admin';
    const assignedAt = new Date();

    const apps = await LoanApplication.find({ _id: { $in: applicationIds } });
    for (const app of apps) {
      const previousAssignee = app.assignedTo || 'Unassigned';
      app.assignedTo = assignedTo;
      app.assignedToId = assignedToId;
      app.assignedBy = assignedBy;
      app.assignedAt = assignedAt;
      app.status = 'Assigned';

      if (!app.assignmentHistory) app.assignmentHistory = [];
      app.assignmentHistory.push({
        assignedTo,
        assignedToId,
        assignedBy,
        assignedAt,
        previousAssignee
      });

      await app.save();
    }

    res.status(200).json({ message: `${apps.length} applications assigned successfully` });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all Offers for Admin / Super Admin Panel
// @route   GET /api/loans/offers/all
// @access  Private
const getOffersList = async (req, res) => {
  try {
    const { status, search } = req.query;
    const loans = await LoanApplication.find({}).sort({ updatedAt: -1, createdAt: -1 });
    
    const offers = loans.map(loan => {
      const amountNum = parseFloat(String(loan.amount).replace(/[^0-9.]/g, '')) || 500000;
      const tenureMonths = parseInt(String(loan.tenure).replace(/[^0-9]/g, '')) || 24;
      const interestRateVal = parseFloat(String(loan.interestRate || '10.5').replace(/[^0-9.]/g, '')) || 10.5;
      
      let emi = loan.emiAmount;
      if (!emi || emi === 0) {
        const monthlyRate = (interestRateVal / 12) / 100;
        emi = Math.round((amountNum * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1));
      }
      
      const totalAmountVal = Math.round(emi * tenureMonths);
      const interestAmountVal = Math.max(0, Math.round(totalAmountVal - amountNum));
      const processingFeeVal = loan.details?.processingFee ? (parseFloat(String(loan.details.processingFee).replace(/[^0-9.]/g, '')) || Math.round(amountNum * 0.02)) : Math.round(amountNum * 0.02);
      const insuranceAmountVal = loan.details?.insuranceAmount ? (parseFloat(String(loan.details.insuranceAmount).replace(/[^0-9.]/g, '')) || Math.round(amountNum * 0.01)) : Math.round(amountNum * 0.01);
      const disbursedAmountVal = loan.details?.disbursedAmount ? (parseFloat(String(loan.details.disbursedAmount).replace(/[^0-9.]/g, '')) || Math.round(amountNum - processingFeeVal - insuranceAmountVal)) : Math.round(amountNum - processingFeeVal - insuranceAmountVal);
      
      const offerStatus = loan.details?.offerStatus || (loan.status === 'Approved' || loan.status === 'Active' ? 'ACCEPTED' : 'WAITING');

      return {
        _id: loan._id,
        applicationId: loan.applicationId || `APP-${loan._id.toString().substring(18)}`,
        customer: loan.customer || 'Customer',
        userId: loan.userId || '',
        mobile: loan.mobile || '',
        email: loan.email || '',
        loanType: loan.loanType || 'Business Loan',
        lender: loan.details?.lender || loan.details?.lenderName || 'NUOG Housing Payments Ltd.',
        entityName: loan.details?.entityName || 'ABC Enterprises Ltd.',
        customName: loan.details?.customName || loan.customer || 'Customer Name',
        accountNumber: loan.details?.accountNumber || 'XXXXX1234',
        ifscCode: loan.details?.ifsc || loan.details?.ifscCode || 'ABCD0123456',
        approvedAmount: loan.details?.approvedAmount || `₹ ${amountNum.toLocaleString('en-IN')}`,
        disbursedAmount: loan.details?.disbursedAmount || `₹ ${disbursedAmountVal.toLocaleString('en-IN')}`,
        monthlyEmi: loan.details?.monthlyEmi || `₹ ${emi.toLocaleString('en-IN')}`,
        rateOfInterest: loan.details?.rateOfInterest || `${interestRateVal}% p.a.`,
        loanDuration: loan.details?.loanDuration || `${tenureMonths} Months`,
        processingFee: loan.details?.processingFee || `₹ ${processingFeeVal.toLocaleString('en-IN')}`,
        insuranceAmount: loan.details?.insuranceAmount || `₹ ${insuranceAmountVal.toLocaleString('en-IN')}`,
        totalAmount: loan.details?.totalAmount || `₹ ${totalAmountVal.toLocaleString('en-IN')}`,
        principleAmount: loan.details?.principleAmount || `₹ ${amountNum.toLocaleString('en-IN')}`,
        interestAmount: loan.details?.interestAmount || `₹ ${interestAmountVal.toLocaleString('en-IN')}`,
        offerStatus,
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt,
      };
    });

    let filtered = offers;
    if (status && status !== 'ALL') {
      filtered = filtered.filter(o => o.offerStatus.toUpperCase() === status.toUpperCase());
    }
    if (search && search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(o =>
        o.customer.toLowerCase().includes(q) ||
        o.applicationId.toLowerCase().includes(q) ||
        o.entityName.toLowerCase().includes(q) ||
        o.lender.toLowerCase().includes(q) ||
        o.mobile.includes(q)
      );
    }

    res.status(200).json({
      success: true,
      count: filtered.length,
      offers: filtered
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create or Update Loan Offer (by Admin / Super Admin)
// @route   POST /api/loans/offers/save
// @access  Private
const saveOfferDetails = async (req, res) => {
  try {
    const {
      loanId,
      applicationId,
      customer,
      userId,
      mobile,
      email,
      loanType = 'Business Loan',
      lender,
      entityName,
      customName,
      accountNumber,
      ifscCode,
      approvedAmount,
      disbursedAmount,
      monthlyEmi,
      rateOfInterest,
      loanDuration,
      processingFee,
      insuranceAmount,
      totalAmount,
      principleAmount,
      interestAmount,
      offerStatus = 'WAITING'
    } = req.body;

    let loan = null;
    if (loanId) {
      loan = await LoanApplication.findById(loanId);
    } else if (applicationId) {
      loan = await LoanApplication.findOne({ applicationId });
    }

    const cleanAmount = String(approvedAmount || principleAmount || '500000').replace(/[^0-9.]/g, '');
    const cleanTenure = String(loanDuration || '24 Months');

    if (!loan) {
      loan = new LoanApplication({
        customer: customer || customName || 'Customer',
        userId: userId || 'USR-00004',
        mobile: mobile || '9876543210',
        email: email || 'customer@example.com',
        loanType,
        amount: cleanAmount,
        tenure: cleanTenure,
        status: offerStatus === 'ACCEPTED' ? 'Approved' : 'Under Review',
        trackingStatus: offerStatus === 'ACCEPTED' ? 4 : 3,
        source: 'Admin Portal',
        details: {}
      });
    }

    loan.amount = cleanAmount;
    loan.tenure = cleanTenure;
    if (customer) loan.customer = customer;
    if (mobile) loan.mobile = mobile;
    if (email) loan.email = email;
    if (loanType) loan.loanType = loanType;

    loan.details = loan.details || {};
    loan.details.lender = lender || 'NUOG Housing Payments Ltd.';
    loan.details.lenderName = lender || 'NUOG Housing Payments Ltd.';
    loan.details.entityName = entityName || 'ABC Enterprises Ltd.';
    loan.details.customName = customName || customer || 'Customer Name';
    loan.details.accountNumber = accountNumber || 'XXXXX1234';
    loan.details.ifsc = ifscCode || 'ABCD0123456';
    loan.details.ifscCode = ifscCode || 'ABCD0123456';
    loan.details.approvedAmount = approvedAmount ? (String(approvedAmount).startsWith('₹') ? approvedAmount : `₹ ${approvedAmount}`) : `₹ ${cleanAmount}`;
    loan.details.disbursedAmount = disbursedAmount ? (String(disbursedAmount).startsWith('₹') ? disbursedAmount : `₹ ${disbursedAmount}`) : `₹ ${cleanAmount}`;
    loan.details.monthlyEmi = monthlyEmi ? (String(monthlyEmi).startsWith('₹') ? monthlyEmi : `₹ ${monthlyEmi}`) : '₹ 15,500';
    loan.details.rateOfInterest = rateOfInterest ? (String(rateOfInterest).includes('%') ? rateOfInterest : `${rateOfInterest}% p.a.`) : '10.5% p.a.';
    loan.details.loanDuration = cleanTenure;
    loan.details.processingFee = processingFee ? (String(processingFee).startsWith('₹') ? processingFee : `₹ ${processingFee}`) : '₹ 10,000';
    loan.details.insuranceAmount = insuranceAmount ? (String(insuranceAmount).startsWith('₹') ? insuranceAmount : `₹ ${insuranceAmount}`) : '₹ 5,000';
    loan.details.totalAmount = totalAmount ? (String(totalAmount).startsWith('₹') ? totalAmount : `₹ ${totalAmount}`) : '₹ 5,58,000';
    loan.details.principleAmount = principleAmount ? (String(principleAmount).startsWith('₹') ? principleAmount : `₹ ${principleAmount}`) : `₹ ${cleanAmount}`;
    loan.details.interestAmount = interestAmount ? (String(interestAmount).startsWith('₹') ? interestAmount : `₹ ${interestAmount}`) : '₹ 58,000';
    loan.details.offerStatus = offerStatus;

    if (offerStatus === 'ACCEPTED') {
      loan.status = 'Approved';
      loan.trackingStatus = Math.max(loan.trackingStatus || 1, 4);
    }

    loan.markModified('details');
    const saved = await loan.save();

    res.status(200).json({
      success: true,
      message: 'Offer saved successfully',
      offer: saved
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete or Reset Offer
// @route   DELETE /api/loans/offers/:id
// @access  Private
const deleteOfferDetails = async (req, res) => {
  try {
    const loan = await LoanApplication.findById(req.params.id);
    if (!loan) return res.status(404).json({ success: false, message: 'Offer/Application not found' });
    
    if (loan.details) {
      delete loan.details.offerStatus;
      delete loan.details.approvedAmount;
      delete loan.details.disbursedAmount;
      delete loan.details.monthlyEmi;
      delete loan.details.processingFee;
      delete loan.details.insuranceAmount;
      loan.markModified('details');
      await loan.save();
    }
    
    res.status(200).json({ success: true, message: 'Offer removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getApplications,
  getApplicationById,
  createApplication,
  updateApplicationStatus,
  updateDocumentStatus,
  sendReminder,
  assignApplication,
  bulkAssignApplications,
  getOffersList,
  saveOfferDetails,
  deleteOfferDetails
};
