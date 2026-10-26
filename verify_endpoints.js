const axios = require('axios');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhYjEwZDk5NmVkMjk2NWQ0MWRkMDU2NSIsInJvbGUiOiJTYWxlcyBIZWFkIiwiaWF0IjoxNzg5OTk2NjA5LCJleHAiOjE3OTA2MDE0MDl9.ULplmHrfOm-ba3a7koo8KlX5i17gnOlXWPhI42SQyxg';
const headers = { Authorization: `Bearer ${token}` };

async function verify() {
  try {
    const res1 = await axios.get('http://localhost:5000/api/sales/dashboard-metrics', { headers });
    console.log('1. Metrics status:', res1.status, res1.data.metrics);

    const res2 = await axios.get('http://localhost:5000/api/sales/chart-analytics', { headers });
    console.log('2. Charts status:', res2.status);
    console.log('Monthly trend count:', res2.data.charts.monthlyTrend.length);
    console.log('Product mix:', res2.data.charts.productData);
    console.log('Zone comparison:', res2.data.charts.zoneComparison);
    console.log('Stage funnel:', res2.data.charts.stageFunnel);
    console.log('Amount dist:', res2.data.charts.amountDist);

    const res3 = await axios.get('http://localhost:5000/api/sales/hiring-requisitions', { headers });
    console.log('3. Hiring requisitions status:', res3.status, 'Total reqs:', res3.data.requisitions?.length);
  } catch (err) {
    console.error('Verify error:', err.response?.status, err.response?.data || err.message);
  }
}

verify();
