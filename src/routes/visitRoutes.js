const express = require('express');
const router = express.Router();
const {
  getVisits,
  getVisitById,
  createVisit,
  updateVisit,
  getVisitStats
} = require('../controllers/visitController');
const { protectAdmin } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protectAdmin, getVisits)
  .post(protectAdmin, createVisit);

router.route('/stats')
  .get(protectAdmin, getVisitStats);

router.route('/:id')
  .get(protectAdmin, getVisitById)
  .put(protectAdmin, updateVisit);

module.exports = router;
