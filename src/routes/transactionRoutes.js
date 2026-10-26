const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  getTransactionStats
} = require('../controllers/transactionController');
const { protectAdmin } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protectAdmin, getTransactions)
  .post(protectAdmin, createTransaction);

router.route('/stats')
  .get(protectAdmin, getTransactionStats);

router.route('/:id')
  .get(protectAdmin, getTransactionById)
  .put(protectAdmin, updateTransaction);

module.exports = router;
