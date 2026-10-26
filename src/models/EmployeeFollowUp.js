const mongoose = require('mongoose');

const employeeFollowUpSchema = new mongoose.Schema({
  leadName: { type: String, required: true, trim: true },
  leadId: { type: String, default: '' },
  mobile: { type: String, default: '' },
  type: {
    type: String,
    enum: ['Call', 'Meeting', 'WhatsApp', 'Email', 'Visit', 'Tele Call', 'Site Visit', 'Document Collection'],
    required: true
  },
  purpose: { type: String, default: '' },
  scheduledAt: { type: Date, required: true },
  reminder: { type: String, default: '10 min before' },
  notes: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['Upcoming', 'Due Today', 'Completed', 'Missed', 'Cancelled'],
    default: 'Upcoming'
  },
  assignedToId: { type: String, required: true, index: true },
  assignedToName: { type: String, required: true },
  createdById: { type: String, required: true },
  createdByName: { type: String, required: true },
  createdByRole: { type: String, default: '' }
}, { timestamps: true, collection: 'followups' });

module.exports = mongoose.model('EmployeeFollowUp', employeeFollowUpSchema);
