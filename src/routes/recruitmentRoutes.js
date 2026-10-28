const express = require('express');
const router = express.Router();
const upload = require('../middlewares/uploadMiddleware');
const { protectAdmin, checkPermission } = require('../middlewares/authMiddleware');
const {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  applyForJob,
  getApplications,
  getRecruitmentAssignableStaff,
  assignApplication,
  bulkAssignApplications,
  updateApplicationStatus,
  updateApplication,
  getJobFilterOptions
} = require('../controllers/recruitmentController');

// Public Routes
router.get('/jobs-filters', getJobFilterOptions);
router.get('/jobs', getJobs);
router.get('/jobs/:id', getJobById);
router.post('/jobs/:id/apply', upload.any(), applyForJob);

// Protected Admin/HR Routes
router.post('/jobs', protectAdmin, checkPermission('Add Job'), createJob);
router.put('/jobs/:id', protectAdmin, checkPermission('Edit Job'), updateJob);
router.delete('/jobs/:id', protectAdmin, checkPermission('Delete Job'), deleteJob);

router.get('/applications', protectAdmin, checkPermission('Manage Recruitment'), getApplications);
router.get('/assignable-staff', protectAdmin, checkPermission('Manage Recruitment'), getRecruitmentAssignableStaff);
router.put('/applications/bulk-assign', protectAdmin, checkPermission('Manage Recruitment'), bulkAssignApplications);
router.put('/applications/:id/assign', protectAdmin, checkPermission('Manage Recruitment'), assignApplication);
router.put('/applications/:id/status', protectAdmin, checkPermission('Manage Recruitment'), updateApplicationStatus);
router.put('/applications/:id', protectAdmin, checkPermission('Manage Recruitment'), upload.any(), updateApplication);

module.exports = router;
