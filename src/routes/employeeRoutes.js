const express = require('express');
const router = express.Router();
const { 
  getEmployees, createEmployee, updateEmployeeStatus, getEmployeeById, 
  updateEmployee, deleteEmployee, getEmployeeForOnboarding, submitOnboarding,
  getReuploadLink, getRejectedDocsForReupload, reuploadRejectedDocs, 
  updateDocumentStatus, getAttendanceByDate, getAllLeaves, addAttendanceRecord, 
  addLeaveRecord, updateLeaveStatus, remindHrForDocuments, loginEmployee, 
  remindEmployeeForOnboarding, changePassword, getMyAssignedLeads,
  getMyCreatedLeads, getTelecallerDashboardStats, getPendingOnboardings,
  assignOnboardingChaser, assignEmployeeToHR, getStaffForAssignment,
  guestLoginEmployee, getTeamEmployees, getDashboardOverview,
  getMyLeadsForApp, getMyLoansForApp, getCustomOffersForApp,
  getInDraftLeadHistory, getSubmittedInProcessHistory, getInitiatedLeadStatusHistory,
  getPerformanceAndRequestSummary, createEmployeeRequest, getCaseTrackingData,
  getEmployeeNotifications, markEmployeeNotificationAsRead, markAllEmployeeNotificationsAsRead,
  getEmployeeProfile, updateEmployeeProfile, uploadEmployeeAvatar, uploadEmployeeAvatarById, getMyLeavesForApp,
  getLeaderboardAndProgress, getHelpSupportData,
  submitUnblockQuery, checkUnblockStatus, getPendingUnblockQueries, processUnblockQuery,
  submitEmployeeFeedback,
  updateEmployeeShiftStatus, getEmployeeDocumentsForApp, getMyAttendanceForApp
} = require('../controllers/employeeController');
const { protectAdmin, checkPermission } = require('../middlewares/authMiddleware');
const { updateCustomerFcmToken } = require('../controllers/userController');
const upload = require('../middlewares/uploadMiddleware');

// Public Routes
router.post('/login', loginEmployee);
router.post('/fcm-token', updateCustomerFcmToken);
router.post('/guest-login', guestLoginEmployee);
router.post('/request-unblock', submitUnblockQuery);
router.get('/check-unblock-status', checkUnblockStatus);
router.get('/unblock-queries', protectAdmin, getPendingUnblockQueries);
router.put('/:id/process-unblock', protectAdmin, processUnblockQuery);
router.get('/team', getTeamEmployees);
router.get('/dashboard-overview', getDashboardOverview);
router.get('/leads', getMyLeadsForApp);
router.get('/loans', getMyLoansForApp);
router.get('/custom-offers', getCustomOffersForApp);
router.get('/in-draft-history', getInDraftLeadHistory);
router.get('/submitted-history', getSubmittedInProcessHistory);
router.get('/initiated-history', getInitiatedLeadStatusHistory);
router.get('/performance-summary', getPerformanceAndRequestSummary);
router.post('/requests', createEmployeeRequest);
router.post('/apply-leave', addLeaveRecord);
router.get('/my-leaves', getMyLeavesForApp);
router.get('/case-tracking', getCaseTrackingData);
router.get('/leaderboard-progress', getLeaderboardAndProgress);
router.get('/help-support', getHelpSupportData);
router.get('/notifications', getEmployeeNotifications);
router.put('/notifications/:id/read', markEmployeeNotificationAsRead);
router.put('/notifications/mark-all-read', markAllEmployeeNotificationsAsRead);
router.post('/feedback', submitEmployeeFeedback);
router.put('/shift-status', updateEmployeeShiftStatus);
router.get('/documents', getEmployeeDocumentsForApp);
router.get('/my-attendance', getMyAttendanceForApp);

// Profile Routes
// Note: We'll reuse protectAdmin middleware since it already authenticates Employee tokens too!
router.put('/profile/password', protectAdmin, changePassword);
router.get('/profile', protectAdmin, getEmployeeProfile);
router.put('/profile', protectAdmin, updateEmployeeProfile);
router.get('/me/profile', protectAdmin, getEmployeeProfile);
router.put('/me/profile', protectAdmin, updateEmployeeProfile);
router.post('/me/profile/avatar', protectAdmin, upload.single('avatar'), uploadEmployeeAvatar);

// Telecaller/Employee Routes
router.get('/my-leads', protectAdmin, getMyAssignedLeads);
router.get('/my-created-leads', protectAdmin, getMyCreatedLeads);
router.get('/telecaller-dashboard-stats', protectAdmin, getTelecallerDashboardStats);

// Staff Assignment & Onboarding Tracking Routes
router.get('/assignable-staff', protectAdmin, getStaffForAssignment);
router.get('/pending-onboarding', protectAdmin, getPendingOnboardings);
router.put('/:id/assign-onboarding-chaser', protectAdmin, assignOnboardingChaser);
router.put('/:id/assign-hr', protectAdmin, assignEmployeeToHR);

// Public Onboarding Routes
router.get('/onboarding/:id/rejected', getRejectedDocsForReupload);
router.post('/onboarding/:id/reupload', upload.any(), reuploadRejectedDocs);
router.get('/onboarding/:id', getEmployeeForOnboarding);
router.post('/onboarding/:id', upload.any(), submitOnboarding);

// Attendance & Leaves (Accessible by authenticated staff & employees)
router.get('/attendance', protectAdmin, getAttendanceByDate);
router.get('/leaves', protectAdmin, getAllLeaves);

// Protected Admin Routes
router.get('/', protectAdmin, checkPermission('Manage Employees'), getEmployees);
router.post('/', protectAdmin, checkPermission('Manage Employees'), createEmployee);

router.get('/:id', protectAdmin, checkPermission('Manage Employees'), getEmployeeById);
router.put('/:id', protectAdmin, checkPermission('Manage Employees'), updateEmployee);
router.post('/:id/avatar', protectAdmin, checkPermission('Manage Employees'), upload.single('avatar'), uploadEmployeeAvatarById);
router.delete('/:id', protectAdmin, checkPermission('Manage Employees'), deleteEmployee);
router.post('/:id/remind-hr', protectAdmin, checkPermission('Manage Employees'), remindHrForDocuments);
router.post('/:id/remind-employee', protectAdmin, checkPermission('Manage Employees'), remindEmployeeForOnboarding);
router.put('/:id/status', protectAdmin, checkPermission('Manage Employees'), updateEmployeeStatus);
router.put('/:id/documents/:docId/status', protectAdmin, checkPermission('Manage Employees'), updateDocumentStatus);
router.get('/:id/reupload-link', protectAdmin, checkPermission('Manage Employees'), getReuploadLink);

router.post('/:id/attendance', protectAdmin, addAttendanceRecord);
router.post('/:id/leaves', protectAdmin, addLeaveRecord);
router.put('/:id/leaves/:leaveId/status', protectAdmin, updateLeaveStatus);

module.exports = router;

