require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function checkCollections() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cols = await mongoose.connection.db.listCollections().toArray();
  console.log('Total collections in DB:', cols.length);
  const names = cols.map(c => c.name);
  console.log('Matching names:');
  console.log(names.filter(n => n.toLowerCase().includes('req') || n.toLowerCase().includes('hir') || n.toLowerCase().includes('lead') || n.toLowerCase().includes('notif')));
  await mongoose.disconnect();
}

checkCollections();
