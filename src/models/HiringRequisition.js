const mongoose = require('mongoose');

const hiringRequisitionSchema = new mongoose.Schema({
  reqId: {
    type: String,
    unique: true
  },
  zone: {
    type: String,
    enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'ALL'],
    required: true
  },
  role: {
    type: String,
    required: true
  },
  requiredCount: {
    type: Number,
    required: true,
    min: 1
  },
  hiredCount: {
    type: Number,
    default: 0
  },
  priority: {
    type: String,
    enum: ['Urgent', 'High', 'Medium', 'Low'],
    default: 'High'
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'In-Process', 'Fulfilled', 'Closed'],
    default: 'Pending'
  },
  requestedBy: {
    type: String,
    default: 'Sales Head'
  },
  requestedById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  requestId: {
    type: String
  },
  requestCategory: {
    type: String,
    default: 'HIRING_REQUISITION'
  }
}, { timestamps: true, collection: 'employeerequests' });

// Auto-generate reqId and requestId
hiringRequisitionSchema.pre('save', async function() {
  if (!this.reqId) {
    const count = await mongoose.model('HiringRequisition').countDocuments();
    const id = `REQ-${Date.now().toString().slice(-4)}${(count + 1).toString().padStart(3, '0')}`;
    this.reqId = id;
    this.requestId = id;
  } else if (!this.requestId) {
    this.requestId = this.reqId;
  }
});

module.exports = mongoose.model('HiringRequisition', hiringRequisitionSchema);
