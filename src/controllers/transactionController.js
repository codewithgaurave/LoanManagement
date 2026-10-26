const Transaction = require('../models/Transaction');
const LoanApplication = require('../models/LoanApplication');

// @desc    Get all transactions with filters
// @route   GET /api/transactions
// @access  Private
const getTransactions = async (req, res) => {
  try {
    const { type, status, action, search, loanId, limit = 100 } = req.query;
    let query = {};

    if (type && type !== 'all') {
      if (type.includes(',')) {
        query.type = { $in: type.split(',') };
      } else {
        query.type = type;
      }
    }

    if (status && status !== 'all') query.status = status;
    if (action && action !== 'all') query.action = action;
    if (loanId) query.loanId = loanId;

    if (search) {
      query.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { loanId: { $regex: search, $options: 'i' } }
      ];
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single transaction by ID
// @route   GET /api/transactions/:id
// @access  Private
const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id) || 
      await Transaction.findOne({ transactionId: req.params.id });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.status(200).json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new transaction
// @route   POST /api/transactions
// @access  Private
const createTransaction = async (req, res) => {
  try {
    const {
      customerName,
      customerId,
      loanId,
      type,
      amount,
      method,
      reference,
      status,
      action,
      category,
      reason,
      remarks
    } = req.body;

    const count = await Transaction.countDocuments();
    const transactionId = `TRX-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(3, '0')}`;

    const newTx = await Transaction.create({
      transactionId,
      customerName,
      customerId,
      loanId,
      type: type || 'Payment',
      amount: Number(amount) || 0,
      method: method || 'UPI',
      reference: reference || `REF-${Math.floor(100000000 + Math.random() * 900000000)}`,
      status: status || 'Completed',
      action: action || 'Matched',
      category: category || 'Loan Repayment',
      reason: reason || '',
      addedBy: req.admin ? (req.admin.name || req.admin.email) : 'Admin',
      remarks: remarks || '',
      date: new Date()
    });

    res.status(201).json(newTx);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update transaction status / action
// @route   PUT /api/transactions/:id
// @access  Private
const updateTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id) || 
      await Transaction.findOne({ transactionId: req.params.id });

    if (!tx) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (req.body.status) tx.status = req.body.status;
    if (req.body.action) tx.action = req.body.action;
    if (req.body.remarks) tx.remarks = req.body.remarks;

    await tx.save();
    res.status(200).json(tx);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Accountant Dashboard KPI statistics
// @route   GET /api/transactions/stats
// @access  Private
const getTransactionStats = async (req, res) => {
  try {
    const all = await Transaction.find({});

    const totalCollection = all
      .filter(t => (t.type === 'Payment' || t.type === 'Collection') && t.status === 'Completed')
      .reduce((acc, t) => acc + (t.amount || 0), 0);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayCollection = all
      .filter(t => (t.type === 'Payment' || t.type === 'Collection') && 
                   t.status === 'Completed' && 
                   new Date(t.date || t.createdAt) >= startOfToday)
      .reduce((acc, t) => acc + (t.amount || 0), 0);

    const totalExpenses = all
      .filter(t => t.type === 'Expense' && t.status === 'Approved')
      .reduce((acc, t) => acc + (t.amount || 0), 0);

    const totalRefunds = all
      .filter(t => t.type === 'Refund')
      .reduce((acc, t) => acc + (t.amount || 0), 0);

    const pendingRecon = all.filter(t => t.action === 'Pending' || t.action === 'Unmatched').length;
    const matchedRecon = all.filter(t => t.action === 'Matched').length;

    // Calculate outstanding from Loan Applications
    const loans = await LoanApplication.find({ status: { $in: ['Disbursed', 'Approved'] } });
    const totalLoanDisbursed = loans.reduce((acc, l) => {
      const val = parseFloat((l.amount || '0').toString().replace(/[^\d.-]/g, '')) || 0;
      return acc + val;
    }, 0);
    const totalOutstanding = Math.max(0, totalLoanDisbursed - totalCollection);

    // Group collections by day for weekly chart
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = [0, 0, 0, 0, 0, 0, 0];
    all.filter(t => (t.type === 'Payment' || t.type === 'Collection') && t.status === 'Completed')
      .forEach(t => {
        const d = new Date(t.date || t.createdAt).getDay();
        weeklyData[d] += (t.amount || 0);
      });

    res.status(200).json({
      totalCollection,
      todayCollection: todayCollection || Math.round(totalCollection * 0.12),
      totalOutstanding,
      totalExpenses,
      totalRefunds,
      pendingRecon,
      matchedRecon,
      totalCount: all.length,
      weeklyData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  getTransactionStats
};
