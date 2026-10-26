const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  designation: {
    type: String,
    default: '',
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Full Time', 'Part Time', 'Contract', 'Internship', 'Freelance'],
    default: 'Full Time'
  },
  department: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Open', 'Closed', 'Inactive'],
    default: 'Open'
  },
  publishStatus: {
    type: String,
    enum: ['Draft', 'Published'],
    default: 'Published'
  },
  openings: {
    type: Number,
    default: 1
  },
  skills: {
    type: String,
    default: ''
  },
  zone: {
    type: String,
    enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'ALL'],
    default: 'NORTH'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
