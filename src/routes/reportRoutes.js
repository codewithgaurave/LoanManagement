const express = require('express');
const router = express.Router();
const {
  getEmployeeReport,
  getAttendanceReport,
  getLeaveReport,
  getDocumentReport,
  getPerformanceReport
} = require('../controllers/reportController');
const { protectAdmin, checkPermission } = require('../middlewares/authMiddleware');

router.get('/employee', protectAdmin, getEmployeeReport);
router.get('/attendance', protectAdmin, getAttendanceReport);
router.get('/leaves', protectAdmin, getLeaveReport);
router.get('/documents', protectAdmin, getDocumentReport);
router.get('/performance', protectAdmin, getPerformanceReport);

module.exports = router;
