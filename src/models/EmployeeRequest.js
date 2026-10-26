const mongoose = require('mongoose');

const employeeRequestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true
  },
  empId: {
    type: String,
    required: true
  },
  employeeName: {
    type: String,
    default: ''
  },
  product: {
    type: String,
    default: 'UBL' // UBL, LAP, HL, PL
  },
  queryType: {
    type: String,
    default: 'Rejected' // Rejected, Hold, Disbursal, Document
  },
  subQueryType: {
    type: String,
    default: 'Re-Check' // Re-Check, Valuation, Legal, CIBIL
  },
  openDate: {
    type: Date,
    default: Date.now
  },
  closingDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['Closed', 'Returned', 'In-Process'],
    default: 'In-Process'
  },
  remarks: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('EmployeeRequest', employeeRequestSchema);
