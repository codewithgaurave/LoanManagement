require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function seedReqs() {
  await mongoose.connect(process.env.MONGODB_URI);
  const HiringRequisition = require('./src/models/HiringRequisition');

  const reqs = [
    { zone: 'NORTH', role: 'RO', requiredCount: 6, hiredCount: 3, priority: 'High', status: 'In-Process', notes: 'Field officers for Lucknow & Noida territory' },
    { zone: 'SOUTH', role: 'ARM', requiredCount: 3, hiredCount: 1, priority: 'Medium', status: 'In-Process', notes: 'Area managers for Bengaluru and Chennai branches' },
    { zone: 'WEST', role: 'Telecaller', requiredCount: 5, hiredCount: 5, priority: 'Urgent', status: 'Fulfilled', notes: 'Lead qualification desk Mumbai' },
    { zone: 'EAST', role: 'RM', requiredCount: 4, hiredCount: 1, priority: 'High', status: 'In-Process', notes: 'Reporting managers for Kolkata and Bhubaneswar' },
    { zone: 'CENTRAL', role: 'RO', requiredCount: 4, hiredCount: 2, priority: 'Low', status: 'In-Process', notes: 'Bhopal and Indore field expansion' }
  ];

  for (const r of reqs) {
    await HiringRequisition.create(r);
  }

  console.log('Inserted requisitions. Total now:', await HiringRequisition.countDocuments());
  await mongoose.disconnect();
}

seedReqs();
