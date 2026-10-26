require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const Admin = require('../src/models/Admin');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const createSuperAdmin = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected for script.');

    // Support command line arguments or prompt: node scripts/createSuperAdmin.js email password name
    const args = process.argv.slice(2);
    const emailArg = args[0];
    const passwordArg = args[1];
    const nameArg = args[2] || 'Super Admin';

    const email = emailArg || (await question('Enter Superadmin Email: '));
    const password = passwordArg || (await question('Enter Superadmin Password: '));
    const name = nameArg || 'Super Admin';

    if (!email || !password) {
      console.error('Email and Password are required!');
      process.exit(1);
    }

    const cleanEmail = email.trim();
    let existingAdmin = await Admin.findOne({ email: new RegExp(`^${cleanEmail}$`, 'i') });

    if (existingAdmin) {
      existingAdmin.password = password.trim();
      existingAdmin.role = 'superadmin';
      existingAdmin.name = name;
      existingAdmin.status = 'Active';
      await existingAdmin.save();
      console.log(`Updated existing user ${cleanEmail} as superadmin!`);
      process.exit(0);
    }

    const superAdmin = new Admin({
      name,
      email: cleanEmail,
      password: password.trim(),
      role: 'superadmin',
      subRole: 'Super Admin',
      zone: 'ALL',
      status: 'Active'
    });

    await superAdmin.save();
    console.log(`Superadmin ${name} (${cleanEmail}) created successfully in Admin collection!`);
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
};

createSuperAdmin();
