const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerId: {
    type: String,
    default: ''
  },
  loanId: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['Payment', 'Collection', 'Expense', 'Refund'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  method: {
    type: String,
    enum: ['UPI', 'Cash', 'Bank Transfer', 'Cheque', 'Net Banking'],
    default: 'UPI'
  },
  reference: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Completed', 'Pending', 'Failed', 'Processing', 'Approved', 'Refunded', 'Cancelled'],
    default: 'Completed'
  },
  action: {
    type: String,
    enum: ['Matched', 'Unmatched', 'Pending', 'Partial Match'],
    default: 'Matched'
  },
  category: {
    type: String,
    default: 'Loan Repayment'
  },
  reason: {
    type: String,
    default: ''
  },
  addedBy: {
    type: String,
    default: 'System'
  },
  date: {
    type: Date,
    default: Date.now
  },
  remarks: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);
