const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Notification = require('../src/models/Notification');

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/loan_management')
.then(async () => {
  console.log('Connected to MongoDB for seeding notifications');

  await Notification.deleteMany({});
  
  const sampleNotifications = [
    { title: '5 new applications submitted today', type: 'application' },
    { title: '3 applications are pending for approval', type: 'pending' },
    { title: '2 documents are pending for verification', type: 'document' },
    { title: '1 loan payment is overdue', type: 'overdue' }
  ];

  await Notification.insertMany(sampleNotifications);
  console.log('Mock Notifications added successfully!');

  process.exit();
})
.catch((err) => {
  console.error('Database connection error:', err);
  process.exit(1);
});
