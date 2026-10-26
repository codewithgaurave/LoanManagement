require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

async function main() {
  try {
    console.log('Connecting to:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');

    const Lead = require('./src/models/Lead');
    const HiringRequisition = require('./src/models/HiringRequisition');
    const LoanApplication = require('./src/models/LoanApplication');

    const leadCount = await Lead.countDocuments();
    const appCount = await LoanApplication.countDocuments();
    const reqCount = await HiringRequisition.countDocuments();

    console.log(`Leads in DB: ${leadCount}`);
    console.log(`LoanApplications in DB: ${appCount}`);
    console.log(`HiringRequisitions in DB: ${reqCount}`);

    const sampleLeads = await Lead.find({}).limit(5).select('leadId name zone workflowStage status expectedAmount loanAmount');
    console.log('Sample Leads:', JSON.stringify(sampleLeads, null, 2));

    await mongoose.disconnect();
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
