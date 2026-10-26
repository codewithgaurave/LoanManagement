const express = require('express');
const router = express.Router();
const { protectAdmin, checkPermission } = require('../middlewares/authMiddleware');
const {
  getDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation
} = require('../controllers/designationController');

// Public or Admin read
router.get('/', getDesignations);

// Protected Admin routes
router.post('/', protectAdmin, checkPermission('Manage Designations'), createDesignation);
router.put('/:id', protectAdmin, checkPermission('Manage Designations'), updateDesignation);
router.delete('/:id', protectAdmin, checkPermission('Manage Designations'), deleteDesignation);

module.exports = router;
