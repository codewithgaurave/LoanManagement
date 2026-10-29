const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Comprehensive CORS handler allowing all localhost ports and origins with credentials
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-client-type, *');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from uploads folder (with recursive subdirectory fallback)
const uploadsRootDir = path.join(__dirname, '../uploads');
const fs = require('fs');

app.use('/uploads', (req, res, next) => {
  // 1. First check if exact requested path exists under uploads/
  const requestedPath = path.join(uploadsRootDir, decodeURIComponent(req.path));
  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
    return res.sendFile(requestedPath);
  }

  // 2. If it's a direct filename without subdir (e.g. /uploads/1790574170748-90227525.docx), search in category subdirectories
  const requestedFile = path.basename(req.path);
  if (requestedFile) {
    const searchInSubdirs = (dir) => {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const found = searchInSubdirs(fullPath);
            if (found) return found;
          } else if (item === requestedFile || item.includes(requestedFile) || requestedFile.includes(item)) {
            return fullPath;
          }
        }
      } catch (e) {}
      return null;
    };

    const foundPath = searchInSubdirs(uploadsRootDir);
    if (foundPath && fs.existsSync(foundPath)) {
      return res.sendFile(foundPath);
    }
  }

  next();
}, express.static(uploadsRootDir));

// Basic route for testing
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'API is running' });
});

// Routes
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/designations', require('./routes/designationRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/sales', require('./routes/salesRoutes'));
app.use('/api/leads', require('./routes/leadRoutes'));
app.use('/api/followups', require('./routes/followUpRoutes'));
app.use('/api/loans', require('./routes/loanRoutes'));
// Other routes will be mounted here
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/customers', require('./routes/userRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/recruitment', require('./routes/recruitmentRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/visits', require('./routes/visitRoutes'));
app.use('/api/location', require('./routes/locationRoutes'));

// Public Application Link Landing Page
app.use('/apply', require('./routes/applyRoutes'));
app.use('/api/apply', require('./routes/applyRoutes'));

module.exports = app;
