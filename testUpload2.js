const fs = require('fs');
const FormData = require('form-data');

async function test() {
  try {
    const form = new FormData();
    form.append('bankName', 'SBI Bank 2');
    form.append('bankAccNum', '0987654321');
    
    // Create a dummy file
    fs.writeFileSync('dummy.txt', 'Hello World');
    
    const serializedDocs = [{
      key: 'Passport Photo',
      name: 'dummy.txt',
      type: 'text/plain'
    }];
    
    form.append('Passport Photo', fs.createReadStream('dummy.txt'));
    form.append('documents', JSON.stringify(serializedDocs));
    
    const postRes = await fetch('http://localhost:5000/api/employees/onboarding/6a97c5ef20f3b8fb0fbe3475', {
      method: 'POST',
      body: form
    });
    
    console.log('POST Status:', postRes.status);
    const data = await postRes.json();
    
    // Check if fileUrl is saved for Passport Photo
    const doc = data.employee.documents.find(d => d.key === 'Passport Photo');
    console.log('Passport Photo Doc:', doc);
    
  } catch (err) {
    console.error(err);
  }
}

test();
