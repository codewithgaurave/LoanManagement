const axios = require('axios');

async function testBackend() {
  try {
    const health = await axios.get('http://localhost:5000/api/health');
    console.log('Health check:', health.data);
  } catch (e) {
    console.error('Health check failed:', e.message);
  }

  // Attempt login with Sales Head credentials via /api/employees/login
  try {
    const loginRes = await axios.post('http://localhost:5000/api/employees/login', {
      email: 'saleshead@nuogm.com',
      password: 'SalesHead@123'
    });
    console.log('Login success! Token acquired.');
    const token = loginRes.data.token;

    // Test sales routes
    const metricsRes = await axios.get('http://localhost:5000/api/sales/dashboard-metrics', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('dashboard-metrics response:');
    console.log(JSON.stringify(metricsRes.data.metrics, null, 2));

    const chartsRes = await axios.get('http://localhost:5000/api/sales/chart-analytics', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('chart-analytics response keys:', Object.keys(chartsRes.data.charts));
    console.log('monthlyTrend:', chartsRes.data.charts.monthlyTrend);
    console.log('productData:', chartsRes.data.charts.productData);
    console.log('zoneComparison:', chartsRes.data.charts.zoneComparison);
  } catch (e) {
    console.error('Test error:', e.response?.status, e.response?.data || e.message);
  }
}

testBackend();
