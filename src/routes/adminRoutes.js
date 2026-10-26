const express = require('express');
const router = express.Router();
const { 
  loginAdmin, 
  updateAdminPermissions, 
  updateRolePermissions,
  getAllAdmins,
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar
} = require('../controllers/adminController');
const { protectAdmin, adminOnly } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware'); // Note: uploadMiddleware must export multer instance

router.post('/login', loginAdmin);
router.get('/all', protectAdmin, adminOnly, getAllAdmins);
router.put('/:id/permissions', protectAdmin, adminOnly, updateAdminPermissions);
router.put('/role/:role/permissions', protectAdmin, adminOnly, updateRolePermissions);

// Profile routes
router.get('/profile', protectAdmin, getProfile);
router.put('/profile', protectAdmin, updateProfile);
router.put('/profile/password', protectAdmin, changePassword);
router.post('/profile/avatar', protectAdmin, upload.single('avatar'), uploadAvatar);

module.exports = router;

