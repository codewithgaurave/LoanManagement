const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  visitId: {
    type: String,
    required: true,
    unique: true
  },
  leadId: {
    type: String,
    default: ''
  },
  loanId: {
    type: String,
    default: ''
  },
  customerName: {
    type: String,
    required: true
  },
  mobile: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    default: 'Lucknow'
  },
  pincode: {
    type: String,
    default: '226010'
  },
  purpose: {
    type: String,
    enum: ['Document Collection', 'Address Verification', 'Business Verification', 'Follow-up', 'EMI Recovery', 'Asset Inspection'],
    default: 'Address Verification'
  },
  scheduledDate: {
    type: Date,
    default: Date.now
  },
  scheduledTime: {
    type: String,
    default: '11:00 AM'
  },
  agentId: {
    type: String,
    default: ''
  },
  agentName: {
    type: String,
    default: 'Field Agent'
  },
  status: {
    type: String,
    enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Rescheduled'],
    default: 'Scheduled'
  },
  outcome: {
    type: String,
    default: ''
  },
  remarks: {
    type: String,
    default: ''
  },
  documentsCollected: [{
    type: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Visit', visitSchema);
