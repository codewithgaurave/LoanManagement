async function test() {
  try {
    const form = new FormData();
    form.append('bankName', 'SBI Bank');
    form.append('bankAccNum', '1234567890');
    form.append('fathersName', 'Ramesh Kumar');
    
    const postRes = await fetch('http://localhost:5000/api/employees/onboarding/6a97c5ef20f3b8fb0fbe3475', {
      method: 'POST',
      body: form
    });
    
    console.log('POST Status:', postRes.status);
    const data = await postRes.json();
    console.log('POST Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
