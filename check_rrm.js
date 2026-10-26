require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Employee = require('./src/models/Employee');
    const rrms = await Employee.find({ 
      $or: [{ zonalRole: 'RRM' }, { role: /RRM/i }, { designation: /RRM/i }, { role: /Regional/i }] 
    }).select('empId name email role designation zonalRole zone status');
    console.log('Existing RRMs:', JSON.stringify(rrms, null, 2));

    const arms = await Employee.find({ 
      $or: [{ zonalRole: 'ARM' }, { role: /ARM/i }, { designation: /ARM/i }, { role: /Area/i }] 
    }).select('empId name email role designation zonalRole zone rrmId rrmName status');
    console.log('Existing ARMs:', JSON.stringify(arms, null, 2));

    const HiringRequisition = require('./src/models/HiringRequisition');
    const reqs = await HiringRequisition.find().sort({ createdAt: -1 }).limit(10);
    console.log('Hiring Requisitions count:', reqs.length);
    if (reqs.length > 0) {
      console.log('Sample req:', JSON.stringify(reqs[0], null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

check();
