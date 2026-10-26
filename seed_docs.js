const mongoose = require('mongoose');
const LoanApplication = require('./src/models/LoanApplication');

require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI);

async function seedDocuments() {
  try {
    const apps = await LoanApplication.find();
    for (let app of apps) {
      app.documents = [
        {
          type: 'Aadhar Card',
          fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          status: 'Pending'
        },
        {
          type: 'PAN Card',
          fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          status: 'Pending'
        }
      ];
      await app.save();
    }
    console.log('Seeded documents to all applications');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

seedDocuments();
