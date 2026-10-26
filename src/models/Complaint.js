const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  complaintId: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    default: ''
  },
  userId: {
    type: String,
    default: ''
  },
  subject: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: 'General Support'
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'In Review', 'Resolved', 'Closed', 'Escalated'],
    default: 'Pending'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  adminReply: {
    type: String,
    default: ''
  },
  adminRemark: {
    type: String,
    default: ''
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  assignedTo: {
    type: String,
    default: null
  },
  assignedToId: {
    type: String,
    default: null
  },
  assignedBy: {
    type: String,
    default: null
  },
  assignedAt: {
    type: Date,
    default: null
  },
  assignmentHistory: [{
    assignedTo: String,
    assignedToId: String,
    assignedBy: String,
    assignedAt: { type: Date, default: Date.now },
    previousAssignee: String
  }]
}, { timestamps: true });

// Pre-save hook to generate complaintId if not exists
complaintSchema.pre('validate', async function() {
  if (!this.complaintId) {
    const lastComplaint = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
    if (lastComplaint && lastComplaint.complaintId) {
      const match = lastComplaint.complaintId.match(/\d+/);
      const lastIdNum = match ? parseInt(match[0]) : 100;
      this.complaintId = `TKT-${String(lastIdNum + 1).padStart(4, '0')}`;
    } else {
      this.complaintId = 'TKT-1001';
    }
  }
});

module.exports = mongoose.model('Complaint', complaintSchema);

