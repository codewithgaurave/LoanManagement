const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  detail: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['application', 'pending', 'document', 'overdue', 'system', 'approval', 'submission', 'assignment', 'rejection', 'offer', 'followup', 'alert', 'info', 'warning', 'success'],
    default: 'system'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  recipientEmpId: {
    type: String,
    default: null
  },
  recipientUserId: {
    type: String,
    default: null
  },
  audience: {
    type: String,
    default: null // 'all', 'all_employees', 'specific_employee', 'all_customers', 'specific_customer'
  },
  zone: {
    type: String,
    default: null // e.g. 'NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'ALL'
  },
  leadId: {
    type: String,
    default: null
  },
  enquiryId: {
    type: String,
    default: null
  },
  customerPhone: {
    type: String,
    default: null
  },
  customerEmail: {
    type: String,
    default: null
  },
  customerName: {
    type: String,
    default: null
  },
  actionScreen: {
    type: String,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
