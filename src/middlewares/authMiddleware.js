const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const User = require('../models/User');

const protectUser = async (req, res, next) => {
  const header = req.headers.authorization || '';
  let token = header.startsWith('Bearer ') ? header.split(' ')[1] : '';

  try {
    let user = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.id) {
          user = await User.findById(decoded.id).select('-password');
        }
      } catch (tokenErr) {
        console.warn('protectUser: token verify failed:', tokenErr.message);
      }
    }

    // Fallback: match by phone / userId / leadId if token was absent or expired
    if (!user) {
      const phone = req.body?.phone || req.query?.phone || req.body?.mobile;
      const cleanPhone = phone ? String(phone).replace(/[^0-9]/g, '').slice(-10) : '';
      const userId = req.body?.userId || req.query?.userId;

      if (cleanPhone) {
        user = await User.findOne({ phone: { $regex: cleanPhone } });
      }
      if (!user && userId) {
        user = await User.findOne({ userId });
      }

      // If still not found but there is an active lead with this phone or ID, resolve / create user on-the-fly
      if (!user && cleanPhone) {
        const Lead = require('../models/Lead');
        const lead = await Lead.findOne({ mobile: { $regex: cleanPhone } }).sort({ createdAt: -1 });
        if (lead) {
          const count = await User.countDocuments();
          const newUserId = `USR-${String(count + 1).padStart(5, '0')}`;
          user = await User.create({
            userId: newUserId,
            name: lead.name || 'Valued Customer',
            email: lead.email || `${cleanPhone}@customer.nuogm.com`,
            phone: cleanPhone,
            registeredOn: new Date().toLocaleDateString('en-IN'),
            source: 'Auto-Sync Auth',
            status: 'Active'
          });
        }
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authorized, please log in as customer' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const protectAdmin = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Tokens from older employee app builds may contain empId instead of Mongo _id.
      const isObjectId = mongoose.Types.ObjectId.isValid(decoded.id);

      // Try to find in Admin collection first
      let admin = isObjectId
        ? await Admin.findById(decoded.id).select('-password')
        : await Admin.findOne({ empId: decoded.id }).select('-password');
      
      // Fallback: look in Employee collection (for sub-admins stored as employees)
      if (!admin) {
        const emp = isObjectId
          ? await Employee.findById(decoded.id).select('-password')
          : await Employee.findOne({ empId: decoded.id }).select('-password');
        if (emp) {
          // Normalize to same shape as Admin
          admin = {
            _id: emp._id,
            name: emp.name,
            email: emp.email,
            role: emp.role,
            zonalRole: emp.zonalRole || emp.role,
            designation: emp.designation,
            department: emp.department,
            zone: emp.zone || 'NORTH',
            isDepartmentHead: !!emp.isDepartmentHead,
            rrmId: emp.rrmId,
            armId: emp.armId,
            rmId: emp.rmId,
            reportsToHeadId: emp.reportsToHeadId,
            reportsToManagerId: emp.reportsToManagerId,
            permissions: emp.permissions || [],
          };
        }
      }

      if (!admin) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      req.admin = admin;
      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Factory: creates a middleware that checks if logged-in admin has specific permission
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    const roleLower = (req.admin.role || '').toLowerCase();
    const desigLower = (req.admin.designation || '').toLowerCase();
    const zonalLower = (req.admin.zonalRole || '').toLowerCase();
    const cleanRole = roleLower.replace(/[^a-z0-9]/g, '');
    const cleanDesig = desigLower.replace(/[^a-z0-9]/g, '');
    const cleanZonal = zonalLower.replace(/[^a-z0-9]/g, '');
    
    // Super Admin & Admin get full bypass automatically
    if (['super admin', 'superadmin', 'admin', 'administrator'].includes(roleLower) || ['superadmin', 'admin', 'administrator'].includes(cleanRole)) {
      return next();
    }
    
    // Sales Roles (Sales Head, RRM, ARM, RM, RO, RE, Telecaller)
    const isSales = ['sales head', 'sales_head', 'saleshead', 'rrm', 'arm', 'rm', 'ro', 're', 'sales admin', 'sales_admin', 'sales', 'relationship officer', 'relationship executive', 'reporting manager', 'regional reporting manager', 'area reporting manager'].includes(roleLower) ||
                    ['saleshead', 'rrm', 'arm', 'rm', 'ro', 're', 'salesadmin', 'sales'].includes(cleanRole) ||
                    ['saleshead', 'rrm', 'arm', 'rm', 'ro', 're', 'sales'].includes(cleanZonal) ||
                    desigLower.includes('sales') || desigLower.includes('reporting') || desigLower.includes('officer');

    if (isSales) {
      // Sales users have view-only access to leads, plus attendance and leave management for zonal hierarchy
      const salesAllowed = [
        'Lead Management', 'Assigned Leads', 'Customer Follow-ups', 'My Followups', 
        'View Dashboard', 'Reports & Analytics', 'Loan Applications', 'Loan Application', 'Approve / Reject Loans',
        'Customer Visits', 'Verify Documents', 'Document Verification',
        'Manage Employees', 'Attendance', 'Manage Attendance', 'Leave Management', 'Manage Leaves'
      ];
      if (salesAllowed.includes(permission)) return next();
    }

    // HR Head, HR Manager, HR Executive, HR Admin permissions (case insensitive)
    const isHR = ['hr admin', 'hr_admin', 'hradmin', 'hr', 'hr head', 'hr_head', 'hrhead', 'hr manager', 'hr_manager', 'hrmanager', 'hr executive', 'hr_executive', 'hrexecutive'].includes(roleLower) ||
                 ['hradmin', 'hrhead', 'hrmanager', 'hrexecutive', 'hr'].includes(cleanRole) ||
                 desigLower.includes('hr') || cleanDesig.includes('hr');

    if (isHR) {
      const hrAllowed = [
        'Manage Employees', 'Departments', 'Manage Leaves', 'Manage Payroll',
        'Manage Recruitment', 'Recruitment', 'Add Job', 'Edit Job', 'Delete Job', 'View Job',
        'Manage Attendance', 'Manage Onboarding', 'Onboarding', 'Attendance',
        'Leave Management', 'Payroll & Salary', 'View Dashboard', 'Reports & Analytics',
        'Manage Users', 'View Reports', 'Notifications', 'Announcements'
      ];
      if (hrAllowed.includes(permission)) return next();
    }
    
    // Hardcoded Telecaller & Calling permissions
    if (['telecaller', 'tele caller', 'tele callers operator', 'tele_callers_operator', 'telecallersoperator', 'sales admin', 'sales_admin'].includes(roleLower) || cleanRole.includes('tele')) {
      const teleAllowed = [
        'Lead Management', 'Status Management', 'Assigned Leads', 'Customer Follow-ups', 
        'My Followups', 'View Dashboard', 'Reports & Analytics', 'Manage Employees',
        'Attendance', 'Manage Attendance', 'Leave Management', 'Manage Leaves'
      ];
      if (teleAllowed.includes(permission)) return next();
    }

    // Hardcoded Agent permissions
    if (['agent', 'agent operator', 'agent_operator', 'agentoperator', 'field agent', 'field_agent'].includes(roleLower) || cleanRole.includes('agent')) {
      const agentAllowed = [
        'Lead Management', 'Status Management', 'Customer Visits', 'Customer Follow-ups', 
        'My Followups', 'View Dashboard', 'Reports & Analytics', 'Manage Employees',
        'Attendance', 'Manage Attendance', 'Leave Management', 'Manage Leaves'
      ];
      if (agentAllowed.includes(permission)) return next();
    }

    // Hardcoded Operations permissions
    if (['operation admin', 'operation_admin', 'operations', 'operation'].includes(roleLower) || cleanRole.includes('operation')) {
      const opsAllowed = ['Operations Portal', 'Operation Dashboard', 'Loan Applications', 'Lead Management', 'Status Management', 'Application Verification', 'Document Verification', 'Follow-Up Management', 'View Dashboard', 'Reports & Analytics'];
      if (opsAllowed.includes(permission)) return next();
    }

    // Status Management permission alias mapping
    if (permission === 'Status Management') {
      const perms = req.admin.permissions || [];
      if (perms.some(p => ['Status Management', 'Lead Management', 'Lead Status', 'Assigned Leads', 'Customer Follow-ups'].includes(p))) {
        return next();
      }
    }

    // Hardcoded Employee / Field Executive permissions
    if (['employee', 'field executive', 'executive', 'sales executive', 'relationship manager', 'loan officer', 'staff'].includes(roleLower)) {
      const empAllowed = ['Lead Management', 'Status Management', 'Customer Visits', 'Customer Follow-ups', 'My Followups', 'View Dashboard'];
      if (empAllowed.includes(permission)) return next();
    }

    const perms = req.admin.permissions || [];
    if (perms.includes(permission)) {
      return next();
    }
    return res.status(403).json({ 
      message: `Access denied. You don't have '${permission}' permission.` 
    });
  };
};

// Shorthand: Admin and Department Head role check
const adminOnly = (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const roleLower = (req.admin.role || '').toLowerCase();
  const desigLower = (req.admin.designation || '').toLowerCase();
  const cleanRole = roleLower.replace(/[^a-z0-9]/g, '');

  const isAllowed = 
    ['admin', 'super admin', 'superadmin', 'administrator'].includes(roleLower) ||
    ['admin', 'superadmin', 'administrator'].includes(cleanRole) ||
    ['hr head', 'hr admin', 'hr_head', 'hradmin', 'hr manager', 'operations head', 'credit head', 'accounts head', 'sales head'].includes(roleLower) ||
    ['hrhead', 'hradmin', 'hrmanager'].includes(cleanRole) ||
    req.admin.isDepartmentHead ||
    desigLower.includes('head') ||
    desigLower.includes('hr head') ||
    (req.admin.permissions && (req.admin.permissions.includes('Permission Management') || req.admin.permissions.includes('Role & Permission Management') || req.admin.permissions.includes('Manage Users') || req.admin.permissions.includes('Team & Staff')));

  if (isAllowed) {
    next();
  } else {
    return res.status(403).json({ message: 'Admin or Department Head access required' });
  }
};

// Resilient auth for Lead creation: accepts Admin/Employee Bearer tokens OR valid employee identifier
const protectLeadCreate = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      let admin = await Admin.findById(decoded.id).select('-password');
      if (!admin) {
        const emp = await Employee.findById(decoded.id).select('-password') ||
                    await Employee.findOne({ empId: decoded.id }).select('-password');
        if (emp) {
          admin = {
            _id: emp._id,
            empId: emp.empId,
            name: emp.name,
            email: emp.email,
            role: emp.role || 'EMPLOYEE',
            zonalRole: emp.zonalRole || emp.role,
            designation: emp.designation,
            zone: emp.zone || 'NORTH',
            permissions: emp.permissions || [],
          };
        }
      }

      if (admin) {
        req.admin = admin;
        return next();
      }
    } catch (error) {
      console.warn('Lead auth token verification error:', error.message);
    }
  }

  // Fallback: If request is from Employee App with valid employee identifier in DB
  const empIdentifier = req.body.createdById || req.body.empId;
  if (empIdentifier) {
    try {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(empIdentifier);
      const emp = await Employee.findOne({
        $or: [
          ...(isObjectId ? [{ _id: empIdentifier }] : []),
          { empId: { $regex: new RegExp(`^${empIdentifier}$`, 'i') } }
        ]
      }).select('-password');

      if (emp) {
        req.admin = {
          _id: emp._id,
          empId: emp.empId,
          name: emp.name,
          email: emp.email,
          role: emp.role || 'EMPLOYEE',
          zonalRole: emp.zonalRole || emp.role,
          designation: emp.designation,
          zone: emp.zone || 'NORTH',
          permissions: emp.permissions || [],
        };
        return next();
      }
    } catch (e) {
      console.warn('Fallback employee lookup error:', e.message);
    }
  }

  return res.status(401).json({ message: 'Not authorized, no token' });
};

module.exports = { protectAdmin, protectUser, checkPermission, adminOnly, protectLeadCreate };

