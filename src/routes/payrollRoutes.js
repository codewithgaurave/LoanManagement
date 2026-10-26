const express = require('express');
const router = express.Router();
const { 
  getAllPayrolls, 
  updatePayroll, 
  approvePayroll, 
  rejectPayroll,
  getPayrollHeadings,
  createPayrollHeading,
  deletePayrollHeading
} = require('../controllers/payrollController');
const { protectAdmin } = require('../middlewares/authMiddleware');

router.get('/headings', protectAdmin, getPayrollHeadings);
router.post('/headings', protectAdmin, createPayrollHeading);
router.delete('/headings/:id', protectAdmin, deletePayrollHeading);

router.get('/', protectAdmin, getAllPayrolls);
router.put('/:employeeId', protectAdmin, updatePayroll);
router.put('/:employeeId/approve', protectAdmin, approvePayroll);
router.put('/:employeeId/reject', protectAdmin, rejectPayroll);

module.exports = router;

