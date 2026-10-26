const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ALL_PERMISSIONS = [
  'Manage Users', 'Manage Employees', 'Role & Permission Management',
  'Lead Management', 'Assign Lead to Employee', 'Status Management',
  'View Loan Applications', 'Approve/Reject/Hold Loan',
  'Verify Documents', 'Download Documents', 'Send Reminders/SMS',
  'View Reports', 'Export Data', 'Payroll/Salary', 'Manage Payroll Headings',
  // Job Hiring Permissions
  'View Job', 'Add Job', 'Edit Job', 'Delete Job', 'Active / Inactive Job', 'Publish Job', 'Assign Job Application'
];

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    default: 'admin',
  },
  subRole: {
    type: String,
    default: ''
  },
  zonalRole: {
    type: String,
    enum: ['Sales Head', 'RRM', 'ARM', 'RM', 'RO', 'RE', 'Telecaller', 'Operation Manager', 'Operation Admin', 'Collection Staff', 'HR Head', 'HR Manager', 'HR Executive', 'Other'],
    default: 'Other'
  },
  zone: {
    type: String,
    enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'ALL'],
    default: 'NORTH'
  },
  reportingManagerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  departmentHeadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  rrmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  rrmName: { type: String, default: null },
  armId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  armName: { type: String, default: null },
  rmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  rmName: { type: String, default: null },
  permissions: [{
    type: String
  }],
  phone: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Blocked'],
    default: 'Active'
  },
  avatar: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
});

// Hash password before saving
adminSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match admin entered password to hashed password in database
adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
