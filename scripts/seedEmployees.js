const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const Employee = require('../src/models/Employee');

dotenv.config();

const employeesData = [
  // VERIFIED EMPLOYEES
  {
    empId: 'EMP-HRMS-001',
    name: 'Ramesh Kumar',
    email: 'ramesh.kumar@nuoghousing.com',
    mobile: '9876543210',
    city: 'Gomti Nagar, Lucknow',
    district: 'Lucknow',
    state: 'Uttar Pradesh',
    role: 'UNSECURED LOAN MANAGER',
    designation: 'Executive Loan Manager',
    status: 'Active',
    onboardingStatus: 'Done',
    password: 'password123'
  },
  {
    empId: 'EMP-HRMS-002',
    name: 'Avni Saha',
    email: 'avni.saha@nuoghousing.com',
    mobile: '9811223344',
    city: 'Sector 62, Noida',
    district: 'Gautam Buddha Nagar',
    state: 'Uttar Pradesh',
    role: 'TELECALLER',
    designation: 'Senior Telecaller',
    status: 'Active',
    onboardingStatus: 'Done',
    password: 'password123'
  },
  {
    empId: 'EMP-HRMS-003',
    name: 'Kamal Sharma',
    email: 'kamal.sharma@nuoghousing.com',
    mobile: '9765432190',
    city: 'Civil Lines, Kanpur',
    district: 'Kanpur Nagar',
    state: 'Uttar Pradesh',
    role: 'AGENT MANAGER',
    designation: 'Field Agent Manager',
    status: 'Active',
    onboardingStatus: 'Done',
    password: 'password123'
  },
  {
    empId: 'EMP-HRMS-004',
    name: 'Lucky Singh',
    email: 'lucky.singh@nuoghousing.com',
    mobile: '9899123456',
    city: 'Hazratganj, Lucknow',
    district: 'Lucknow',
    state: 'Uttar Pradesh',
    role: 'REPORTING MANAGER',
    designation: 'Reporting Field Manager',
    status: 'Active',
    onboardingStatus: 'Done',
    password: 'password123'
  },
  {
    empId: 'EMP-HRMS-005',
    name: 'Pooja Verma',
    email: 'pooja.verma@nuoghousing.com',
    mobile: '9988776655',
    city: 'Varanasi Cantt, Varanasi',
    district: 'Varanasi',
    state: 'Uttar Pradesh',
    role: 'TELECALLER',
    designation: 'Customer Relationship Exec',
    status: 'Active',
    onboardingStatus: 'Done',
    password: 'password123'
  },

  // NON-VERIFIED EMPLOYEES
  {
    empId: 'EMP-HRMS-006',
    name: 'Rahul Mishra',
    email: 'rahul.mishra@nuoghousing.com',
    mobile: '9711002233',
    city: 'Indira Nagar, Lucknow',
    district: 'Lucknow',
    state: 'Uttar Pradesh',
    role: 'HR',
    designation: 'HR Executive Trainee',
    status: 'Active',
    onboardingStatus: 'Pending',
    password: 'password123'
  },
  {
    empId: 'EMP-HRMS-007',
    name: 'Pranav Singh',
    email: 'pranav.singh@nuoghousing.com',
    mobile: '9654123980',
    city: 'Alambagh, Lucknow',
    district: 'Lucknow',
    state: 'Uttar Pradesh',
    role: 'SECURED EXEC',
    designation: 'Secure Field Executive',
    status: 'Active',
    onboardingStatus: 'Pending',
    password: 'password123'
  },
  {
    empId: 'EMP-HRMS-008',
    name: 'Praveen Manik',
    email: 'praveen.manik@nuoghousing.com',
    mobile: '9822334455',
    city: 'Sector 18, Noida',
    district: 'Gautam Buddha Nagar',
    state: 'Uttar Pradesh',
    role: 'AGENT EXEC',
    designation: 'Field Executive',
    status: 'Active',
    onboardingStatus: 'Pending',
    password: 'password123'
  },
  {
    empId: 'EMP-HRMS-009',
    name: 'Kiran Jha',
    email: 'kiran.jha@nuoghousing.com',
    mobile: '9544332211',
    city: 'Sigra, Varanasi',
    district: 'Varanasi',
    state: 'Uttar Pradesh',
    role: 'SECURED LOAN MANAGER',
    designation: 'Field Supervisor',
    status: 'Active',
    onboardingStatus: 'Submitted',
    password: 'password123'
  },
  {
    empId: 'EMP-HRMS-010',
    name: 'Sitaram Patel',
    email: 'sitaram.patel@nuoghousing.com',
    mobile: '9788991122',
    city: 'Gorakhnath, Gorakhpur',
    district: 'Gorakhpur',
    state: 'Uttar Pradesh',
    role: 'SENIOR TELECALLER',
    designation: 'Telecaller Associate',
    status: 'Active',
    onboardingStatus: 'Pending',
    password: 'password123'
  }
];

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/loan_management';

mongoose.connect(mongoUri)
  .then(async () => {
    console.log('Connected to MongoDB for seeding employees...');

    for (const emp of employeesData) {
      const salt = await bcrypt.genSalt(10);
      emp.password = await bcrypt.hash(emp.password, salt);

      await Employee.findOneAndUpdate(
        { empId: emp.empId },
        { $set: emp },
        { upsert: true, new: true }
      );
    }

    console.log(`Successfully seeded/updated ${employeesData.length} employees with EMP-HRMS IDs, Mobiles & Areas!`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Database connection error:', err);
    process.exit(1);
  });
