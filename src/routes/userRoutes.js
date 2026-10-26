const express = require('express');
const router = express.Router();
const {
  registerUser,
  sendOtp,
  verifyOtp,
  loginUser,
  setCustomerMpin,
  loginWithCustomerMpin,
  googleLoginCustomer,
  updateCustomerFcmToken,
  getDocumentConfig,
  createCustomerApplication,
  uploadCustomerDocument,
  saveCustomerDocuments,
  getMyApplications,
  getMyApplicationById,
  getUsers,
  getUserById,
  updateUserStatus,
  deleteUser,
  updateDocumentStatus,
  assignUser,
  bulkAssignUsers,
  getUserProfile,
  updateUserProfile,
  uploadCustomerAvatar,
  getMyLoansDetailed,
  submitRepayRequest,
  createRazorpayOrder,
  verifyRazorpayPayment,
  updateOfferStatus,
  createAdminUser
} = require('../controllers/userController');
const { protectAdmin, protectUser, checkPermission } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Public routes (customer app)
router.get('/document-config', getDocumentConfig);
router.get('/my-loans', getMyLoansDetailed);
router.get('/profile', getUserProfile);
router.get('/:id/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.put('/:id/profile', updateUserProfile);
router.post('/upload-avatar', upload.single('avatar'), uploadCustomerAvatar);
router.post('/offer-status', updateOfferStatus);
router.post('/repay-request', submitRepayRequest);
router.post('/razorpay/create-order', createRazorpayOrder);
router.post('/razorpay/verify-payment', verifyRazorpayPayment);
router.post('/register', registerUser);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/set-mpin', setCustomerMpin);
router.post('/login-mpin', loginWithCustomerMpin);
router.post('/google-login', googleLoginCustomer);
router.post('/fcm-token', updateCustomerFcmToken);
router.post('/login', loginUser);
router.post('/upload-document', upload.single('file'), uploadCustomerDocument);
router.post('/save-documents', protectUser, saveCustomerDocuments);
router.post('/applications', protectUser, createCustomerApplication);
router.post('/applications/documents', protectUser, upload.single('file'), uploadCustomerDocument);
router.get('/applications', protectUser, getMyApplications);
router.get('/applications/:id', protectUser, getMyApplicationById);
router.route('/').get(protectAdmin, checkPermission('Manage Users'), getUsers)
  .post(protectAdmin, checkPermission('Manage Users'), createAdminUser);
router.route('/bulk-assign').put(protectAdmin, checkPermission('Manage Users'), bulkAssignUsers);
router.route('/:id/assign').put(protectAdmin, checkPermission('Manage Users'), assignUser);
router.route('/:id').get(protectAdmin, checkPermission('Manage Users'), getUserById);

// Protected routes
router.route('/:id')
  .delete(protectAdmin, checkPermission('Manage Users'), deleteUser);

router.route('/:id/status')
  .put(protectAdmin, checkPermission('Manage Users'), updateUserStatus);

// Document verification — requires 'Verify Documents' permission
router.route('/:id/documents/:docIndex/status')
  .put(protectAdmin, checkPermission('Verify Documents'), updateDocumentStatus);

module.exports = router;
