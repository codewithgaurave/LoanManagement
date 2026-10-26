const http = require('http');

const req = http.get('http://localhost:5000/api/notifications', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response Body:', data);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Request Error:', err.message);
  process.exit(1);
});
