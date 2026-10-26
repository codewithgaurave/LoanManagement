const jwt = require('jsonwebtoken');
const http = require('http');
require('dotenv').config();

const token = jwt.sign({ id: '6a97b4c8f4f227d9a95f3111', role: 'superadmin' }, process.env.JWT_SECRET || 'secret');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/notifications',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response Body:', data);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

req.end();
