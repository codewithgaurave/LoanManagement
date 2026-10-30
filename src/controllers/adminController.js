const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const generateToken = require('../utils/generateToken');

// @desc    Auth admin & get token
// @route   POST /api/admin/login
// @access  Public
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });

    if (admin && (await admin.matchPassword(password))) {
      res.json({
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        token: generateToken(admin._id, admin.role),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update admin permissions
// @route   PUT /api/admin/:id/permissions
// @access  Admin only
const updateAdminPermissions = async (req, res) => {
  try {
    const { permissions } = req.body;

    // Try Admin collection first
    let updated = await Admin.findById(req.params.id);
    if (updated) {
      updated.permissions = permissions;
      await updated.save();
      // Also sync to Employee collection if this admin exists there (case-insensitive)
      if (updated.email) {
        await Employee.updateMany(
          { email: new RegExp(`^${updated.email.trim()}$`, 'i') },
          { $set: { permissions } }
        );
      }
      return res.json({ message: 'Permissions updated', permissions: updated.permissions });
    }

    // Fallback: update in Employee collection (sub-admins)
    const emp = await Employee.findById(req.params.id);
    if (emp) {
      emp.permissions = permissions;
      await emp.save();
      // Also sync to Admin collection if exists (case-insensitive)
      if (emp.email) {
        await Admin.updateMany(
          { email: new RegExp(`^${emp.email.trim()}$`, 'i') },
          { $set: { permissions } }
        );
      }
      return res.json({ message: 'Permissions updated', permissions: emp.permissions });
    }

    return res.status(404).json({ message: 'Admin/Employee not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update permissions for all employees in a role
// @route   PUT /api/admin/role/:role/permissions
// @access  Admin only
const updateRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;

    const trimmed = (role || '').trim();
    const clean = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');

    let roleConditions = [{ role: new RegExp(`^${trimmed}$`, 'i') }, { designation: new RegExp(`^${trimmed}$`, 'i') }];
    if (clean === 'hrmanager' || clean === 'hr_manager' || clean.includes('manager')) {
      roleConditions.push(
        { role: /hr\s*manager/i },
        { designation: /hr\s*manager/i },
        { role: /hrmanager/i },
        { role: /hr_manager/i },
        { designation: /hr_manager/i }
      );
    } else if (clean === 'hrexecutive' || clean === 'hr_executive' || clean.includes('executive')) {
      roleConditions.push(
        { role: /hr\s*executive/i },
        { designation: /hr\s*executive/i },
        { role: /hrexecutive/i },
        { role: /hr_executive/i },
        { designation: /hr_executive/i },
        { role: /^executive$/i },
        { designation: /^executive$/i }
      );
    } else if (clean === 'hrhead' || clean === 'hr_head' || clean.includes('head')) {
      roleConditions.push(
        { role: /hr\s*head/i },
        { designation: /hr\s*head/i },
        { role: /hrhead/i },
        { role: /hr_head/i }
      );
    } else if (clean === 'hradmin' || clean === 'hr_admin' || clean === 'hr') {
      roleConditions.push(
        { role: /hr\s*admin/i },
        { designation: /hr\s*admin/i },
        { role: /hradmin/i },
        { role: /^hr$/i }
      );
    } else if (clean === 'admin' || clean === 'administrator') {
      roleConditions.push({ role: /^admin$/i }, { role: /^administrator$/i });
    } else if (clean.includes('tele')) {
      roleConditions.push({ role: /tele/i }, { designation: /tele/i });
    } else if (clean.includes('agent')) {
      roleConditions.push({ role: /agent/i }, { designation: /agent/i });
    } else if (clean.includes('operation') || clean.includes('ops')) {
      roleConditions.push({ role: /operation/i }, { role: /ops/i });
    } else if (clean.includes('account')) {
      roleConditions.push({ role: /account/i }, { designation: /account/i });
    } else if (clean.includes('credit')) {
      roleConditions.push({ role: /credit/i }, { designation: /credit/i });
    }

    const query = {
      $and: [
        { $or: roleConditions },
        { role: { $not: /super/i } }
      ]
    };
    await Admin.updateMany(query, { $set: { permissions } });
    await Employee.updateMany(query, { $set: { permissions } });

    res.json({ message: `Permissions updated for all in role ${role}`, permissions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all admins and employees (for role/permission management)
// @route   GET /api/admin/all
// @access  Admin only
const getAllAdmins = async (req, res) => {
  try {
    const adminList = await Admin.find({}).select('-password');
    const empList = await Employee.find({}).select('-password');

    const adminEmailMap = new Map();
    adminList.forEach(a => adminEmailMap.set(a.email?.toLowerCase(), a));

    const combined = [];

    // Add all Admin records
    adminList.forEach(a => {
      const matchingEmp = empList.find(e => e.email?.toLowerCase() === a.email?.toLowerCase());
      const resolvedName = a.name || matchingEmp?.name || (a.email ? a.email.split('@')[0] : 'Admin Staff');
      combined.push({
        _id: a._id,
        empId: matchingEmp?.empId || '',
        name: resolvedName,
        email: a.email,
        mobile: matchingEmp?.mobile || a.phone || '',
        role: matchingEmp?.role || a.role,
        permissions: (a.permissions && a.permissions.length > 0) ? a.permissions : (matchingEmp?.permissions || []),
        designation: matchingEmp?.designation || a.role,
        zone: matchingEmp?.zone || a.zone || 'NORTH',
        reportsToManagerId: matchingEmp?.reportsToManagerId || a.reportsToManagerId,
        reportsToHeadId: matchingEmp?.reportsToHeadId || a.reportsToHeadId,
        status: matchingEmp?.status || 'Active',
        source: 'Admin'
      });
    });

    // Add Employees not in Admin collection
    empList.forEach(e => {
      if (!adminEmailMap.has(e.email?.toLowerCase())) {
        combined.push({
          _id: e._id,
          empId: e.empId || '',
          name: e.name,
          email: e.email,
          mobile: e.mobile || '',
          role: e.role,
          permissions: e.permissions || [],
          designation: e.designation || e.role,
          zone: e.zone || 'NORTH',
          reportsToManagerId: e.reportsToManagerId,
          reportsToHeadId: e.reportsToHeadId,
          status: e.status || 'Active',
          source: 'Employee'
        });
      }
    });

    res.json(combined);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    // Try Admin collection first, fallback to Employee (for HR Admin / sub-admins)
    let user = await Admin.findById(req.admin._id).select('-password');
    if (!user) {
      user = await Employee.findById(req.admin._id).select('-password');
    }
    if (!user && req.admin.email) {
      user = await Admin.findOne({ email: req.admin.email.toLowerCase() }).select('-password') ||
             await Employee.findOne({ email: req.admin.email.toLowerCase() }).select('-password');
    }
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email, phone, location } = req.body;
    // Try Admin collection first, fallback to Employee
    let user = await Admin.findById(req.admin._id);
    if (!user) {
      user = await Employee.findById(req.admin._id);
    }

    if (user) {
      user.name = name || user.name;
      user.email = email || user.email;
      user.phone = phone || user.phone;
      user.location = location || user.location;

      const updatedUser = await user.save();
      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        location: updatedUser.location,
        avatar: updatedUser.avatar,
        role: updatedUser.role,
        permissions: updatedUser.permissions
      });
    } else {
      res.status(404).json({ message: 'Admin not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    // Try Admin collection first, fallback to Employee
    let user = await Admin.findById(req.admin._id);
    if (!user) {
      user = await Employee.findById(req.admin._id);
    }

    if (user && (await user.matchPassword(currentPassword))) {
      user.password = newPassword;
      await user.save();
      res.json({ message: 'Password updated successfully' });
    } else {
      res.status(401).json({ message: 'Invalid current password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Try Admin collection first, fallback to Employee
    let user = await Admin.findById(req.admin._id);
    if (!user) {
      user = await Employee.findById(req.admin._id);
    }
    if (!user) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const sub = req.file.categorySubdir ? `${req.file.categorySubdir}/` : 'employee/profilepic/';
    const avatarUrl = `uploads/${sub}${req.file.filename}`;
    user.avatar = avatarUrl;
    await user.save();

    res.json({ avatar: avatarUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  loginAdmin,
  getAllAdmins,
  updateAdminPermissions,
  updateRolePermissions,
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar
};
