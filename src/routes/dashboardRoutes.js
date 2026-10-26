const express = require('express');
const router = express.Router();
const { getDashboardData, getHRDashboardData, getOpsDashboardData } = require('../controllers/dashboardController');
const { protectAdmin } = require('../middlewares/authMiddleware');

router.get('/', protectAdmin, getDashboardData);
router.get('/hr', protectAdmin, getHRDashboardData);
router.get('/ops-overview', protectAdmin, getOpsDashboardData);

module.exports = router;

