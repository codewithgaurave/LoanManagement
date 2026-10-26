const express = require('express');
const router = express.Router();
const {
  getSalesDashboardMetrics,
  getZonalSalesTree,
  sendHiringRequestToHR,
  getHiringRequisitions,
  getHoldEscalations,
  logHoldFollowUp,
  getPendingSalesHeadApprovals,
  approveFileBySalesHead,
  rejectFileBySalesHead,
  getChartAnalytics,
  getPartnerBanks,
  approveAndDispatchToBank,
  getBankSubmissions,
  recordBankDecision,
  customerOfferDecision,
  assignFileToOperations,
  submitKYCToSalesHead,
  getRMWorkflowMetrics,
  getRMLeadsForReview,
  rmReviewLeadAction
} = require('../controllers/salesController');
const { protectAdmin } = require('../middlewares/authMiddleware');

// ── Sales Head / RRM / Common Routes ──────────────────────
router.get('/dashboard-metrics', protectAdmin, getSalesDashboardMetrics);
router.get('/chart-analytics', protectAdmin, getChartAnalytics);
router.get('/zonal-tree', protectAdmin, getZonalSalesTree);
router.get('/partner-banks', protectAdmin, getPartnerBanks);
router.post('/hiring-request', protectAdmin, sendHiringRequestToHR);
router.post('/hiring-requisitions', protectAdmin, sendHiringRequestToHR);
router.get('/hiring-requests', protectAdmin, getHiringRequisitions);
router.get('/hiring-requisitions', protectAdmin, getHiringRequisitions);
router.get('/hold-escalations', protectAdmin, getHoldEscalations);
router.post('/hold-followup', protectAdmin, logHoldFollowUp);
router.get('/pending-approvals', protectAdmin, getPendingSalesHeadApprovals);

// ── RM (Reporting Manager) Workflow Routes ─────────────────
router.get('/rm-metrics', protectAdmin, getRMWorkflowMetrics);
router.get('/rm-leads', protectAdmin, getRMLeadsForReview);

// ── Lead-specific action routes (must come after named routes) ──
router.put('/:id/rm-review', protectAdmin, rmReviewLeadAction);
router.put('/:id/assign-operations', protectAdmin, assignFileToOperations);
router.put('/:id/submit-sales-approval', protectAdmin, submitKYCToSalesHead);
router.put('/:id/approve-file', protectAdmin, approveFileBySalesHead);
router.put('/:id/reject-file', protectAdmin, rejectFileBySalesHead);
router.put('/:id/dispatch-bank', protectAdmin, approveAndDispatchToBank);
router.get('/bank-submissions', protectAdmin, getBankSubmissions);
router.put('/:id/bank-decision', protectAdmin, recordBankDecision);
router.put('/:id/customer-decision', customerOfferDecision);

module.exports = router;
