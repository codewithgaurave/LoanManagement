const mongoose = require('mongoose');
const User = require('./src/models/User');
const Employee = require('./src/models/Employee');

const directURI = 'mongodb://digicodersdevelopment_db_user:KoJGvdKsGU9IQQvk@ac-p0l3j0u-shard-00-00.9ssqshr.mongodb.net:27017,ac-p0l3j0u-shard-00-01.9ssqshr.mongodb.net:27017,ac-p0l3j0u-shard-00-02.9ssqshr.mongodb.net:27017/loan_management?ssl=true&replicaSet=atlas-2c1v0j-shard-0&authSource=admin&retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(directURI);
  const uCount = await User.countDocuments({ fcmToken: { $exists: true, $ne: null, $nin: ['', 'null'] } });
  const eCount = await Employee.countDocuments({ fcmToken: { $exists: true, $ne: null, $nin: ['', 'null'] } });
  console.log('Users with fcmToken:', uCount);
  console.log('Employees with fcmToken:', eCount);
  
  const employeesWithToken = await Employee.find({ fcmToken: { $exists: true, $ne: null, $nin: ['', 'null'] } }).select('empId name email fcmToken');
  console.log('Employees:', employeesWithToken);

  const usersWithToken = await User.find({ fcmToken: { $exists: true, $ne: null, $nin: ['', 'null'] } }).select('userId name phone email fcmToken');
  console.log('Users:', usersWithToken);

  await mongoose.disconnect();
}
run();

