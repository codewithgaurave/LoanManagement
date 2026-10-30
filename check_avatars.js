const mongoose = require('mongoose');
const Employee = require('./src/models/Employee');
const Admin = require('./src/models/Admin');
const User = require('./src/models/User');

const directURI = 'mongodb://digicodersdevelopment_db_user:KoJGvdKsGU9IQQvk@ac-p0l3j0u-shard-00-00.9ssqshr.mongodb.net:27017,ac-p0l3j0u-shard-00-01.9ssqshr.mongodb.net:27017,ac-p0l3j0u-shard-00-02.9ssqshr.mongodb.net:27017/loan_management?ssl=true&replicaSet=atlas-2c1v0j-shard-0&authSource=admin&retryWrites=true&w=majority';

async function check() {
  await mongoose.connect(directURI);
  const emps = await Employee.find({}, '_id empId name email avatar documents');
  console.log('--- EMPLOYEES ---');
  emps.forEach(e => {
    let docsPhoto = null;
    if (e.documents && e.documents.length) {
      const p = e.documents.find(d => (d.name && d.name.toLowerCase().includes('photo')) || (d.key && d.key.toLowerCase().includes('photo')));
      if (p) docsPhoto = p.fileUrl ? (p.fileUrl.substring(0, 50) + '...') : null;
    }
    console.log(`[${e.empId}] ${e.name}: avatar = ${e.avatar ? (e.avatar.substring(0, 60) + '...') : 'NULL'}, docsPhoto = ${docsPhoto}`);
  });

  const admins = await Admin.find({}, '_id name email avatar');
  console.log('\n--- ADMINS ---');
  admins.forEach(a => {
    console.log(`[${a.name}] (${a.email}): avatar = ${a.avatar ? (a.avatar.substring(0, 60) + '...') : 'NULL'}`);
  });

  const users = await User.find({}, '_id userId name phone avatar documents');
  console.log('\n--- USERS (CUSTOMERS) ---');
  users.forEach(u => {
    console.log(`[${u.userId}] ${u.name} (${u.phone}): avatar = ${u.avatar ? (u.avatar.substring(0, 60) + '...') : 'NULL'}`);
  });

  await mongoose.disconnect();
  process.exit(0);
}

check();

