const express = require('express');
const router = express.Router();
const {
  getComplaints,
  getCustomerEnquiries,
  createComplaint,
  updateComplaintStatus,
  assignComplaint,
  bulkAssignComplaints,
  deleteComplaint
} = require('../controllers/complaintController');
const { protectAdmin, checkPermission } = require('../middlewares/authMiddleware');

// Customer / App endpoints
router.get('/my-enquiries', getCustomerEnquiries);
router.post('/enquiry', createComplaint);

// Admin Management endpoints
router.route('/')
  .get(protectAdmin, checkPermission('Manage Complaints'), getComplaints)
  .post(createComplaint);

router.route('/bulk-assign')
  .put(protectAdmin, checkPermission('Manage Complaints'), bulkAssignComplaints);

router.route('/:id/assign')
  .put(protectAdmin, checkPermission('Manage Complaints'), assignComplaint);

router.route('/:id/status')
  .put(protectAdmin, checkPermission('Manage Complaints'), updateComplaintStatus);

router.route('/:id')
  .delete(protectAdmin, checkPermission('Manage Complaints'), deleteComplaint);

module.exports = router;

