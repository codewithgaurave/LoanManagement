const express = require('express');
const router = express.Router();
const {
  getFollowUps,
  createFollowUp,
  updateFollowUpStatus,
  assignFollowUp
} = require('../controllers/followUpController');
const { protectAdmin } = require('../middlewares/authMiddleware');

router.get('/', protectAdmin, getFollowUps);
router.post('/', protectAdmin, createFollowUp);
router.put('/:id/status', protectAdmin, updateFollowUpStatus);
router.put('/:id/assign', protectAdmin, assignFollowUp);

module.exports = router;
