const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },
  grossMonthly: { type: Number, default: 0 },
  grossYearly: { type: Number, default: 0 },
  transport: { type: Number, default: 0 },
  perfBonus: { type: Number, default: 0 },
  achievement: { type: Number, default: 0 },
  incentives: { type: Number, default: 0 },
  customFields: {
    type: Map,
    of: Number,
    default: {}
  },
  approvalStatus: {
    type: String,
    enum: ['Approved', 'Pending Approval', 'Rejected'],
    default: 'Approved'
  },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  submittedByName: { type: String, default: '' },
  submittedByRole: { type: String, default: '' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  approvedByName: { type: String, default: '' },
  rejectionReason: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Payroll', payrollSchema);

