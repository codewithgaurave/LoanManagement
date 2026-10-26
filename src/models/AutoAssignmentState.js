const mongoose = require('mongoose');

const autoAssignmentStateSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'telecaller_round_robin'
  },
  lastAssignedTelecallerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  lastAssignedEmpId: {
    type: String,
    default: ''
  },
  lastAssignedName: {
    type: String,
    default: ''
  },
  lastAssignedIndex: {
    type: Number,
    default: 0
  },
  totalAssignedCount: {
    type: Number,
    default: 0
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('AutoAssignmentState', autoAssignmentStateSchema);
