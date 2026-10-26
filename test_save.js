const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Admin = require('./src/models/Admin');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const admin = await Admin.findOne();
    if (!admin) {
      console.log('No admin found');
      process.exit();
    }
    
    // Attempt to save to trigger the exact error
    console.log('Found admin:', admin._id);
    admin.phone = '123456';
    await admin.save();
    console.log('Save successful');
  } catch (error) {
    console.error('Save error details:', error);
  }
  process.exit();
});
