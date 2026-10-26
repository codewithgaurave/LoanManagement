const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  departmentId: {
    type: String,
    required: true,
    unique: true
  },
  departmentCode: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    default: ''
  },
  head: {
    type: String,
    default: 'N/A'
  },
  headRole: {
    type: String,
    default: 'N/A'
  },
  headEmployeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  headAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  headEmail: {
    type: String,
    default: ''
  },
  headPhone: {
    type: String,
    default: ''
  },
  subRoles: [{
    type: String
  }],
  designations: [{
    name: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    createdAt: { type: Date, default: Date.now }
  }],
  budget: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Department', departmentSchema);
