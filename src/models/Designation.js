const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    required: true,
    enum: ['OPERATIONAL', 'FIELD-SALES', 'BRANCH SALES', 'COLLECTIONS', 'OFFICIAL WORK']
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, { timestamps: true });

designationSchema.index({ name: 1, department: 1 }, { unique: true });

module.exports = mongoose.model('Designation', designationSchema);
