const express = require('express');
const router = express.Router();
const {
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
  requestSalesHeadApproval,
  dispatchToBank,
  submitBankSanctionOffer,
  customerHoldLead,
  customerAcceptLead,
  disburseLoanAndHandoverCollection,
  uploadLeadDocument,
  getAllDeskDocuments
} = require('../controllers/leadController');
const { protectAdmin, checkPermission, protectLeadCreate } = require('../middlewares/authMiddleware');

router.post('/', protectLeadCreate, createLead);
router.get('/public/:leadId', getPublicLeadByLeadId);
router.get('/', protectAdmin, checkPermission('Lead Management'), getLeads);
router.put('/bulk-assign', protectAdmin, checkPermission('Assign Lead to Employee'), bulkAssignLeads);
router.get('/:id', protectAdmin, checkPermission('Lead Management'), getLeadById);
router.put('/:id/status', protectAdmin, checkPermission('Status Management'), updateLeadStatus);
router.put('/:id/approval-stage', protectAdmin, updateLeadApprovalStage);
router.put('/:id/assign', protectAdmin, checkPermission('Assign Lead to Employee'), assignLead);
router.post('/:id/followup', protectAdmin, checkPermission('Lead Management'), addFollowUp);
router.put('/:id/followup/:followupId/status', protectAdmin, checkPermission('Status Management'), updateFollowUpStatus);

// Documents Endpoints
router.get('/desk/documents', protectAdmin, getAllDeskDocuments);
router.post('/:id/documents', protectAdmin, uploadLeadDocument);

// Multi-Tier Workflow Endpoints
router.put('/:id/telecaller-confirm', protectAdmin, telecallerConfirmLead);
router.put('/:id/handover-operations', protectAdmin, handoverToOperations);
router.put('/:id/request-sales-approval', protectAdmin, requestSalesHeadApproval);
router.post('/:id/bank-dispatch', protectAdmin, dispatchToBank);
router.post('/:id/bank-offer', protectAdmin, submitBankSanctionOffer);
router.post('/:id/customer-hold', customerHoldLead);
router.post('/:id/customer-accept', customerAcceptLead);
router.post('/:id/disburse', protectAdmin, disburseLoanAndHandoverCollection);

module.exports = router;

