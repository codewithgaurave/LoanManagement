const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/loanController');

const { protectAdmin, checkPermission } = require('../middlewares/authMiddleware');

// Offers Management Routes
router.route('/offers/all')
  .get(protectAdmin, getOffersList);

router.route('/offers/save')
  .post(protectAdmin, saveOfferDetails);

router.route('/offers/:id')
  .delete(protectAdmin, deleteOfferDetails);

router.route('/')
  .get(protectAdmin, checkPermission('View Loan Applications'), getApplications)
  .post(protectAdmin, checkPermission('View Loan Applications'), createApplication);

router.route('/bulk-assign')
  .put(protectAdmin, checkPermission('View Loan Applications'), bulkAssignApplications);

router.route('/:id')
  .get(protectAdmin, checkPermission('View Loan Applications'), getApplicationById);

router.route('/:id/status')
  .put(protectAdmin, checkPermission('Approve/Reject/Hold Loan'), updateApplicationStatus);

router.route('/:id/documents/:docId/status')
  .put(protectAdmin, checkPermission('Verify Documents'), updateDocumentStatus);

router.route('/:id/remind')
  .post(protectAdmin, checkPermission('Send Reminders/SMS'), sendReminder);

router.route('/:id/assign')
  .put(protectAdmin, checkPermission('View Loan Applications'), assignApplication);

module.exports = router;
