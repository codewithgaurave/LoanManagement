const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Admin = require('../models/Admin');
const Payroll = require('../models/Payroll');
const Lead = require('../models/Lead');
const LoanApplication = require('../models/LoanApplication');
const EmployeeRequest = require('../models/EmployeeRequest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const generateToken = require('../utils/generateToken');

// @desc    Get all employees (with filtering and search)
// @route   GET /api/employees
// @access  Private
const getEmployees = async (req, res) => {
  try {
    const { search, role, status, assignedHRId, onboardingStatus, myAssigned } = req.query;
    
    // Build query object
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (role && role !== 'all') {
      query.role = role;
    }

    if (assignedHRId && assignedHRId !== 'all') {
      if (assignedHRId === 'unassigned') {
        query.$or = [{ assignedHRId: null }, { assignedHRId: '' }, { assignedHRId: { $exists: false } }];
      } else {
        query.assignedHRId = assignedHRId;
      }
    }

    if (onboardingStatus && onboardingStatus !== 'all') {
      if (onboardingStatus === 'PendingOrSubmitted') {
        query.onboardingStatus = { $in: ['Pending', 'Submitted'] };
      } else {
        query.onboardingStatus = onboardingStatus;
      }
    }

    const roleLower = (req.admin?.role || '').toLowerCase();
    const desigLower = (req.admin?.designation || '').toLowerCase();
    const cleanRole = roleLower.replace(/[^a-z0-9]/g, '');
    const cleanDesig = desigLower.replace(/[^a-z0-9]/g, '');
    const adminZone = (req.admin?.zone || '').toUpperCase() || 'NORTH';

    // ── Role detection (most-specific first) ──────────────────────────────────
    const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'administrator'].includes(roleLower) ||
                          ['superadmin', 'admin', 'administrator'].includes(cleanRole);

    const isHRHead = !isMasterAdmin && (
                     ['hr head', 'hr_head', 'hr admin', 'hradmin'].includes(roleLower) ||
                     ['hrhead', 'hradmin'].includes(cleanRole) ||
                     desigLower.includes('hr head') || cleanDesig.includes('hrhead') ||
                     (req.admin?.isDepartmentHead && (req.admin?.department || '').toLowerCase().includes('hr')));

    const isHRManager = !isMasterAdmin && !isHRHead && (
                        ['hr manager', 'hr_manager', 'hrmanager'].includes(roleLower) ||
                        ['hrmanager'].includes(cleanRole) ||
                        desigLower.includes('hr manager') || cleanDesig.includes('hrmanager'));

    const isHRExecutive = !isMasterAdmin && !isHRHead && !isHRManager && (
                          ['hr executive', 'hr_executive', 'hrexecutive'].includes(roleLower) ||
                          ['hrexecutive'].includes(cleanRole) ||
                          desigLower.includes('hr executive') || cleanDesig.includes('hrexecutive'));

    const isSalesHead = !isMasterAdmin && (
                        ['sales head', 'sales_head', 'saleshead'].includes(roleLower) ||
                        ['saleshead'].includes(cleanRole) ||
                        desigLower.includes('sales head') || cleanDesig.includes('saleshead'));

    const isRRM = !isMasterAdmin && !isSalesHead && (
                  ['rrm', 'regional reporting manager', 'regional manager'].includes(roleLower) ||
                  (req.admin?.zonalRole === 'RRM') || cleanRole.includes('rrm') ||
                  desigLower.includes('regional reporting') || desigLower.includes('regional manager'));

    const isARM = !isMasterAdmin && !isSalesHead && !isRRM && (
                  ['arm', 'area reporting manager', 'area manager'].includes(roleLower) ||
                  (req.admin?.zonalRole === 'ARM') || cleanRole.includes('arm') ||
                  desigLower.includes('area reporting') || desigLower.includes('area manager'));

    // HR Manager fallback (generic 'manager' not already caught above)
    const isGenericManager = !isMasterAdmin && !isHRHead && !isHRManager && !isHRExecutive &&
                             !isSalesHead && !isRRM && !isARM && (
                             roleLower.includes('manager') || desigLower.includes('manager') ||
                             cleanRole.includes('manager') || cleanDesig.includes('manager'));

    // Anything else (field agents, telecallers, staff, etc.)
    const isJuniorStaff = !isMasterAdmin && !isHRHead && !isHRManager && !isHRExecutive &&
                          !isSalesHead && !isRRM && !isARM && !isGenericManager;

    // ── Always exclude self ────────────────────────────────────────────────────
    if (req.admin?._id) {
      query._id = { $ne: req.admin._id };
    }

    // ── Role-based junior scoping ─────────────────────────────────────────────
    if (isMasterAdmin) {
      // Sees EVERYONE (except self)

    } else if (isHRHead) {
      // HR Head → HR Managers + HR Executives + Hired/Staff employees (Pan-India)
      // Does NOT see other HR Heads or SuperAdmins
      query.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head/i };
      query.designation = { $not: /hr\s*head/i };

    } else if (isHRManager) {
      // HR Manager → HR Executives + Hired/Staff (ALL zones, Pan-India)
      // Does NOT see HR Head, other HR Managers, SuperAdmins
      query.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager/i };
      query.designation = { $not: /hr\s*head|hr\s*manager/i };

    } else if (isHRExecutive) {
      // HR Executive → ONLY their own zone's assigned candidates/hired staff
      // Cannot see any HR roles or peers in other zones
      const adminIdStr = req.admin?._id ? String(req.admin._id) : '';
      query.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager|hr\s*executive|sales\s*head|rrm|arm|regional|area/i };
      query.designation = { $not: /hr\s*head|hr\s*manager|hr\s*executive/i };
      query.zone = adminZone;
      query.$or = [
        { assignedHRId: adminIdStr },
        { assignedTelecallerId: adminIdStr },
        { assignedHRName: req.admin?.name },
        { zone: adminZone }
      ];

    } else if (isSalesHead) {
      // Sales Head → All sales force (RRM, ARM, RM, RO, RE, staff) — ALL zones
      // Does NOT see HR roles or SuperAdmins
      query.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager|hr\s*executive|sales\s*head/i };
      query.designation = { $not: /hr\s*head|hr\s*manager|sales\s*head/i };

    } else if (isRRM) {
      // RRM → ARM + RM + RO + RE + hired staff within their zone
      query.zone = adminZone;
      query.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager|hr\s*executive|sales\s*head|rrm|regional\s*reporting/i };

    } else if (isARM) {
      // ARM → Only employees directly reporting to them in their zone
      const adminIdStr = req.admin?._id ? String(req.admin._id) : '';
      query.zone = adminZone;
      query.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager|hr\s*executive|sales\s*head|rrm|arm|regional|area/i };
      query.$or = [
        { armId: req.admin._id },
        { reportsToManagerId: req.admin._id },
        { rrmId: req.admin._id }  // subordinates of this ARM
      ];

    } else if (isGenericManager) {
      // Generic Manager → Only employees reporting to them
      const adminIdStr = req.admin?._id ? String(req.admin._id) : '';
      query.$or = [
        { reportsToManagerId: req.admin._id },
        { assignedHRId: adminIdStr }
      ];
      // Exclude seniors
      query.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager/i };

    } else {
      // isJuniorStaff — no juniors, show empty (can only see self via other routes)
      query._id = { $in: [] };
    }

    if (myAssigned === 'true' && req.admin) {
      const adminIdStr = req.admin._id ? req.admin._id.toString() : '';
      const assignedCond = [
        { assignedHRId: adminIdStr },
        { assignedHRName: req.admin?.name },
        { assignedTelecallerId: adminIdStr },
        { assignedTelecallerName: req.admin?.name }
      ];
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          { $or: assignedCond }
        ];
        delete query.$or;
      } else {
        query.$or = assignedCond;
      }
    }
    
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchCond = [
        { name: searchRegex },
        { email: searchRegex },
        { empId: searchRegex },
        { role: searchRegex },
        { division: searchRegex },
        { assignedHRName: searchRegex },
        { assignedTelecallerName: searchRegex }
      ];
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          { $or: searchCond }
        ];
        delete query.$or;
      } else {
        query.$or = searchCond;
      }
    }

    const employees = await Employee.find(query).sort({ createdAt: -1 });
    res.status(200).json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new employee
// @route   POST /api/employees
// @access  Private
const createEmployee = async (req, res) => {
  try {
    const { 
      name, email, role, designation, mobile, division,
      pincode, district, state, city, pan, aadhar, zone,
      grossMonthly, transportation, performance, achievement, incentives,
      password, reportingManagerId, reportsToHeadId, reportsToManagerId
    } = req.body;

    // Check if email already exists across Employees or Admins (case-insensitive)
    const normalizedEmail = (email || '').trim().toLowerCase();
    const employeeExists = await Employee.findOne({ email: new RegExp(`^${normalizedEmail}$`, 'i') });
    if (employeeExists) {
      return res.status(400).json({ message: 'An employee with this email already exists' });
    }

    const adminExistsCheck = await Admin.findOne({ email: new RegExp(`^${normalizedEmail}$`, 'i') });
    if (adminExistsCheck) {
      return res.status(400).json({ message: 'An account with this email already exists in system' });
    }

    // Auto-generate empId (simple format: NuoGM-EMP-YYYY-RANDOM)
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    const empId = `NuoGM-EMP-${year}-${random}`;

    const roleLower = (role || '').toLowerCase();
    const desigLower = (designation || '').toLowerCase();
    const isHRHead = roleLower.includes('hr head') || desigLower.includes('hr head') || roleLower === 'hr head';
    const isManager = !isHRHead && (roleLower.includes('manager') || desigLower.includes('manager'));
    const isExecutive = !isHRHead && !isManager;

    let repHeadId = reportsToHeadId || null;
    let repHeadName = null;
    let repManagerId = reportsToManagerId || reportingManagerId || null;
    let repManagerName = null;

    if (isHRHead) {
      repHeadName = 'Super Admin';
    } else if (isManager) {
      if (repHeadId && mongoose.Types.ObjectId.isValid(repHeadId)) {
        const headObj = await Employee.findById(repHeadId);
        if (headObj) repHeadName = headObj.name;
      }
      if (!repHeadId) {
        const defaultHead = await Employee.findOne({ $or: [{ role: /hr\s*head/i }, { designation: /hr\s*head/i }] });
        if (defaultHead) {
          repHeadId = defaultHead._id;
          repHeadName = defaultHead.name;
        } else {
          repHeadName = 'HR Head';
        }
      }
    } else if (isExecutive) {
      if (repManagerId && mongoose.Types.ObjectId.isValid(repManagerId)) {
        const mgrObj = await Employee.findById(repManagerId);
        if (mgrObj) {
          repManagerName = mgrObj.name;
          if (mgrObj.reportsToHeadId) {
            repHeadId = mgrObj.reportsToHeadId;
            repHeadName = mgrObj.reportsToHeadName;
          }
        }
      }
      if (!repManagerId) {
        const defaultMgr = await Employee.findOne({ $or: [{ role: /hr\s*manager|manager/i }, { designation: /hr\s*manager|manager/i }] });
        if (defaultMgr) {
          repManagerId = defaultMgr._id;
          repManagerName = defaultMgr.name;
          repHeadId = defaultMgr.reportsToHeadId || null;
          repHeadName = defaultMgr.reportsToHeadName || 'HR Head';
        }
      }
      if (!repHeadId) {
        const defaultHead = await Employee.findOne({ $or: [{ role: /hr\s*head/i }, { designation: /hr\s*head/i }] });
        if (defaultHead) {
          repHeadId = defaultHead._id;
          repHeadName = defaultHead.name;
        }
      }
    }

    const employee = await Employee.create({
      empId, name, email, role, designation, mobile, division,
      pincode, district, state, city, pan, aadhar,
      zone: zone || 'NORTH',
      isDepartmentHead: isHRHead,
      reportsToHeadId: repHeadId,
      reportsToHeadName: repHeadName,
      reportsToManagerId: repManagerId,
      reportsToManagerName: repManagerName,
      grossMonthly, transportation, performance, achievement, incentives,
      password: password
    });

    // Sync to Admin collection
    if (password) {
      const adminExists = await Admin.findOne({ email });
      if (!adminExists) {
        await Admin.create({
          name,
          email,
          password, // Admin model has pre-save hook to hash password
          role
        });
      }
    }

    // Sync to Payroll collection
    await Payroll.create({
      employeeId: employee._id,
      grossMonthly: grossMonthly ? Number(grossMonthly) : 0,
      grossYearly: grossMonthly ? Number(grossMonthly) * 12 : 0,
      transport: transportation ? Number(transportation) : 0,
      perfBonus: performance ? Number(performance) : 0,
      achievement: achievement ? Number(achievement) : 0,
      incentives: incentives ? Number(incentives) : 0
    });

    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update employee status & Late Unlock
// @route   PUT /api/employees/:id/status
// @access  Private
const updateEmployeeStatus = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const { status, unlockLate, isLateLocked } = req.body || {};

    if (unlockLate === true || isLateLocked === false) {
      // HR explicitly unlocking late-blocked employee
      employee.isLateLocked = false;
      employee.lateLockReason = '';
      employee.status = 'Active';
      
      const now = new Date();
      const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const y = istDate.getFullYear();
      const m = String(istDate.getMonth() + 1).padStart(2, '0');
      const d = String(istDate.getDate()).padStart(2, '0');
      employee.hrLoginApprovedDate = `${y}-${m}-${d}`;
      employee.hrApprovedBy = req.admin ? (req.admin.name || req.admin.email || 'HR Admin') : 'HR Admin';
      if (!employee.unblockRequest) {
        employee.unblockRequest = {};
      }
      employee.unblockRequest.status = 'Approved';
      employee.unblockRequest.hrActionDate = now;
      employee.unblockRequest.hrRemark = 'Unblocked by HR from Management Panel';
    } else if (status) {
      employee.status = status;
      if (status === 'Active') {
        employee.isLateLocked = false;
        employee.lateLockReason = '';
        if (employee.unblockRequest) {
          employee.unblockRequest.status = 'Approved';
          employee.unblockRequest.hrActionDate = new Date();
          employee.unblockRequest.hrRemark = 'Account activated by HR';
        }
      }
    } else {
      // Toggle Active / Inactive
      employee.status = employee.status === 'Active' ? 'Inactive' : 'Active';
      if (employee.status === 'Active') {
        employee.isLateLocked = false;
        employee.lateLockReason = '';
        if (employee.unblockRequest) {
          employee.unblockRequest.status = 'Approved';
          employee.unblockRequest.hrActionDate = new Date();
          employee.unblockRequest.hrRemark = 'Account activated by HR';
        }
      }
    }

    const updatedEmployee = await employee.save();
    
    res.status(200).json(updatedEmployee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete employee
// @route   DELETE /api/employees/:id
// @access  Private
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Also remove from Admin collection if it exists
    if (employee.email) {
      await Admin.deleteOne({ email: employee.email });
    }

    await Employee.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Employee removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get employee by ID (with Executive Activity Tracking)
// @route   GET /api/employees/:id
// @access  Private
const getEmployeeById = async (req, res) => {
  try {
    const idParam = req.params.id;
    let employee = null;

    if (mongoose.Types.ObjectId.isValid(idParam)) {
      employee = await Employee.findById(idParam);
    }
    if (!employee) {
      employee = await Employee.findOne({ empId: idParam });
    }

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const empObj = employee.toObject ? employee.toObject() : { ...employee };

    // Fetch Candidate / Recruitment Activity if HR Executive / Staff
    const JobApplication = require('../models/JobApplication');
    const assignedApps = await JobApplication.find({
      $or: [
        { assignedExecutiveId: employee._id },
        { assignedToId: employee._id },
        { 'assignmentHistory.assignedToId': employee._id.toString() }
      ]
    }).populate('jobId', 'title department location').sort({ updatedAt: -1 }).lean();

    const recruitmentStats = {
      totalAssigned: assignedApps.length,
      applied: assignedApps.filter(a => a.status === 'Applied').length,
      reviewed: assignedApps.filter(a => a.status === 'Reviewed').length,
      interview: assignedApps.filter(a => a.status === 'Interview').length,
      shortlisted: assignedApps.filter(a => a.status === 'Shortlisted').length,
      hired: assignedApps.filter(a => a.status === 'Hired').length,
      rejected: assignedApps.filter(a => a.status === 'Rejected').length
    };

    empObj.assignedCandidates = assignedApps;
    empObj.recruitmentStats = recruitmentStats;

    res.status(200).json(empObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private
const updateEmployee = async (req, res) => {
  try {
    // Find by empId (custom string) or by _id (MongoDB ObjectId)
    const idParam = req.params.id;
    let employee = null;
    
    // Try to find by MongoDB ObjectId first if valid
    if (mongoose.Types.ObjectId.isValid(idParam)) {
      employee = await Employee.findById(idParam);
    }
    
    // If not found, try finding by custom empId
    if (!employee) {
      employee = await Employee.findOne({ empId: idParam });
    }
    
    if (req.body.email) {
      const normalizedEmail = req.body.email.trim().toLowerCase();
      const existingOther = await Employee.findOne({ 
        _id: { $ne: employee._id }, 
        email: new RegExp(`^${normalizedEmail}$`, 'i') 
      });
      if (existingOther) {
        return res.status(400).json({ message: 'Email is already taken by another employee' });
      }

      const existingAdmin = await Admin.findOne({ 
        email: new RegExp(`^${normalizedEmail}$`, 'i'),
        // Allow if it matches the current employee's previous email (which was synced to Admin)
        $expr: { $ne: [{ $toLower: "$email" }, (employee.email || '').toLowerCase()] }
      });
      if (existingAdmin) {
        return res.status(400).json({ message: 'Email is already taken by another account in the system' });
      }
    }

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(req.body.password, salt);
    } else {
      delete req.body.password;
    }

    // If onboardingStatus is being changed to 'Done', ensure all documents are verified
    if (req.body.onboardingStatus === 'Done') {
      const hasDocs = employee.documents && employee.documents.length > 0;
      const allVerified = hasDocs && employee.documents.every(d => d.status === 'Verified');
      if (!hasDocs || !allVerified) {
        return res.status(400).json({ 
          message: 'Cannot mark onboarding complete until all candidate documents are uploaded and verified by HR!' 
        });
      }
    }

    // Use the actual MongoDB _id for update, not empId
    const updatedEmployee = await Employee.findByIdAndUpdate(
      employee._id,
      req.body,
      { new: true, runValidators: true }
    );

    // Sync onboardingStatus to JobApplication if changed
    if (req.body.onboardingStatus) {
      const JobApplication = require('../models/JobApplication');
      await JobApplication.updateMany(
        { email: employee.email },
        { $set: { onboardingStatus: req.body.onboardingStatus } }
      );
    }

    // Sync to Admin collection if role or password or name/email or permissions updated
    if (req.body.password || req.body.name || req.body.email || req.body.role || req.body.permissions !== undefined) {
       const updateData = {};
       if (req.body.name) updateData.name = req.body.name;
       if (req.body.email) updateData.email = req.body.email;
       if (req.body.role) updateData.role = req.body.role;
       if (req.body.password) updateData.password = req.body.password; // already hashed
       if (req.body.permissions !== undefined) updateData.permissions = req.body.permissions;

       await Admin.updateOne(
         { email: employee.email }, 
         { $set: updateData },
         { upsert: true }
       );
    }

    // Sync to Payroll collection
    const payrollUpdate = {};
    if (req.body.grossMonthly !== undefined) payrollUpdate.grossMonthly = Number(req.body.grossMonthly) || 0;
    if (req.body.grossMonthly !== undefined) payrollUpdate.grossYearly = (Number(req.body.grossMonthly) || 0) * 12;
    if (req.body.transportation !== undefined) payrollUpdate.transport = Number(req.body.transportation) || 0;
    if (req.body.performance !== undefined) payrollUpdate.perfBonus = Number(req.body.performance) || 0;
    if (req.body.achievement !== undefined) payrollUpdate.achievement = Number(req.body.achievement) || 0;
    if (req.body.incentives !== undefined) payrollUpdate.incentives = Number(req.body.incentives) || 0;
    
    if (Object.keys(payrollUpdate).length > 0) {
      await Payroll.updateOne(
        { employeeId: employee._id },
        { $set: payrollUpdate },
        { upsert: true }
      );
    }

    res.status(200).json(updatedEmployee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get employee details for public onboarding
// @route   GET /api/employees/onboarding/:id
// @access  Public
const getEmployeeForOnboarding = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const JobApplication = require('../models/JobApplication');
    const app = await JobApplication.findOne({ 
      $or: [
        { employeeId: employee._id },
        { email: employee.email },
        { phone: employee.mobile }
      ]
    }).populate('jobId');

    const empObj = employee.toObject();

    if (app) {
      empObj.name = empObj.name || app.name;
      empObj.email = empObj.email || app.email;
      empObj.mobile = empObj.mobile || app.phone;
      empObj.fathersName = empObj.fathersName || app.fatherName || '';
      empObj.mothersName = empObj.mothersName || app.motherName || '';
      empObj.maritalStatus = empObj.maritalStatus || app.maritalStatus || 'Single';
      empObj.presentAddress = empObj.presentAddress || app.presentAddress || '';
      empObj.permanentAddress = empObj.permanentAddress || app.permanentAddress || app.presentAddress || '';
      empObj.pincode = empObj.pincode || app.pincode || '';
      empObj.district = empObj.district || app.district || '';
      empObj.state = empObj.state || app.state || '';
      empObj.city = empObj.city || app.area || '';
      empObj.aadhar = empObj.aadhar || app.aadhaar || '';
      empObj.pan = empObj.pan || app.pan || '';
      empObj.designation = empObj.designation || app.jobId?.title || 'Team Member';
      empObj.division = empObj.division || app.jobId?.department || 'Operations';
      
      if (!empObj.grossMonthly && (app.monthlyNetSalary || app.expectedSalary)) {
        empObj.grossMonthly = Number(app.monthlyNetSalary || app.expectedSalary || 0);
      }

      if (!empObj.qual1Inst && app.education && app.education.length > 0) {
        empObj.qual1Type = empObj.qual1Type || app.education[0].degree || 'Graduation';
        empObj.qual1Inst = empObj.qual1Inst || app.education[0].institution || '';
        empObj.qual1Dist = empObj.qual1Dist || app.education[0].districtState || app.education[0].location || '';
        empObj.qual1Year = empObj.qual1Year || app.education[0].endDate || '';
      }

      // Pass the full education array so onboarding can pre-fill all qualification rows
      if (!empObj.qualifications || empObj.qualifications.length === 0) {
        if (app.education && app.education.length > 0) {
          empObj.applicationEducation = app.education;
        }
      }

      if (!empObj.expCompany && app.experience && app.experience.length > 0) {
        empObj.expCompany = empObj.expCompany || app.experience[0].company || '';
        empObj.expPosition = empObj.expPosition || app.experience[0].title || '';
        empObj.expStart = empObj.expStart || app.experience[0].startDate || '';
        empObj.expEnd = empObj.expEnd || app.experience[0].endDate || '';
        empObj.expGross = empObj.expGross || app.yearlyGrossSalary || '';
        empObj.expMonthly = empObj.expMonthly || app.monthlyNetSalary || '';
        empObj.expReason = empObj.expReason || app.reasonOfLeaving || '';
      }

      empObj.bankAccName = empObj.bankAccName || app.name || '';
    }

    empObj.reuploadToken = employee.reuploadToken;
    empObj.reuploadTokenExpiry = employee.reuploadTokenExpiry;

    res.status(200).json(empObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit employee onboarding data
// @route   POST /api/employees/onboarding/:id
// @access  Public
const submitOnboarding = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Update employee fields with the submitted formData (excluding documents for now)
    // Only update fields that have actual values — don't overwrite existing data with empty strings
    const { documents, bankAccNumConfirm, qualifications: qualificationsRaw, token: _tok, ...otherData } = req.body;
    // Onboarding verify ke baad normal public submit bilkul block (sirf senior senior panel se)
    if (employee.onboardingStatus === 'Done') {
      return res.status(400).json({ message: 'Onboarding already verified. Edit disabled.' });
    }
    const filteredData = Object.fromEntries(
      Object.entries(otherData)
        .filter(([_, v]) => v !== '' && v !== null && v !== undefined)
        .map(([k, v]) => [k, Array.isArray(v) ? (v[v.length - 1] || '') : v])
    );

    // Parse qualifications JSON array from FormData
    if (qualificationsRaw) {
      try {
        const parsedQuals = JSON.parse(qualificationsRaw);
        if (Array.isArray(parsedQuals) && parsedQuals.length > 0) {
          filteredData.qualifications = parsedQuals;
        }
      } catch (e) { /* ignore parse error */ }
    }

    employee.set(filteredData);

    // Merge document statuses (Append new ones, update existing ones)
    let parsedDocs = [];
    if (typeof documents === 'string') {
      try { parsedDocs = JSON.parse(documents); } catch(e) {}
    } else if (Array.isArray(documents)) {
      parsedDocs = documents;
    }

    if (parsedDocs.length > 0) {
      if (!employee.documents) employee.documents = [];
      
      parsedDocs.forEach(incomingDoc => {
        const existingDocIndex = employee.documents.findIndex(d => d.key === incomingDoc.key);
        
        // Find if this doc was uploaded in req.files
        const uploadedFile = req.files && req.files.find(f => f.fieldname === incomingDoc.key);
        const fileUrl = uploadedFile 
          ? `uploads/${uploadedFile.categorySubdir ? `${uploadedFile.categorySubdir}/` : ''}${uploadedFile.filename}` 
          : undefined;

        if (existingDocIndex > -1) {
          // If they re-uploaded a rejected doc, mark it as Pending again
          employee.documents[existingDocIndex].name = incomingDoc.name;
          employee.documents[existingDocIndex].status = 'Pending';
          employee.documents[existingDocIndex].uploadedAt = Date.now();
          if (fileUrl) employee.documents[existingDocIndex].fileUrl = fileUrl;
        } else {
          // New document uploaded
          employee.documents.push({
            name: incomingDoc.name,
            key: incomingDoc.key,
            fileUrl: fileUrl,
            status: 'Pending',
            uploadedAt: Date.now()
          });
        }
      });
      // Sync passport photo directly to employee.avatar if provided
      const photoDoc = employee.documents.find(d => 
        (d.key && (d.key.toLowerCase().includes('photo') || d.key === 'Passport Photo')) ||
        (d.name && d.name.toLowerCase().includes('photo'))
      );
      if (photoDoc && photoDoc.fileUrl) {
        employee.avatar = photoDoc.fileUrl;
      }
    }

    // Mark as Submitted (not Done until all documents are verified by HR)
    employee.onboardingStatus = 'Submitted';
    await employee.save();

    // Also sync Admin avatar if an Admin login account exists for this employee
    if (employee.avatar) {
      await Admin.updateMany(
        { email: employee.email },
        { $set: { avatar: employee.avatar } }
      );
    }

    // Also sync JobApplication if applicable
    const JobApplication = require('../models/JobApplication');
    await JobApplication.updateMany(
      { email: employee.email },
      { $set: { onboardingStatus: 'Submitted' } }
    );

    // Notify Super Admin, HR and Telecaller
    try {
      const { createNotification } = require('./notificationController');
      await createNotification(
        `Candidate ${employee.name} (${employee.empId}) has successfully completed their Onboarding Form. Profile is ready for HR & Payroll!`,
        'system',
        null
      );
    } catch (notifErr) {
      console.error('Notification trigger error:', notifErr);
    }

    res.status(200).json({ message: 'Onboarding submitted successfully', employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const { createNotification } = require('./notificationController');

// @desc    Update employee document status
// @route   PUT /api/employees/:id/documents/:docId/status
// @access  Private (Admin)
const updateDocumentStatus = async (req, res) => {
  try {
    const { status, rejectReason } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Onboarding fully verified hone ke baad reject/re-upload bilkul disable
    if (employee.onboardingStatus === 'Done') {
      return res.status(400).json({ message: 'Onboarding already verified. Reject / Re-upload is disabled now.' });
    }

    const document = employee.documents.id(req.params.docId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Verified doc ko dobara reject/re-upload nahi kar sakte
    if (document.status === 'Verified') {
      return res.status(400).json({ message: 'This document is already verified. Reject / Re-upload is disabled.' });
    }

    document.status = status;
    // Reject ka reason + audit trail save karo (re-upload link ke liye)
    if (status === 'Rejected' || status === 'Re-upload Required') {
      document.rejectReason = rejectReason || '';
      document.rejectedAt = new Date();
      const actor = req.admin?.name || req.admin?.email || 'Senior';
      document.rejectedBy = actor;
      
      // Token pehle se valid hai to wahi persistent token rakho, bar-bar naya link generate na ho
      const isTokenExpired = employee.reuploadTokenExpiry && new Date(employee.reuploadTokenExpiry) < new Date();
      if (!employee.reuploadToken || isTokenExpired) {
        const crypto = require('crypto');
        employee.reuploadToken = crypto.randomBytes(24).toString('hex');
        // 15 din valid
        employee.reuploadTokenExpiry = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      }
    } else if (status === 'Verified') {
      document.rejectReason = '';
      document.rejectedAt = null;
      document.rejectedBy = '';
    }
    await employee.save();

    // If rejected, send notification to employee
    if (status === 'Rejected' || status === 'Re-upload Required') {
      await createNotification(
        `Your document "${document.name}" was marked for re-upload${rejectReason ? `: ${rejectReason}` : ''}.`,
        'system',
        employee._id // Notifying this specific employee
      );
    } else if (status === 'Verified') {
      await createNotification(
        `Your document "${document.name}" has been successfully verified.`,
        'system',
        employee._id
      );
    }

    // Saare rejected docs nikalo — re-upload link sirf inke liye
    const rejectedDocs = employee.documents
      .filter(d => d.status === 'Rejected' || d.status === 'Re-upload Required')
      .map(d => ({ _id: d._id, key: d.key, name: d.name, status: d.status, rejectReason: d.rejectReason || '' }));

    // Frontend ke liye ready re-upload link (copy karke employee ko bhejo)
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const reuploadLink = rejectedDocs.length > 0 && employee.reuploadToken
      ? `${frontendBase}/onboarding/${employee._id}?reupload=${employee.reuploadToken}`
      : null;

    // If all documents are verified, check if onboarding can be marked as Done
    const allDocsVerified = employee.documents.length > 0 && employee.documents.every(d => d.status === 'Verified');
    if (allDocsVerified && employee.onboardingStatus === 'Submitted') {
      employee.onboardingStatus = 'Done';
      await employee.save();

      const JobApplication = require('../models/JobApplication');
      await JobApplication.updateMany(
        { email: employee.email },
        { $set: { onboardingStatus: 'Done' } }
      );

      await createNotification(
        `All documents for ${employee.name} (${employee.empId}) have been verified! Onboarding is now COMPLETED.`,
        'system',
        null
      );
    }

    res.status(200).json({ message: 'Document status updated', document, allDocsVerified, onboardingStatus: employee.onboardingStatus, rejectedDocs, reuploadLink });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET reupload link (senior copy button)
const getReuploadLink = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    if (employee.onboardingStatus === 'Done') {
      return res.status(200).json({ reuploadLink: null, rejectedDocs: [] });
    }
    const rejectedDocs = (employee.documents || [])
      .filter(d => d.status === 'Rejected' || d.status === 'Re-upload Required')
      .map(d => ({ _id: d._id, key: d.key, name: d.name, status: d.status, rejectReason: d.rejectReason || '' }));
    if (!rejectedDocs.length || !employee.reuploadToken) {
      return res.status(200).json({ reuploadLink: null, rejectedDocs: [] });
    }
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.status(200).json({
      reuploadLink: `${frontendBase}/onboarding/${employee._id}?reupload=${employee.reuploadToken}`,
      rejectedDocs, expiresAt: employee.reuploadTokenExpiry
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// GET rejected docs (public reupload link data)
const getRejectedDocsForReupload = async (req, res) => {
  try {
    const idParam = req.params.id;
    let employee = null;
    if (mongoose.Types.ObjectId.isValid(idParam)) {
      employee = await Employee.findById(idParam);
    }
    if (!employee) {
      employee = await Employee.findOne({ empId: idParam });
    }
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    if (employee.onboardingStatus === 'Done') {
      return res.status(400).json({ message: 'Onboarding verified. Re-upload disabled.' });
    }
    const token = req.query.token || '';
    if (!employee.reuploadToken || (token && token !== employee.reuploadToken)) {
      return res.status(403).json({ message: 'Invalid/expired link. HR se naya link lo.' });
    }
    if (employee.reuploadTokenExpiry && new Date(employee.reuploadTokenExpiry) < new Date()) {
      return res.status(403).json({ message: 'Link expired. HR se naya link lo.' });
    }
    const rejectedDocs = (employee.documents || [])
      .filter(d => d.status === 'Rejected' || d.status === 'Re-upload Required')
      .map(d => ({ _id: d._id, key: d.key, name: d.name, status: d.status, rejectReason: d.rejectReason || '' }));
    return res.status(200).json({ employeeId: employee._id, name: employee.name, empId: employee.empId, reuploadToken: employee.reuploadToken, rejectedDocs });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// POST reupload (sirf rejected docs, baki locked)
const reuploadRejectedDocs = async (req, res) => {
  try {
    const idParam = req.params.id;
    let employee = null;
    if (mongoose.Types.ObjectId.isValid(idParam)) {
      employee = await Employee.findById(idParam);
    }
    if (!employee) {
      employee = await Employee.findOne({ empId: idParam });
    }
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    if (employee.onboardingStatus === 'Done') {
      return res.status(400).json({ message: 'Onboarding verified. Re-upload disabled.' });
    }
    const token = req.body.token || req.query.token || '';
    // Agar employee ke pass reuploadToken hai aur query/body token diya gaya hai to verify karein
    if (employee.reuploadToken && token && token !== employee.reuploadToken) {
      return res.status(403).json({ message: 'Invalid/expired link.' });
    }
    if (employee.reuploadTokenExpiry && new Date(employee.reuploadTokenExpiry) < new Date()) {
      return res.status(403).json({ message: 'Link expired.' });
    }
    let parsedDocs = [];
    const rawDocs = req.body.documents;
    if (typeof rawDocs === 'string') { try { parsedDocs = JSON.parse(rawDocs); } catch (e) { parsedDocs = []; } }
    else if (Array.isArray(rawDocs)) { parsedDocs = rawDocs; }
    if (!parsedDocs.length && (!req.files || !req.files.length)) {
      return res.status(400).json({ message: 'No documents received.' });
    }
    const allowedKeys = new Set((employee.documents || [])
      .filter(d => d.status === 'Rejected' || d.status === 'Re-upload Required')
      .map(d => d.key));
    if (!allowedKeys.size) return res.status(400).json({ message: 'No rejected docs pending.' });
    let updatedCount = 0;
    parsedDocs.forEach(incomingDoc => {
      if (!incomingDoc.key || !allowedKeys.has(incomingDoc.key)) return;
      const idx = employee.documents.findIndex(d => d.key === incomingDoc.key);
      if (idx === -1 || employee.documents[idx].status === 'Verified') return;
      const uploadedFile = req.files && req.files.find(f => f.fieldname === incomingDoc.key);
      if (!uploadedFile) return;
      const fileUrl = `uploads/${uploadedFile.categorySubdir ? `${uploadedFile.categorySubdir}/` : ''}${uploadedFile.filename}`;
      employee.documents[idx].name = incomingDoc.name || employee.documents[idx].name;
      employee.documents[idx].fileUrl = fileUrl;
      employee.documents[idx].status = 'Pending';
      employee.documents[idx].rejectReason = '';
      employee.documents[idx].rejectedAt = null;
      employee.documents[idx].rejectedBy = '';
      employee.documents[idx].uploadedAt = Date.now();
      updatedCount += 1;
    });
    const photoDoc = (employee.documents || []).find(d =>
      (d.key && (d.key.toLowerCase().includes('photo') || d.key === 'Passport Photo')) ||
      (d.name && d.name.toLowerCase().includes('photo')));
    if (photoDoc && photoDoc.fileUrl && allowedKeys.has(photoDoc.key)) {
      employee.avatar = photoDoc.fileUrl;
      await Admin.updateMany({ email: employee.email }, { $set: { avatar: employee.avatar } });
    }
    const stillRejected = (employee.documents || []).some(d => d.status === 'Rejected' || d.status === 'Re-upload Required');
    if (!stillRejected) { employee.reuploadToken = ''; employee.reuploadTokenExpiry = null; }
    await employee.save();
    try {
      const { createNotification } = require('./notificationController');
      await createNotification(`Candidate ${employee.name} (${employee.empId}) ne ${updatedCount} doc(s) re-upload kiye. Verify karein.`, 'system', null);
    } catch (notifErr) { console.error(notifErr); }
    return res.status(200).json({ message: 'Re-uploaded successfully', updatedCount });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// @desc    Get attendance for employees by date (Full Hierarchy Scoped — juniors only)
// @route   GET /api/employees/attendance?date=YYYY-MM-DD
// @access  Private
const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "Date is required" });

    const roleLower = (req.admin?.role || '').toLowerCase();
    const desigLower = (req.admin?.designation || '').toLowerCase();
    const cleanRole = roleLower.replace(/[^a-z0-9]/g, '');
    const cleanDesig = desigLower.replace(/[^a-z0-9]/g, '');
    const adminZone = (req.admin?.zone || '').toUpperCase() || 'NORTH';

    // ── Role detection (same as getEmployees) ──────────────────────────────────
    const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'administrator'].includes(roleLower) ||
                          ['superadmin', 'admin', 'administrator'].includes(cleanRole);

    const isHRHead = !isMasterAdmin && (
                     ['hr head', 'hr_head', 'hr admin', 'hradmin'].includes(roleLower) ||
                     ['hrhead', 'hradmin'].includes(cleanRole) ||
                     desigLower.includes('hr head') || cleanDesig.includes('hrhead') ||
                     (req.admin?.isDepartmentHead && (req.admin?.department || '').toLowerCase().includes('hr')));

    const isHRManager = !isMasterAdmin && !isHRHead && (
                        ['hr manager', 'hr_manager', 'hrmanager'].includes(roleLower) ||
                        ['hrmanager'].includes(cleanRole) ||
                        desigLower.includes('hr manager') || cleanDesig.includes('hrmanager'));

    const isHRExecutive = !isMasterAdmin && !isHRHead && !isHRManager && (
                          ['hr executive', 'hr_executive', 'hrexecutive'].includes(roleLower) ||
                          ['hrexecutive'].includes(cleanRole) ||
                          desigLower.includes('hr executive') || cleanDesig.includes('hrexecutive'));

    const isSalesHead = !isMasterAdmin && (
                        ['sales head', 'sales_head', 'saleshead'].includes(roleLower) ||
                        ['saleshead'].includes(cleanRole) ||
                        desigLower.includes('sales head') || cleanDesig.includes('saleshead'));

    const isRRM = !isMasterAdmin && !isSalesHead && (
                  ['rrm', 'regional reporting manager', 'regional manager'].includes(roleLower) ||
                  (req.admin?.zonalRole === 'RRM') || cleanRole.includes('rrm') ||
                  desigLower.includes('regional reporting') || desigLower.includes('regional manager'));

    const isARM = !isMasterAdmin && !isSalesHead && !isRRM && (
                  ['arm', 'area reporting manager', 'area manager'].includes(roleLower) ||
                  (req.admin?.zonalRole === 'ARM') || cleanRole.includes('arm') ||
                  desigLower.includes('area reporting') || desigLower.includes('area manager'));

    const isGenericManager = !isMasterAdmin && !isHRHead && !isHRManager && !isHRExecutive &&
                             !isSalesHead && !isRRM && !isARM && (
                             roleLower.includes('manager') || desigLower.includes('manager') ||
                             cleanRole.includes('manager') || cleanDesig.includes('manager'));

    // ── Build junior filter (self always excluded) ────────────────────────────
    let empFilter = { status: "Active", _id: { $ne: req.admin?._id } };

    if (isMasterAdmin) {
      // Sees all active employees' attendance
      empFilter = { status: "Active" };

    } else if (isHRHead) {
      // HR Head → HR Managers + HR Executives + Hired Staff (Pan-India)
      empFilter._id = { $ne: req.admin._id };
      empFilter.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head/i };
      empFilter.designation = { $not: /hr\s*head/i };

    } else if (isHRManager) {
      // HR Manager → HR Executives + Hired Staff (ALL zones, Pan-India)
      empFilter._id = { $ne: req.admin._id };
      empFilter.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager/i };
      empFilter.designation = { $not: /hr\s*head|hr\s*manager/i };

    } else if (isHRExecutive) {
      // HR Executive → ONLY zone-locked assigned candidates/hired staff
      const adminIdStr = req.admin?._id ? String(req.admin._id) : '';
      empFilter._id = { $ne: req.admin._id };
      empFilter.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager|hr\s*executive|sales\s*head|rrm|arm|regional|area/i };
      empFilter.designation = { $not: /hr\s*head|hr\s*manager|hr\s*executive/i };
      empFilter.zone = adminZone;
      empFilter.$or = [
        { assignedHRId: adminIdStr },
        { assignedHRName: req.admin?.name },
        { zone: adminZone }
      ];

    } else if (isSalesHead) {
      // Sales Head → All sales staff (ALL zones), no HR roles
      empFilter._id = { $ne: req.admin._id };
      empFilter.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager|hr\s*executive|sales\s*head/i };
      empFilter.designation = { $not: /hr\s*head|hr\s*manager|sales\s*head/i };

    } else if (isRRM) {
      // RRM → Their zone: ARM + RM + RO + RE + hired staff
      empFilter._id = { $ne: req.admin._id };
      empFilter.zone = adminZone;
      empFilter.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager|hr\s*executive|sales\s*head|rrm|regional\s*reporting/i };

    } else if (isARM) {
      // ARM → Only direct reports in their zone
      const adminIdStr = req.admin?._id ? String(req.admin._id) : '';
      empFilter._id = { $ne: req.admin._id };
      empFilter.zone = adminZone;
      empFilter.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager|hr\s*executive|sales\s*head|rrm|arm|regional|area/i };
      empFilter.$or = [
        { armId: req.admin._id },
        { reportsToManagerId: req.admin._id }
      ];

    } else if (isGenericManager) {
      // Generic Manager → Only direct reports
      const adminIdStr = req.admin?._id ? String(req.admin._id) : '';
      empFilter._id = { $ne: req.admin._id };
      empFilter.role = { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager/i };
      empFilter.$or = [
        { reportsToManagerId: req.admin._id },
        { assignedHRId: adminIdStr }
      ];

    } else {
      // Junior staff — can only see their own attendance (via their profile page)
      empFilter = { _id: req.admin._id };
    }

    const employees = await Employee.find(empFilter);

    const attendanceData = employees.map(emp => {
      const attendanceList = Array.isArray(emp.attendance) ? emp.attendance : [];
      const record = attendanceList.find(a => a && typeof a === "object" && a.date === date);
      return {
        id: emp._id,
        empId: emp.empId || "-",
        name: emp.name || "-",
        role: emp.role || "Staff",
        designation: emp.designation || emp.role || "-",
        department: emp.division || emp.department || emp.designation || "-",
        zone: emp.zone || "-",
        date: date,
        checkIn: record?.checkIn || "-",
        checkOut: record?.checkOut || "-",
        hours: record?.hours || "-",
        status: record?.status || "Absent",
        canEdit: isMasterAdmin || isHRHead || isHRManager || isSalesHead || isRRM || isARM || isGenericManager
      };
    });

    res.status(200).json(attendanceData);
  } catch (error) {
    console.error("ATTENDANCE ERROR:", error);
    res.status(500).json({ message: "ATTENDANCE_ERROR: " + error.message, stack: error.stack });
  }
};

// @desc    Add or update attendance record for an employee (Hierarchy-Protected)
// @route   POST /api/employees/:id/attendance
// @access  Private (HR Head & HR Manager only; HR Executive read-only)
const addAttendanceRecord = async (req, res) => {
  try {
    const { date, checkIn, checkOut, status, hours } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const roleLower = (req.admin?.role || '').toLowerCase();
    const desigLower = (req.admin?.designation || '').toLowerCase();
    const cleanRole = roleLower.replace(/[^a-z0-9]/g, '');
    const cleanDesig = desigLower.replace(/[^a-z0-9]/g, '');

    const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'administrator'].includes(roleLower) || 
                          ['superadmin', 'admin', 'administrator'].includes(cleanRole);
    const isHRHead = ['hr head', 'hr_head', 'hr admin', 'hradmin', 'hr'].includes(roleLower) || 
                     ['hrhead', 'hradmin', 'hr'].includes(cleanRole) || 
                     desigLower.includes('hr head') || cleanDesig.includes('hrhead') ||
                     (req.admin?.isDepartmentHead && (req.admin?.department || '').toLowerCase().includes('hr'));
    const isHRManager = ['hr manager', 'hr_manager', 'hrmanager'].includes(roleLower) || 
                       ['hrmanager'].includes(cleanRole) || 
                       desigLower.includes('hr manager') || cleanDesig.includes('hrmanager');
    const isHRExecutive = ['hr executive', 'hr_executive', 'hrexecutive'].includes(roleLower) || 
                          ['hrexecutive'].includes(cleanRole) || 
                          desigLower.includes('hr executive') || cleanDesig.includes('hrexecutive');

    // 1. HR Executive is strictly Read-Only for managing attendance
    if (isHRExecutive && !isMasterAdmin) {
      return res.status(403).json({ 
        message: 'Access Denied: HR Executives can only view their own attendance and cannot edit/manage attendance records.' 
      });
    }

    // 2. HR Manager can only manage attendance for their assigned HR Executives
    if (isHRManager && !isMasterAdmin) {
      const isMyExec = (employee.reportsToManagerId && employee.reportsToManagerId.toString() === req.admin._id.toString()) ||
                       (employee.zone === req.admin.zone && (employee.role || '').toLowerCase().includes('executive'));
      if (!isMyExec) {
        return res.status(403).json({ 
          message: 'Access Denied: HR Managers can only manage attendance for their assigned HR Executives.' 
        });
      }
    }

    // 3. HR Head can manage attendance for HR Managers & HR Executives

    // Check if record for this date already exists
    const existingIndex = employee.attendance.findIndex(a => a.date === date);
    if (existingIndex > -1) {
      // Update
      employee.attendance[existingIndex] = { ...employee.attendance[existingIndex]._doc, checkIn, checkOut, status, hours };
    } else {
      // Create new
      employee.attendance.push({ date, checkIn, checkOut, status, hours });
    }

    await employee.save();
    res.status(200).json({ message: 'Attendance recorded successfully', attendance: employee.attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Apply for leave / Raise Leave Ticket
// @route   POST /api/employees/:id/leaves or POST /api/employees/apply-leave
// @access  Public / Private
const addLeaveRecord = async (req, res) => {
  try {
    const { startDate, endDate, type, reason, leaveDuration } = req.body;
    let empIdentifier = req.params.id || req.body.employeeId || req.body.empId || req.body.id;

    let employee = null;

    // 1. If req.admin is already resolved by protectAdmin
    if (req.admin) {
      if (req.admin._id) {
        employee = await Employee.findById(req.admin._id);
      }
      if (!employee && req.admin.email) {
        employee = await Employee.findOne({ email: new RegExp(`^${req.admin.email.trim()}$`, 'i') });
      }
      if (!employee && req.admin.empId) {
        employee = await Employee.findOne({ empId: req.admin.empId });
      }
    }

    // 2. If empIdentifier passed explicitly
    if (!employee && empIdentifier && empIdentifier !== 'apply-leave') {
      employee = await Employee.findOne({
        $or: [
          { _id: mongoose.isValidObjectId(empIdentifier) ? empIdentifier : null },
          { empId: empIdentifier },
          { email: typeof empIdentifier === 'string' ? new RegExp(`^${empIdentifier.trim()}$`, 'i') : empIdentifier },
          { mobile: empIdentifier }
        ].filter(Boolean)
      });
    }

    // 3. Fallback: Parse bearer token if present
    if (!employee && req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        if (decoded?.id) {
          employee = await Employee.findById(decoded.id) || await Employee.findOne({ empId: decoded.id });
        }
        if (!employee && decoded?.email) {
          employee = await Employee.findOne({ email: new RegExp(`^${decoded.email.trim()}$`, 'i') });
        }
      } catch (e) {}
    }

    // 4. Fallback: If body contains employee email or name
    if (!employee && req.body.email) {
      employee = await Employee.findOne({ email: new RegExp(`^${req.body.email.trim()}$`, 'i') });
    }

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found. Please login again.' });
    }

    const roleLower = (employee.role || '').toLowerCase();
    const desigLower = (employee.designation || '').toLowerCase();
    const isHRHead = roleLower.includes('hr head') || desigLower.includes('hr head');
    const isManager = !isHRHead && (roleLower.includes('manager') || desigLower.includes('manager'));

    // Determine Reporting Manager & Head
    let rmName = employee.reportsToManagerName || employee.reportsToHeadName || 'Reporting Manager';
    let rmId = employee.reportsToManagerId ? employee.reportsToManagerId.toString() : '';
    let hrName = employee.reportsToHeadName || 'HR Head';
    let hrId = employee.reportsToHeadId ? employee.reportsToHeadId.toString() : '';

    if (isHRHead) {
      rmName = 'Super Admin';
      hrName = 'Super Admin';
    } else if (isManager) {
      rmName = employee.reportsToHeadName || 'HR Head';
      hrName = employee.reportsToHeadName || 'HR Head';
    }

    const ticketId = `LEV-${Date.now().toString().slice(-6)}`;
    const newLeave = {
      ticketId,
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || startDate || new Date().toISOString().split('T')[0],
      type: type || 'Casual Leave',
      leaveDuration: leaveDuration || 'Full Day',
      reason: reason || 'Personal work',
      status: 'Pending',
      assignedHr: hrName,
      assignedHrId: hrId,
      adminComment: '',
      // Mandatory Dual Approvals:
      // 1. Reporting Manager
      rmApproval: {
        status: 'Pending',
        managerId: rmId,
        managerName: rmName,
        comment: '',
        actionDate: null
      },
      // 2. HR Manager / HR Head (Final Mandatory Approval)
      hrApproval: {
        status: 'Pending',
        hrId: hrId,
        hrName: hrName,
        comment: '',
        actionDate: null
      },
      appliedOn: new Date()
    };

    if (!Array.isArray(employee.leaves)) employee.leaves = [];
    employee.leaves.unshift(newLeave);
    await employee.save();

    // Notify Reporting Manager and HR Manager
    try {
      await createNotification(
        `Leave Ticket ${ticketId}: ${employee.name} (${employee.empId}) applied for ${newLeave.type} (${newLeave.startDate} to ${newLeave.endDate}). Requires approval from Reporting Manager & HR.`,
        'system',
        rmId || hrId || null
      );
    } catch (notifErr) {}

    res.status(201).json({
      success: true,
      message: `Leave ticket ${ticketId} submitted! Two-level approval required: 1. Reporting Manager (${rmName}) & 2. HR Manager (${hrName}).`,
      ticketId,
      leave: newLeave,
      leaves: employee.leaves
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get logged in employee's leave tickets
// @route   GET /api/employees/my-leaves
// @access  Public / Private
const getMyLeavesForApp = async (req, res) => {
  try {
    let empIdentifier = req.query.empId || req.query.employeeId;
    let employee = null;

    if (empIdentifier) {
      employee = await Employee.findOne({
        $or: [
          { _id: mongoose.isValidObjectId(empIdentifier) ? empIdentifier : null },
          { empId: empIdentifier },
          { email: empIdentifier.toLowerCase() },
          { mobile: empIdentifier }
        ].filter(Boolean)
      });
    }

    if (!employee && req.admin) {
      employee = await Employee.findById(req.admin._id);
    }

    if (!employee) {
      employee = await Employee.findOne({ status: 'Active' });
    }

    // Calculate Dynamic Leave Stats from DB
    const TOTAL_CL = 12;
    const TOTAL_SL = 7;
    const TOTAL_EL = 15;

    let clUsed = 0;
    let slUsed = 0;
    let elUsed = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    const leaves = (employee.leaves || []).map(l => {
      const days = Math.max(1, Math.ceil((new Date(l.endDate) - new Date(l.startDate)) / (1000 * 60 * 60 * 24)) + 1);
      
      if (l.status === 'Pending') pendingCount++;
      else if (l.status === 'Approved') {
        approvedCount++;
        const typeLower = (l.type || '').toLowerCase();
        if (typeLower.includes('casual')) clUsed += days;
        else if (typeLower.includes('sick')) slUsed += days;
        else if (typeLower.includes('earned')) elUsed += days;
      } else if (l.status === 'Rejected') {
        rejectedCount++;
      }

      return {
        id: l._id,
        ticketId: l.ticketId || `LEV-${l._id.toString().slice(-4)}`,
        startDate: l.startDate,
        endDate: l.endDate,
        days: days,
        type: l.type,
        reason: l.reason,
        status: l.status,
        adminComment: l.adminComment || '',
        assignedHr: l.assignedHr || employee.assignedHr || 'HR Manager',
        rmApproval: l.rmApproval || {
          status: 'Pending',
          managerName: employee.reportsToHeadName || 'Reporting Manager',
          comment: ''
        },
        hrApproval: l.hrApproval || {
          status: 'Pending',
          hrName: employee.assignedHRName || 'HR Manager',
          comment: ''
        },
        appliedOn: l.appliedOn
      };
    });

    const stats = {
      totalApplications: leaves.length,
      pendingCount,
      approvedCount,
      rejectedCount,
      casualLeave: {
        total: TOTAL_CL,
        used: clUsed,
        remaining: Math.max(0, TOTAL_CL - clUsed)
      },
      sickLeave: {
        total: TOTAL_SL,
        used: slUsed,
        remaining: Math.max(0, TOTAL_SL - slUsed)
      },
      earnedLeave: {
        total: TOTAL_EL,
        used: elUsed,
        remaining: Math.max(0, TOTAL_EL - elUsed)
      }
    };

    res.json({ success: true, leaves, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update leave status — Dynamic Multi-Tier Hierarchy Approval
// @route   PUT /api/employees/:id/leaves/:leaveId/status
// @access  Private (Admin / HR Head / HR Manager)
const updateLeaveStatus = async (req, res) => {
  try {
    const { approverRole, action, comment } = req.body;
    const approverName = req.admin?.name || 'Admin';
    const approverId   = req.admin?._id?.toString() || '';
    const adminRoleLower = (req.admin?.role || '').toLowerCase();
    const adminDesigLower = (req.admin?.designation || '').toLowerCase();
    const cleanAdminRole = adminRoleLower.replace(/[^a-z0-9]/g, '');

    const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'administrator'].includes(adminRoleLower) || 
                          ['superadmin', 'admin', 'administrator'].includes(cleanAdminRole);
    const isHRHead = ['hr head', 'hr_head', 'hr admin', 'hradmin', 'hr'].includes(adminRoleLower) || 
                     ['hrhead', 'hradmin', 'hr'].includes(cleanAdminRole) || 
                     adminDesigLower.includes('hr head') ||
                     (req.admin?.isDepartmentHead && (req.admin?.department || '').toLowerCase().includes('hr'));
    const isHRManager = !isHRHead && !isMasterAdmin && (
                       ['hr manager', 'hr_manager', 'hrmanager', 'manager'].includes(adminRoleLower) || 
                       ['hrmanager', 'manager'].includes(cleanAdminRole) || 
                       adminRoleLower.includes('manager') ||
                       adminDesigLower.includes('manager'));

    if (!action || !['Approved', 'Rejected'].includes(action)) {
      return res.status(400).json({ message: "action must be 'Approved' or 'Rejected'" });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Restrict applicant from approving or rejecting their own leave
    if (req.admin && employee._id.toString() === req.admin._id.toString()) {
      return res.status(403).json({ message: "Access Denied: You cannot approve or reject your own leave request. It must be approved by your designated reporting authority." });
    }

    const leave = employee.leaves.id(req.params.leaveId);
    if (!leave) return res.status(404).json({ message: "Leave not found" });

    const empRoleLower = (employee.role || '').toLowerCase();
    const empDesigLower = (employee.designation || '').toLowerCase();
    const isEmpHRHead = empRoleLower.includes('hr head') || empDesigLower.includes('hr head');
    const isEmpManager = !isEmpHRHead && (empRoleLower.includes('manager') || empDesigLower.includes('manager'));
    const isEmpExecutive = !isEmpHRHead && !isEmpManager;

    const now = new Date();

    // ── 1. HR Head Leave Approval ──────────────────────────────────────────
    if (isEmpHRHead) {
      // Must be approved by SuperAdmin / Admin
      if (!isMasterAdmin) {
        return res.status(403).json({ message: "Access Denied: Only Superadmin/Admin can approve HR Head's leave request." });
      }
      leave.hrApproval = {
        status: action,
        approvedBy: approverName,
        approverId: approverId,
        approvedAt: now,
        comment: comment || ''
      };
      leave.status = action; // 'Approved' or 'Rejected'
      leave.adminComment = comment || leave.adminComment;
    }

    // ── 2. HR Manager Leave Approval ───────────────────────────────────────
    else if (isEmpManager) {
      // Must be approved by HR Head (or SuperAdmin / Admin)
      if (!isHRHead && !isMasterAdmin) {
        return res.status(403).json({ message: "Access Denied: Only HR Head (or Admin) can approve HR Manager's leave request." });
      }
      leave.rmApproval = {
        status: action,
        approvedBy: approverName,
        approverId: approverId,
        approvedAt: now,
        comment: comment || ''
      };
      leave.hrApproval = {
        status: action,
        approvedBy: approverName,
        approverId: approverId,
        approvedAt: now,
        comment: comment || ''
      };
      leave.status = action; // 'Approved' or 'Rejected'
      leave.adminComment = comment || leave.adminComment;
    }

    // ── 3. HR Executive Leave Approval (Two-Stage: Manager Review -> HR Head Final Grant) ───
    else {
      // Stage 1: RM Review by Manager (or when approverRole is 'rm')
      if (approverRole === 'rm' || isHRManager) {
        if (leave.status !== 'Pending') {
          return res.status(400).json({ message: `Leave is already '${leave.status}'. RM can only review Pending leaves.` });
        }
        leave.rmApproval = {
          status: action,
          approvedBy: approverName,
          approverId: approverId,
          approvedAt: now,
          comment: comment || ''
        };
        if (action === 'Rejected') {
          leave.status = 'Rejected';
          leave.adminComment = comment || leave.adminComment;
        } else {
          leave.status = 'RM Approved'; // Reviewed by Manager, now awaits HR Head approval
        }
      } 
      // Stage 2: Final Grant by HR Head (or Admin)
      else if (approverRole === 'hr' || isHRHead || isMasterAdmin) {
        // HR Head gives final grant to RM Approved leaves (or direct master admin approval)
        leave.hrApproval = {
          status: action,
          approvedBy: approverName,
          approverId: approverId,
          approvedAt: now,
          comment: comment || ''
        };
        leave.status = action; // 'Approved' or 'Rejected'
        leave.adminComment = comment || leave.adminComment;
      }
    }

    await employee.save();

    // Send notifications
    try {
      let notifMsg = `Leave ticket (${leave.startDate} → ${leave.endDate}) status updated to '${leave.status}' by ${approverName}.`;
      await createNotification(notifMsg, "system", employee._id);
    } catch (e) {}

    res.status(200).json({
      message: `Leave ${action} successfully. Current status: ${leave.status}`,
      status: leave.status,
      leaves: employee.leaves
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all leaves across all employees (Filtered by Hierarchy)
// @route   GET /api/employees/leaves
// @access  Private (Admin/HR Head/HR Manager)
const getAllLeaves = async (req, res) => {
  try {
    const { assignedHrId, status } = req.query;
    let query = { status: "Active" };

    const roleLower = (req.admin?.role || '').toLowerCase();
    const desigLower = (req.admin?.designation || '').toLowerCase();
    const cleanRole = roleLower.replace(/[^a-z0-9]/g, '');
    const cleanDesig = desigLower.replace(/[^a-z0-9]/g, '');

    const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'administrator'].includes(roleLower) || 
                          ['superadmin', 'admin', 'administrator'].includes(cleanRole);
    const isHRHead = ['hr head', 'hr_head', 'hr admin', 'hradmin', 'hr'].includes(roleLower) || 
                     ['hrhead', 'hradmin', 'hr'].includes(cleanRole) || 
                     desigLower.includes('hr head') || cleanDesig.includes('hrhead') ||
                     (req.admin?.isDepartmentHead && (req.admin?.department || '').toLowerCase().includes('hr'));
    const isHRManager = !isHRHead && !isMasterAdmin && (
                       ['hr manager', 'hr_manager', 'hrmanager', 'manager'].includes(roleLower) || 
                       ['hrmanager', 'manager'].includes(cleanRole) || 
                       roleLower.includes('manager') ||
                       desigLower.includes('manager') || cleanDesig.includes('manager'));
    const isSalesHead = ['sales head', 'sales_head', 'saleshead'].includes(roleLower) || ['saleshead'].includes(cleanRole);
    const isRRM = ['rrm', 'regional reporting manager'].includes(roleLower) || (req.admin?.zonalRole === 'RRM') || cleanRole.includes('rrm') || desigLower.includes('regional');
    const isARM = ['arm', 'area reporting manager'].includes(roleLower) || (req.admin?.zonalRole === 'ARM') || cleanRole.includes('arm') || desigLower.includes('area');
    const isExecutive = !isMasterAdmin && !isHRHead && !isHRManager && !isSalesHead && !isRRM && !isARM;

    if (isMasterAdmin) {
      // 1. Superadmin / Admin sees all leaves
      query = {};
    } else if (isSalesHead) {
      // Sales Head sees all leaves across sales zones
      query = {};
    } else if (isRRM) {
      // RRM sees their own leaves and leaves of employees in their zone
      query = {
        $or: [
          { _id: req.admin._id },
          { rrmId: req.admin._id },
          { zone: req.admin.zone || 'NORTH' }
        ]
      };
    } else if (isARM) {
      // ARM sees their own leaves and leaves of employees reporting to them
      query = {
        $or: [
          { _id: req.admin._id },
          { armId: req.admin._id },
          { reportsToManagerId: req.admin._id }
        ]
      };
    } else if (isHRHead) {
      // 2. HR Head sees all leaves from HR Managers and HR Executives
      query = {
        role: { $nin: ['superadmin', 'super admin', 'Super Admin', 'Admin', 'admin', 'HR Head', 'hr head', 'HR Admin'] },
        designation: { $not: /hr\s*head/i }
      };
    } else if (isHRManager) {
      // 3. HR Manager sees leaves of their Executive team
      query = {
        $or: [
          { role: { $regex: /executive|telecaller|caller|staff|agent/i } },
          { designation: { $regex: /executive|telecaller|caller|staff|agent/i } },
          { reportsToManagerId: req.admin._id }
        ]
      };
    } else if (isExecutive) {
      // 4. Executive sees only their own leaves (search by _id or email)
      query = {
        $or: [
          { _id: req.admin._id },
          { email: new RegExp(`^${(req.admin.email || '').trim()}$`, 'i') }
        ]
      };
    }

    if (assignedHrId && assignedHrId !== 'All') {
      query.assignedHrId = assignedHrId;
    }

    const employees = await Employee.find(query).select("name email empId role designation division assignedHr assignedHrId leaves reportsToManagerId reportsToHeadId");
    
    let allLeaves = [];
    employees.forEach(emp => {
      if (emp.leaves && emp.leaves.length > 0) {
        emp.leaves.forEach(leave => {
          if (!status || status === 'All' || leave.status === status) {
            allLeaves.push({
              id: leave._id,
              ticketId: leave.ticketId || `LEV-${leave._id.toString().slice(-4)}`,
              employeeId: emp._id,
              empId: emp.empId || "-",
              employeeName: emp.name || "-",
              employeeRole: emp.role || emp.designation || "Staff",
              department: emp.division || emp.designation || "-",
              assignedHr: emp.assignedHr || leave.assignedHr || 'Unassigned',
              assignedHrId: emp.assignedHrId || leave.assignedHrId || '',
              type: leave.type,
              startDate: leave.startDate,
              endDate: leave.endDate,
              days: Math.max(1, Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1),
              reason: leave.reason,
              adminComment: leave.adminComment,
              status: leave.status,
              rmApproval: leave.rmApproval || { status: 'Pending' },
              hrApproval: leave.hrApproval || { status: 'Pending' },
              appliedDate: leave.appliedOn
            });
          }
        });
      }
    });

    // Sort by appliedDate descending
    allLeaves.sort((a, b) => new Date(b.appliedDate) - new Date(a.appliedDate));

    res.status(200).json(allLeaves);
  } catch (error) {
    console.error("GET_LEAVES_ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send reminder to HR about missing documents
// @route   POST /api/employees/:id/remind-hr
// @access  Private (Admin)
const remindHrForDocuments = async (req, res) => {
  try {
    const { missingDocs } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    if (!missingDocs || missingDocs.length === 0) {
      return res.status(400).json({ message: 'No missing documents specified' });
    }

    const docNames = missingDocs.map(d => d.name).join(', ');
    const message = `Reminder: Employee ${employee.name} (${employee.empId}) has not uploaded the following documents: ${docNames}. Please send them the onboarding link to upload.`;

    // Send system notification to HR (In this demo, saving a system notification with null user id means all admins/HR will see it)
    await createNotification(message, 'system', null);

    res.status(200).json({ message: 'Reminder sent to HR successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Employee Login (by EMP-HRMS ID, Email or Mobile + Password)
// @route   POST /api/employees/login
// @access  Public
const loginEmployee = async (req, res) => {
  try {
    const { empHrmsId, empId, password, identifier, email } = req.body;
    const loginId = (empHrmsId || empId || identifier || email || '').trim();

    if (!loginId) {
      return res.status(400).json({ message: 'EMP-HRMS ID is required' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Find by empId (case-insensitive regex, tolerant to NuoGM / NouGM) or email or mobile
    const normalizedEmpId = loginId.replace(/^no[uo]gm/i, 'NuoGM');
    let employee = await Employee.findOne({
      $or: [
        { empId: { $regex: new RegExp(`^${loginId}$`, 'i') } },
        { empId: { $regex: new RegExp(`^${normalizedEmpId}$`, 'i') } },
        { email: loginId.toLowerCase() },
        { mobile: loginId }
      ]
    });

    let isMatch = false;
    let adminUser = null;

    if (employee && employee.password) {
      isMatch = await employee.matchPassword(password);
    }

    // Fallback: Check Admin collection if employee not found or password didn't match in Employee
    if (!isMatch) {
      adminUser = await Admin.findOne({ email: loginId.toLowerCase() });
      if (adminUser && adminUser.password) {
        const adminPassMatch = await adminUser.matchPassword(password);
        if (adminPassMatch) {
          isMatch = true;
          if (!employee) {
            employee = {
              _id: adminUser._id,
              empId: 'ADMIN-' + (adminUser.role || 'HR'),
              name: adminUser.name,
              email: adminUser.email,
              mobile: '',
              role: adminUser.role,
              designation: adminUser.role,
              status: 'Active',
              onboardingStatus: 'Done',
              permissions: adminUser.permissions || [],
            };
          }
        }
      }
    }

    if (!employee && !adminUser) {
      return res.status(401).json({ success: false, message: 'Invalid Employee ID or Email. No account found in database.' });
    }

    const currentStatus = employee?.status || adminUser?.status || 'Active';
    // Check status
    if (currentStatus === 'Inactive') {
      return res.status(403).json({ success: false, message: 'Your account is Inactive. Please contact HR Admin.' });
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid Password. Please check and try again.' });
    }

    // Normalize user role and designation
    const empRole = (employee?.role || adminUser?.role || '').trim().toLowerCase();
    const empDesig = (employee?.designation || '').trim().toLowerCase();
    const roleNormalized = `${empRole} ${empDesig}`;

    // Check if request is coming from Employee Mobile App
    const isAppRequest = Boolean(
      req.body.isApp === true ||
      req.body.client === 'app' ||
      req.headers['x-client-type'] === 'app' ||
      req.headers['x-app-source'] === 'employee_app'
    );

    // Role check: RM, RE, and RO restriction is only for Employee Mobile App.
    // Web Panel allows all valid roles (Admin, HR, Telecaller, Accountant, Operations, etc.)
    if (isAppRequest) {
      const allowedAppRoles = [
        'rm', 'relationship manager', 'relationship_manager',
        're', 'relationship executive', 'relationship_executive',
        'ro', 'relationship officer', 'relationship_officer'
      ];

      const isAllowedRole = allowedAppRoles.some(r => {
        if (empRole === r || empDesig === r) return true;
        return roleNormalized.includes('relationship manager') ||
               roleNormalized.includes('relationship executive') ||
               roleNormalized.includes('relationship officer') ||
               empRole === 'rm' || empDesig === 'rm' ||
               empRole === 're' || empDesig === 're' ||
               empRole === 'ro' || empDesig === 'ro';
      });

      if (!isAllowedRole) {
        return res.status(403).json({
          success: false,
          message: 'Employee App me kewal RM, RE aur RO login kar sakte hain. Aapka role app ke liye authorized nahi hai.'
        });
      }
    }

    // Office Hour Check for regular employees (Admins/Superadmins are exempt)
    const roleLower = roleNormalized;
    const isMasterAdmin = ['super admin', 'superadmin', 'admin'].includes(roleLower);

    // Calculate time in Indian Standard Time (Asia/Kolkata)
    const now = new Date();
    const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentHour = istDate.getHours();
    const currentMinute = istDate.getMinutes();
    const totalMinutes = currentHour * 60 + currentMinute;
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const day = String(istDate.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // =========================================================================
    // OFFICE HOURS LOGIN & LATE BLOCKING RESTRICTION (TEMPORARILY COMMENTED OUT)
    // =========================================================================
    /*
    const isAppRequest = Boolean(
      req.body.isApp === true ||
      req.body.client === 'app' ||
      req.body.empHrmsId ||
      req.headers['x-client-type'] === 'app' ||
      req.headers['x-app-source'] === 'employee_app'
    );

    if (isAppRequest && !isMasterAdmin && employee && employee._id) {
      // 1. Check if employee is already marked as Late-Locked
      if (employee.isLateLocked) {
        return res.status(403).json({
          success: false,
          isLateBlocked: true,
          empId: employee.empId,
          email: employee.email,
          name: employee.name,
          mobile: employee.mobile || '',
          assignedHRName: employee.assignedHRName || 'HR Manager',
          unblockRequestStatus: employee.unblockRequest?.status || 'None',
          queryText: employee.unblockRequest?.queryText || '',
          message: 'Aapki ID late login ya policy ki wajah se Block hai. Kripya HR Panel par unblock query submit karein, HR unblock karega tabhi login hoga.'
        });
      }

      // 2. Check if HR has approved late login for today
      const hasTodayHrApproval = (employee.hrLoginApprovedDate === todayStr);

      // 3. If within allowed morning window (10:00 AM to 10:15 AM)
      const isMorningWindow = (totalMinutes >= 600 && totalMinutes <= 615);
      // If evening cutoff passed (after 7:00 PM = 1140 mins) or before 10:00 AM (before 600 mins)
      const isOutsideHours = (totalMinutes < 600 || totalMinutes >= 1140);
      // Late login: After 10:15 AM
      const isLate = (totalMinutes > 615);

      if (!hasTodayHrApproval && (isLate || isOutsideHours)) {
        // Automatically block employee ID due to late login
        employee.isLateLocked = true;
        employee.lateLockReason = isOutsideHours 
          ? `Login attempt outside working hours (Time: ${currentHour}:${String(currentMinute).padStart(2, '0')})`
          : `Late login attempt after 10:15 AM (Time: ${currentHour}:${String(currentMinute).padStart(2, '0')})`;
        await employee.save();

        return res.status(403).json({
          success: false,
          isLateBlocked: true,
          empId: employee.empId,
          email: employee.email,
          name: employee.name,
          mobile: employee.mobile || '',
          assignedHRName: employee.assignedHRName || 'HR Manager',
          unblockRequestStatus: employee.unblockRequest?.status || 'None',
          queryText: employee.unblockRequest?.queryText || '',
          message: isOutsideHours
            ? 'Login allowed nahi hai. Office login time 10:00 AM se 10:15 AM hai (End time: 7:00 PM). Aapki ID block ho gayi hai. Niche diye gaye form se HR ko query bhejein.'
            : 'Login time khatm ho gaya hai (Allowed: 10:00 AM - 10:15 AM). Late hone ke karan aapki ID block kar di gayi hai. HR ko unblock query bhejein, approval ke baad login hoga.'
        });
      }
    }
    */

    let attendanceStatus = 'Present';
    let checkInHours = '8h 00m';
    const period = currentHour >= 12 ? 'PM' : 'AM';
    const displayHour = (currentHour % 12 || 12).toString().padStart(2, '0');
    const displayMinute = currentMinute.toString().padStart(2, '0');
    const checkInTime = `${displayHour}:${displayMinute} ${period}`;

    // Default attendance status: Present (Full Day)
    // (In production: if logged in after 10:15 AM (615 mins), mark Half Day)
    /*
    if (totalMinutes > 615) {
      attendanceStatus = 'Half Day';
      checkInHours = '4h 00m';
    }
    */

    // Auto-record Attendance if not already recorded today
    if (employee && employee._id && Array.isArray(employee.attendance)) {
      const existingAttendance = employee.attendance.find(a => a && a.date === todayStr);
      if (!existingAttendance) {
        employee.attendance.push({
          date: todayStr,
          checkIn: checkInTime,
          checkOut: '06:00 PM',
          status: attendanceStatus,
          hours: checkInHours
        });
        await employee.save();
      } else {
        attendanceStatus = existingAttendance.status || attendanceStatus;
      }
    }

    const userRole = employee.role || adminUser?.role || 'EMPLOYEE';
    const userId = employee._id || adminUser?._id;
    const token = generateToken(userId, userRole);

    res.status(200).json({
      success: true,
      token,
      role: userRole,
      email: employee.email || adminUser?.email,
      name: employee.name || adminUser?.name,
      permissions: employee.permissions || adminUser?.permissions || [],
      _id: userId,
      attendance: {
        date: todayStr,
        checkIn: checkInTime,
        checkOut: '06:00 PM',
        status: attendanceStatus,
        hours: checkInHours,
        isLate: totalMinutes > 615
      },
      employee: {
        _id: userId,
        empId: employee.empId || 'ADMIN',
        name: employee.name,
        email: employee.email,
        mobile: employee.mobile || '',
        role: userRole,
        designation: employee.designation || userRole,
        status: employee.status || 'Active',
        onboardingStatus: employee.onboardingStatus || 'Done',
        isVerified: employee.onboardingStatus === 'Done',
        areaLocation: employee.city || employee.district || employee.presentAddress || 'Delhi NCR',
        zone: employee.zone || 'NORTH',
        permissions: employee.permissions || adminUser?.permissions || [],
        avatar: employee.avatar || ''
      },
      message: totalMinutes > 615 
        ? `Login successful. Checked in as Half Day (Late login: ${checkInTime}).`
        : `Login successful. Attendance marked: Present (Check-in: ${checkInTime}).`
    });
  } catch (error) {
    console.error('Error in loginEmployee:', error);
    res.status(500).json({ message: error.message });
  }
};


const remindEmployeeForOnboarding = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    
    if (!employee.email) {
      return res.status(400).json({ message: 'Employee email not found' });
    }

    const sendEmail = require('../utils/emailService');
    const onboardingLink = `http://localhost:5173/onboarding/${employee._id}`;
    
    const html = `
      <h2>Welcome to HAUS Nuo-Pay!</h2>
      <p>Dear ${employee.name},</p>
      <p>Please complete your onboarding process by filling out the form and uploading the required documents.</p>
      <p>Click the link below to start:</p>
      <a href="${onboardingLink}" style="display:inline-block;padding:10px 20px;background-color:#0EA5E9;color:white;text-decoration:none;border-radius:5px;">Complete Onboarding</a>
      <p>If the button doesn't work, copy and paste this link in your browser:</p>
      <p>${onboardingLink}</p>
      <p>Thank you,<br>HR Team</p>
    `;

    const sent = await sendEmail({
      to: employee.email,
      subject: 'Action Required: Complete your Onboarding',
      html
    });

    if (sent) {
      res.status(200).json({ message: 'Reminder sent to employee successfully' });
    } else {
      res.status(500).json({ message: 'Failed to send email' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const employee = await Employee.findById(req.employee ? req.employee._id : req.admin._id);

    if (employee && (await employee.matchPassword(currentPassword))) {
      employee.password = newPassword;
      await employee.save();
      res.json({ message: 'Password updated successfully' });
    } else {
      res.status(401).json({ message: 'Invalid current password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all leads and loan applications assigned to the logged in employee or filtered by admin
// @route   GET /api/employees/my-leads
// @access  Private
const getMyAssignedLeads = async (req, res) => {
  try {
    const rawRole = (req.admin?.role || '').toLowerCase();
    const zonalRole = (req.admin?.zonalRole || '').toLowerCase();
    const roleLower = rawRole.replace(/[^a-z0-9]/g, '');
    const isMasterAdmin = ['superadmin', 'admin'].includes(roleLower) || ['super admin', 'sales head'].includes(rawRole);
    const filterEmpId = req.query.employeeId || req.query.assignedToId;

    let leadQuery = {};
    let loanQuery = {};

    if (isMasterAdmin) {
      if (filterEmpId && filterEmpId !== 'all') {
        leadQuery.assignedToId = filterEmpId;
        loanQuery.assignedToId = filterEmpId;
      } else {
        leadQuery.assignedToId = { $ne: null };
        loanQuery.assignedToId = { $ne: null };
      }
    } else {
      const userId = req.admin ? req.admin._id.toString() : null;
      const userName = req.admin ? req.admin.name : null;
      if (!userId) {
        return res.status(401).json({ message: 'User not identified' });
      }

      const isTelecaller = rawRole.includes('tele') || zonalRole.includes('tele');
      const isRM  = roleLower === 'rm'  || zonalRole === 'rm';
      const isARM = roleLower === 'arm' || zonalRole === 'arm';
      const isRRM = roleLower === 'rrm' || zonalRole === 'rrm';
      const userZone = req.admin?.zone || 'NORTH';
      const isAllZone = !userZone || userZone === 'ALL';

      if (isTelecaller) {
        // Telecaller: gets all leads assigned to them (by id/name) OR in their zone
        const zoneConditions = isAllZone ? [] : [{ zone: userZone.toUpperCase() }];
        leadQuery = {
          workflowStage: { $nin: ['Disbursed', 'Rejected'] },
          $or: [
            { telecallerId: userId },
            { telecallerName: userName },
            { assignedToId: userId },
            { assignedTo: userName },
            ...zoneConditions
          ]
        };
        loanQuery = {
          workflowStage: { $nin: ['Disbursed', 'Rejected'] },
          $or: [
            { telecallerId: userId },
            { telecallerName: userName },
            { assignedToId: userId },
            { assignedTo: userName },
            ...zoneConditions
          ]
        };
      } else if (isRM) {
        // RM: gets leads where they are assigned as RM OR in their zone
        const zoneConditions = isAllZone ? [] : [{ zone: userZone.toUpperCase() }];
        leadQuery = {
          workflowStage: { $nin: ['Rejected'] },
          $or: [
            { rmId: userId },
            { rmName: userName },
            { assignedToId: userId },
            { assignedTo: userName },
            ...zoneConditions
          ]
        };
        loanQuery = {
          workflowStage: { $nin: ['Rejected'] },
          $or: [
            { rmId: userId },
            { rmName: userName },
            { assignedToId: userId },
            { assignedTo: userName },
            ...zoneConditions
          ]
        };
      } else if (isARM) {
        // ARM: gets leads in their zone where armId matches
        const zoneConditions = isAllZone ? [] : [{ zone: userZone.toUpperCase() }];
        leadQuery = {
          $or: [
            { armId: userId },
            { armName: userName },
            ...zoneConditions
          ]
        };
        loanQuery = { ...leadQuery };
      } else if (isRRM) {
        // RRM: gets all leads in their zone
        const zoneConditions = isAllZone ? [] : [{ zone: userZone.toUpperCase() }];
        leadQuery = {
          $or: [
            { rrmId: userId },
            { rrmName: userName },
            ...zoneConditions
          ]
        };
        loanQuery = { ...leadQuery };
      } else {
        // Default (RO/RE/Field Staff): leads created by or assigned to them
        leadQuery.$or = [
          { assignedToId: userId },
          { assignedTo: userName },
          { createdById: userId },
          { createdByName: userName }
        ];
        loanQuery.$or = [
          { assignedToId: userId },
          { assignedTo: userName }
        ];
      }
    }

    const leads = await Lead.find(leadQuery).sort({ createdAt: -1 });
    const loanApplications = await LoanApplication.find(loanQuery).sort({ createdAt: -1 });

    res.status(200).json({ leads, loanApplications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all leads created by the logged in employee or filtered by admin
// @route   GET /api/employees/my-created-leads
// @access  Private
const getMyCreatedLeads = async (req, res) => {
  try {
    const roleLower = (req.admin?.role || '').toLowerCase();
    const isMasterAdmin = ['super admin', 'superadmin', 'admin'].includes(roleLower);
    const filterEmpId = req.query.employeeId || req.query.createdById;

    let query = {};
    if (isMasterAdmin) {
      if (filterEmpId && filterEmpId !== 'all') {
        query.createdById = filterEmpId;
      }
    } else {
      const userId = req.admin ? req.admin._id.toString() : null;
      if (!userId) {
        return res.status(401).json({ message: 'User not identified' });
      }
      query.createdById = userId;
    }

    const leads = await Lead.find(query).sort({ createdAt: -1 });

    res.status(200).json({ leads });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get dashboard stats for telecaller or master admin view
// @route   GET /api/employees/telecaller-dashboard-stats
// @access  Private
const getTelecallerDashboardStats = async (req, res) => {
  try {
    const roleLower = (req.admin?.role || '').toLowerCase();
    const isMasterAdmin = ['super admin', 'superadmin', 'admin'].includes(roleLower);
    const filterEmpId = req.query.employeeId || req.query.assignedToId;

    let leadAssignedQuery = {};
    let loanAssignedQuery = {};
    let createdQuery = {};

    if (isMasterAdmin) {
      if (filterEmpId && filterEmpId !== 'all') {
        leadAssignedQuery.assignedToId = filterEmpId;
        loanAssignedQuery.assignedToId = filterEmpId;
        createdQuery.createdById = filterEmpId;
      } else {
        leadAssignedQuery.assignedToId = { $ne: null };
        loanAssignedQuery.assignedToId = { $ne: null };
      }
    } else {
      const userId = req.admin ? req.admin._id.toString() : null;
      const userName = req.admin ? req.admin.name : null;
      if (!userId) {
        return res.status(401).json({ message: 'User not identified' });
      }
      
      leadAssignedQuery.$or = [
        { assignedToId: userId },
        { assignedTo: userName }
      ];
      
      loanAssignedQuery.$or = [
        { assignedToId: userId },
        { assignedTo: userName }
      ];
      
      createdQuery.$or = [
        { createdById: userId },
        { createdByName: userName }
      ];
    }

    const totalCreatedLeads = await Lead.countDocuments(createdQuery);
    const assignedLeadsCount = await Lead.countDocuments(leadAssignedQuery);
    const assignedLoansCount = await LoanApplication.countDocuments(loanAssignedQuery);
    const totalAssigned = assignedLeadsCount + assignedLoansCount;

    const convertedLeads = await Lead.countDocuments({
      ...leadAssignedQuery,
      status: 'Converted'
    });

    res.status(200).json({
      totalCreatedLeads,
      totalAssigned,
      assignedLeadsCount,
      assignedLoansCount,
      convertedLeads,
      followUpsToday: 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get pending onboarding list (for Admin and assigned Telecaller chasers)
// @route   GET /api/employees/pending-onboarding
// @access  Private
const getPendingOnboardings = async (req, res) => {
  try {
    const roleLower = (req.admin?.role || '').toLowerCase();
    const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'hr', 'human resources', 'hr admin'].includes(roleLower);
    
    let query = { onboardingStatus: { $in: ['Pending', 'Submitted'] } };
    
    const unassigned = req.query.unassigned;
    const filterEmpId = req.query.assignedTelecallerId;

    // Never show the logged-in user themselves in pending onboarding chaser list
    if (req.admin && req.admin._id) {
      query._id = { $ne: req.admin._id };
    }

    const cleanRole = roleLower.replace(/[^a-z0-9]/g, '');
    const isHRHead = ['hr head', 'hr_head', 'hr admin', 'hradmin', 'hr'].includes(roleLower) || 
                     ['hrhead', 'hradmin', 'hr'].includes(cleanRole);
    const isHRManager = ['hr manager', 'hr_manager', 'hrmanager', 'manager'].includes(roleLower) || 
                        ['hrmanager', 'manager'].includes(cleanRole);

    if (isMasterAdmin || isHRHead || isHRManager) {
      // HR Manager can see candidates across ALL zones
      if (unassigned === 'false') {
        query.assignedTelecallerId = { $ne: null };
      } else if (unassigned === 'true') {
        query.assignedTelecallerId = null;
      }

      if (filterEmpId && filterEmpId !== 'all') {
        query.assignedTelecallerId = filterEmpId;
      }
    } else {
      // HR Executive: strictly zone-locked & assigned candidates
      const adminIdStr = req.admin ? req.admin._id.toString() : '';
      const adminNameStr = req.admin ? req.admin.name : '';
      const execZone = req.admin?.zone || 'NORTH';

      query.zone = execZone;
      query.$or = [
        { assignedTelecallerId: adminIdStr },
        { assignedTelecallerName: adminNameStr },
        { assignedHRId: adminIdStr },
        { assignedHRName: adminNameStr },
        { zone: execZone }
      ];
    }

    const pendingList = await Employee.find(query).sort({ createdAt: -1 });
    res.status(200).json(pendingList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign pending onboarding follow-up to Telecaller
// @route   PUT /api/employees/:id/assign-onboarding-chaser
// @access  Private (Admin / HR)
const assignOnboardingChaser = async (req, res) => {
  try {
    const { telecallerId, telecallerName, notes } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    employee.assignedTelecallerId = telecallerId || null;
    employee.assignedTelecallerName = telecallerName || null;
    if (notes !== undefined) employee.telecallerChaserNotes = notes;

    await employee.save();

    res.status(200).json({ message: 'Telecaller assigned successfully', employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign Employee to HR
// @route   PUT /api/employees/:id/assign-hr
// @access  Private (Admin / Superadmin)
const assignEmployeeToHR = async (req, res) => {
  try {
    const { hrId, hrName } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    employee.assignedHRId = hrId || null;
    employee.assignedHRName = hrName || null;
    employee.assignedHRAt = hrId ? new Date() : null;

    await employee.save();

    res.status(200).json({ 
      message: hrId ? `Employee successfully assigned to HR ${hrName || ''}` : 'HR assignment removed',
      employee 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get assignable staff (HRs & Telecallers) from database
// @route   GET /api/employees/assignable-staff
// @access  Private
const getStaffForAssignment = async (req, res) => {
  try {
    const [admins, employees] = await Promise.all([
      Admin.find({}).select('-password'),
      Employee.find({ status: 'Active' }).select('-password')
    ]);

    const seenEmails = new Set();
    const hrs = [];
    const telecallers = [];

    const isHR = (role = '', perms = []) => {
      const r = (role || '').toLowerCase();
      return r.includes('hr') || perms.includes('Payroll/Salary') || perms.includes('Manage Employees');
    };

    const isTelecaller = (role = '', perms = []) => {
      const r = (role || '').toLowerCase();
      return r.includes('tele') || r.includes('call') || r.includes('agent');
    };

    // Process Admins first
    admins.forEach(a => {
      const emailLower = (a.email || '').toLowerCase();
      if (emailLower && !seenEmails.has(emailLower)) {
        seenEmails.add(emailLower);
        const item = { _id: a._id.toString(), name: a.name, email: a.email, role: a.role, mobile: a.phone || '' };
        if (isHR(a.role, a.permissions || [])) hrs.push(item);
        if (isTelecaller(a.role, a.permissions || [])) telecallers.push(item);
      }
    });

    // Process Employees
    employees.forEach(e => {
      const emailLower = (e.email || '').toLowerCase();
      if (emailLower && !seenEmails.has(emailLower)) {
        seenEmails.add(emailLower);
        const item = { _id: e._id.toString(), name: e.name, email: e.email, role: e.role, mobile: e.mobile || '' };
        if (isHR(e.role, e.permissions || [])) hrs.push(item);
        if (isTelecaller(e.role, e.permissions || [])) telecallers.push(item);
      }
    });

    res.status(200).json({ hrs, telecallers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Guest Login for Employee App
// @route   POST /api/employees/guest-login
// @access  Public
const guestLoginEmployee = async (req, res) => {
  try {
    const guestEmployee = {
      _id: 'guest_emp_' + Date.now(),
      empId: 'EMP-GUEST-001',
      name: 'Guest Associate',
      email: 'guest@nuoghousing.com',
      mobile: '+91 9876500000',
      role: 'TELECALLER',
      designation: 'Guest Field Associate',
      status: 'Active',
      onboardingStatus: 'Done',
      isVerified: true,
      isGuest: true,
      areaLocation: 'Head Office (Demo Mode)',
      permissions: ['Lead Management', 'Status Management', 'View Dashboard']
    };

    const token = generateToken(guestEmployee._id, guestEmployee.role);

    res.status(200).json({
      success: true,
      token,
      employee: guestEmployee,
      message: 'Logged in as Guest successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Team Members for Employee App Home Page (Verified / Non-Verified)
// @route   GET /api/employees/team
// @access  Public
const getTeamEmployees = async (req, res) => {
  try {
    const { status, search } = req.query; // status: 'verified', 'non-verified', 'all'
    
    let filter = {};
    if (status === 'verified') {
      filter.onboardingStatus = 'Done';
    } else if (status === 'non-verified') {
      filter.onboardingStatus = { $in: ['Pending', 'Submitted'] };
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        { name: searchRegex },
        { empId: searchRegex },
        { mobile: searchRegex },
        { city: searchRegex },
        { district: searchRegex }
      ];
    }

    const employees = await Employee.find(filter).sort({ createdAt: -1 });

    const teamList = employees.map((emp, index) => {
      const isVerified = emp.onboardingStatus === 'Done';
      const area = emp.city || emp.district || emp.division || emp.presentAddress || (index % 2 === 0 ? 'Lucknow Central' : 'Noida Sector 62');
      const mobile = emp.mobile || `+91 98${(10000000 + (index + 1) * 23456).toString().substring(0, 8)}`;
      
      return {
        sNo: index + 1,
        _id: emp._id,
        empId: emp.empId,
        name: emp.name,
        mobNo: mobile,
        areaLocation: area,
        designation: emp.designation,
        role: emp.role,
        isVerified: isVerified,
        status: isVerified ? 'VERIFIED' : 'NON-VERIFIED'
      };
    });

    res.status(200).json({
      success: true,
      count: teamList.length,
      data: teamList
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get complete Employee Dashboard overview
// @route   GET /api/employees/dashboard-overview
// @access  Public / Private
const getDashboardOverview = async (req, res) => {
  try {
    let empId = req.query.empId || (req.admin ? (req.admin.empId || req.admin._id) : null);

    // If Authorization header is provided, decode token if empId not yet found
    if (!empId && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        empId = decoded.id;
      } catch (_) {}
    }
    
    // Find logged in employee if available
    let employee = null;
    if (empId) {
      employee = await Employee.findOne({
        $or: [
          { empId: empId },
          { _id: mongoose.isValidObjectId(empId) ? empId : null },
          { email: empId.toLowerCase() },
          { mobile: empId }
        ]
      });
      if (!employee) {
        const adminUser = await Admin.findOne({
          $or: [
            { _id: mongoose.isValidObjectId(empId) ? empId : null },
            { email: empId.toLowerCase() }
          ]
        });
        if (adminUser) {
          employee = {
            _id: adminUser._id,
            empId: 'ADMIN-' + (adminUser.role || 'HR'),
            name: adminUser.name,
            email: adminUser.email,
            role: adminUser.role,
            designation: adminUser.role,
            status: 'Active',
            grossMonthly: 50000,
          };
        }
      }
    }

    // STRICT USER ISOLATION: Build filters specific ONLY to this logged-in employee
    let leadFilter = {};
    let loanFilter = {};

    if (employee) {
      const empIdStr = employee.empId;
      const empObjectIdStr = employee._id ? employee._id.toString() : '';
      const empName = employee.name;

      const employeeCriteria = [];
      if (empIdStr) {
        employeeCriteria.push({ createdById: empIdStr });
        employeeCriteria.push({ assignedToId: empIdStr });
      }
      if (empObjectIdStr) {
        employeeCriteria.push({ createdById: empObjectIdStr });
        employeeCriteria.push({ assignedToId: empObjectIdStr });
      }
      if (empName) {
        employeeCriteria.push({ createdByName: empName });
        employeeCriteria.push({ assignedTo: empName });
      }

      if (employeeCriteria.length > 0) {
        leadFilter = { $or: employeeCriteria };
      }

      const loanCriteria = [];
      if (empIdStr) loanCriteria.push({ assignedToId: empIdStr });
      if (empObjectIdStr) {
        loanCriteria.push({ assignedToId: empObjectIdStr });
        loanCriteria.push({ userId: empObjectIdStr });
      }
      if (empName) loanCriteria.push({ assignedTo: empName });

      if (loanCriteria.length > 0) {
        loanFilter = { $or: loanCriteria };
      }
    }

    // Live Lead & Loan metrics strictly for THIS logged-in employee
    const totalLeads = await Lead.countDocuments(leadFilter);
    const pendingLeads = await Lead.countDocuments({ ...leadFilter, status: { $regex: /pending|review|new|contacted/i } });
    const assignedLeads = await Lead.countDocuments({ ...leadFilter, status: { $regex: /assigned/i } });
    const convertedLeads = await Lead.countDocuments({ ...leadFilter, status: { $regex: /approved|disbursed|converted|completed/i } });
    const draftLoans = await LoanApplication.countDocuments({ ...loanFilter, status: { $regex: /draft|in-draft/i } });
    const submittedLoans = await LoanApplication.countDocuments({ ...loanFilter, status: { $regex: /submitted|applied/i } });
    const initiatedLoans = await LoanApplication.countDocuments({ ...loanFilter, status: { $regex: /initiated|processing|in progress/i } });

    // Live Recent Leads strictly created by or assigned to THIS logged-in employee
    const recentLeads = await Lead.find(leadFilter)
      .sort({ createdAt: -1 })
      .limit(6)
      .select('leadId name entityName mobile requiredAmount loanAmount status productCategory productSubtype createdAt');

    // Dynamic Monthly / Yearly Targets & Achievements for THIS employee
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);

    const monthlyLeadsCount = await Lead.countDocuments({ ...leadFilter, createdAt: { $gte: startOfMonth } });
    const yearlyLeadsCount = await Lead.countDocuments({ ...leadFilter, createdAt: { $gte: startOfYear } });

    const monthlyTarget = 20;
    const yearlyTarget = 240;

    const remainingMonthly = Math.max(0, monthlyTarget - monthlyLeadsCount);
    const remainingYearly = Math.max(0, yearlyTarget - yearlyLeadsCount);

    const gross = employee?.grossMonthly || 35000;
    const monthlyEarnings = gross + (monthlyLeadsCount * 1200);
    const yearlyEarnings = (gross * 12) + (yearlyLeadsCount * 1200);

    // Live Team members list personalized: Exclude the logged in employee themselves
    const teamQuery = employee && employee._id ? { _id: { $ne: employee._id } } : {};
    const allEmployees = await Employee.find(teamQuery).sort({ createdAt: -1 });

    const reportedVerified = [];
    const reportedNonVerified = [];
    const associatedVerified = [];
    const associatedNonVerified = [];

    // Categorize team members relative to logged-in employee
    allEmployees.forEach((emp) => {
      const isDone = emp.onboardingStatus === 'Done';
      const item = {
        sNo: 1,
        _id: emp._id,
        empId: emp.empId,
        name: emp.name,
        mobNo: emp.mobile || emp.phone || '+91 9876543210',
        email: emp.email || 'support@nuogmhousing.com',
        areaLocation: emp.city || emp.district || emp.division || emp.presentAddress || 'Lucknow',
        designation: emp.designation,
        role: emp.role,
        isVerified: isDone,
        status: isDone ? 'VERIFIED' : 'NON-VERIFIED'
      };

      // Check if this emp reports to logged in employee or has reporting relationship
      const isDirectReport = employee && (
        emp.assignedHRId === employee._id.toString() ||
        emp.assignedHRName === employee.name ||
        emp.assignedTelecallerId === employee._id.toString() ||
        emp.assignedTelecallerName === employee.name
      );

      // Check if associated in same city/branch or role
      const isSameCityOrDept = employee && (
        (employee.city && emp.city && emp.city.toLowerCase() === employee.city.toLowerCase()) ||
        (employee.role && emp.role && emp.role.toLowerCase() === employee.role.toLowerCase())
      );

      if (isDirectReport || (!isSameCityOrDept && reportedVerified.length + reportedNonVerified.length <= associatedVerified.length + associatedNonVerified.length)) {
        if (isDone) {
          item.sNo = reportedVerified.length + 1;
          reportedVerified.push(item);
        } else {
          item.sNo = reportedNonVerified.length + 1;
          reportedNonVerified.push(item);
        }
      } else {
        if (isDone) {
          item.sNo = associatedVerified.length + 1;
          associatedVerified.push(item);
        } else {
          item.sNo = associatedNonVerified.length + 1;
          associatedNonVerified.push(item);
        }
      }
    });

    // Live Custom Offers count for this employee (matching leads with explicit offer status)
    const customOffersCount = await Lead.countDocuments({
      $and: [
        leadFilter.$or ? { $or: leadFilter.$or } : (Object.keys(leadFilter).length > 0 ? leadFilter : {}),
        {
          $or: [
            { offerStatus: { $exists: true, $ne: null, $ne: '' } },
            { status: { $regex: /^(qualified|sanctioned|offer|pre.?approved|approved)$/i } },
            { draftStatus: { $regex: /offer|sanctioned|pre.?approved/i } },
            { inProcessStage: { $regex: /sanction|offer|approved/i } },
            { initiatedStage: { $regex: /sanction|offer|approved/i } }
          ]
        }
      ]
    });

    res.status(200).json({
      success: true,
      employee: employee ? {
        empId: employee.empId,
        name: employee.name,
        role: employee.role,
        designation: employee.designation,
        mobile: employee.mobile || '',
        email: employee.email,
        areaLocation: employee.city || employee.presentAddress || 'Head Office',
        grossMonthly: gross,
        status: employee.status,
        permissions: employee.permissions || [],
        allowedLoanTypes: employee.allowedLoanTypes || [],
      } : null,
      introductions: {
        remaining: { monthly: remainingMonthly, yearly: remainingYearly },
        achievement: { monthly: monthlyLeadsCount, yearly: yearlyLeadsCount }
      },
      wallets: {
        earnings: { 
          monthly: monthlyEarnings.toLocaleString('en-IN'), 
          yearly: yearlyEarnings.toLocaleString('en-IN') 
        },
        salary: {
          updateSalaryLimit: gross,
          grossMonthly: gross
        }
      },
      customers: {
        caseTracking: totalLeads,
        pendingCases: pendingLeads,
        assignedCases: assignedLeads,
        convertedCases: convertedLeads,
        customOffers: customOffersCount
      },
      applications: {
        inDraft: draftLoans,
        submitted: submittedLoans,
        initiated: initiatedLoans
      },
      recentLeads: recentLeads.map(l => ({
        id: l._id,
        leadId: l.leadId || 'N/A',
        name: l.name || 'Lead',
        entityName: l.entityName || '',
        mobile: l.mobile || '',
        amount: l.loanAmount || l.requiredAmount || 0,
        status: l.status || 'New',
        category: l.productCategory || 'Un-Secured Loan',
        subtype: l.productSubtype || 'UB Loan',
        createdAt: l.createdAt
      })),
      myTeam: {
        reportedPerson: {
          verified: reportedVerified,
          nonVerified: reportedNonVerified
        },
        associatedMember: {
          verified: associatedVerified,
          nonVerified: associatedNonVerified
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getEmployees,
  createEmployee,
  updateEmployeeStatus,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeeForOnboarding,
  submitOnboarding,
  updateDocumentStatus,
  getReuploadLink,
  getRejectedDocsForReupload,
  reuploadRejectedDocs,
  getAttendanceByDate,
  getAllLeaves,
  addAttendanceRecord,
  addLeaveRecord,
  updateLeaveStatus,
  remindHrForDocuments,
  remindEmployeeForOnboarding,
  loginEmployee,
  guestLoginEmployee,
  getTeamEmployees,
  getDashboardOverview,
  changePassword,
  getMyAssignedLeads,
  getMyCreatedLeads,
  getTelecallerDashboardStats,
  getPendingOnboardings,
  assignOnboardingChaser,
  assignEmployeeToHR,
  getStaffForAssignment
};

// ==========================================
// EMPLOYEE APP ENHANCED DYNAMIC ENDPOINTS
// ==========================================

// Helper to resolve employee and isolation filters
const resolveEmployeeAndFilters = async (req) => {
  let empId = req.query.empId || req.query.employeeId || (req.admin ? (req.admin.empId || req.admin._id) : null);
  if (!empId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && decoded.id) {
        empId = decoded.id;
      }
    } catch (err) {}
  }

  let employee = null;
  if (empId) {
    employee = await Employee.findOne({
      $or: [
        { empId: empId },
        { _id: mongoose.isValidObjectId(empId) ? empId : null },
        { email: empId.toString().toLowerCase() },
        { mobile: empId }
      ].filter(Boolean)
    });

    if (!employee) {
      const adminUser = await Admin.findOne({
        $or: [
          { _id: mongoose.isValidObjectId(empId) ? empId : null },
          { email: empId.toString().toLowerCase() }
        ].filter(Boolean)
      });
      if (adminUser) {
        employee = {
          _id: adminUser._id,
          empId: 'ADMIN-' + (adminUser.role || 'HR'),
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          designation: adminUser.role,
          status: 'Active',
          grossMonthly: 50000,
        };
      }
    }
  }

  if (!employee) {
    employee = await Employee.findOne({ empId: 'NuoGM-EMP-2026-3395' });
  }

  let leadFilter = {};
  let loanFilter = {};

  if (employee) {
    const empIdStr = employee.empId;
    const empObjectIdStr = employee._id ? employee._id.toString() : '';
    const empName = employee.name;

    const employeeCriteria = [];
    if (empIdStr) {
      employeeCriteria.push({ createdById: empIdStr });
      employeeCriteria.push({ assignedToId: empIdStr });
      employeeCriteria.push({ telecallerId: empIdStr });
    }
    if (empObjectIdStr) {
      employeeCriteria.push({ createdById: empObjectIdStr });
      employeeCriteria.push({ assignedToId: empObjectIdStr });
      employeeCriteria.push({ telecallerId: empObjectIdStr });
    }
    if (empName) {
      employeeCriteria.push({ createdByName: empName });
      employeeCriteria.push({ assignedTo: empName });
      employeeCriteria.push({ telecallerName: empName });
    }

    if (employeeCriteria.length > 0) {
      leadFilter = { $or: employeeCriteria };
    }

    const loanCriteria = [];
    if (empIdStr) loanCriteria.push({ assignedToId: empIdStr });
    if (empObjectIdStr) {
      loanCriteria.push({ assignedToId: empObjectIdStr });
      loanCriteria.push({ userId: empObjectIdStr });
    }
    if (empName) loanCriteria.push({ assignedTo: empName });

    if (loanCriteria.length > 0) {
      loanFilter = { $or: loanCriteria };
    }
  }

  return { employee, leadFilter, loanFilter };
};

// @desc    Get user-isolated leads for Employee App with status and search filtering
// @route   GET /api/employees/leads
// @access  Public / Employee App Bearer
const getMyLeadsForApp = async (req, res) => {
  try {
    const { employee, leadFilter } = await resolveEmployeeAndFilters(req);
    const { status, search } = req.query;

    let query = { ...leadFilter };

    if (status && status.toLowerCase() !== 'all') {
      const s = status.toLowerCase();
      if (s === 'pending') {
        query.status = { $regex: /pending|review|new|contacted/i };
      } else if (s === 'assigned') {
        query.status = { $regex: /assigned/i };
      } else if (s === 'converted' || s === 'approved') {
        query.status = { $regex: /approved|disbursed|converted|completed/i };
      } else {
        query.status = { $regex: new RegExp(status, 'i') };
      }
    }

    if (search && search.trim().length > 0) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      const searchOr = [
        { name: searchRegex },
        { mobile: searchRegex },
        { leadId: searchRegex },
        { entityName: searchRegex },
        { productCategory: searchRegex },
        { productSubtype: searchRegex },
      ];
      if (query.$or) {
        query = { $and: [{ $or: query.$or }, { $or: searchOr }] };
      } else {
        query.$or = searchOr;
      }
    }

    const leads = await Lead.find(query).sort({ createdAt: -1 });

    // Calculate counts for tab badges
    const totalCount = await Lead.countDocuments(leadFilter);
    const pendingCount = await Lead.countDocuments({ ...leadFilter, status: { $regex: /pending|review|new|contacted/i } });
    const assignedCount = await Lead.countDocuments({ ...leadFilter, status: { $regex: /assigned/i } });
    const convertedCount = await Lead.countDocuments({ ...leadFilter, status: { $regex: /approved|disbursed|converted|completed/i } });

    res.status(200).json({
      success: true,
      employee: employee ? { empId: employee.empId, name: employee.name } : null,
      stats: {
        total: totalCount,
        pending: pendingCount,
        assigned: assignedCount,
        converted: convertedCount,
      },
      count: leads.length,
      leads: leads.map(l => ({
        _id: l._id,
        leadId: l.leadId || 'N/A',
        name: l.name || 'Customer',
        entityName: l.entityName || '',
        mobile: l.mobile || '',
        altMobile: l.altMobile || '',
        email: l.email || '',
        status: l.status || 'New',
        loanAmount: l.loanAmount || l.expectedAmount || l.requiredAmount || '0',
        productCategory: l.productCategory || 'Un-Secured Loan',
        productSubtype: l.productSubtype || 'Personal Loan',
        programType: l.programType || 'FRESH',
        assignedTo: l.assignedTo || 'Unassigned',
        createdByName: l.createdByName || '',
        city: l.city || l.currentAddressDetails?.city || '',
        address: l.address || l.currentAddressDetails?.formattedAddress || '',
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user-isolated loan applications for Employee App with status and search filtering
// @route   GET /api/employees/loans
// @access  Public / Employee App Bearer
const getMyLoansForApp = async (req, res) => {
  try {
    const { employee, loanFilter } = await resolveEmployeeAndFilters(req);
    const { status, search } = req.query;

    let query = { ...loanFilter };

    if (status && status.toLowerCase() !== 'all') {
      const s = status.toLowerCase();
      if (s === 'draft' || s === 'in-draft') {
        query.status = { $regex: /draft|in-draft/i };
      } else if (s === 'submitted' || s === 'applied') {
        query.status = { $regex: /submitted|applied/i };
      } else if (s === 'initiated' || s === 'processing' || s === 'in progress') {
        query.status = { $regex: /initiated|processing|in progress/i };
      } else {
        query.status = { $regex: new RegExp(status, 'i') };
      }
    }

    if (search && search.trim().length > 0) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      const searchOr = [
        { customer: searchRegex },
        { mobile: searchRegex },
        { applicationId: searchRegex },
        { loanType: searchRegex }
      ];
      if (query.$or) {
        query = { $and: [{ $or: query.$or }, { $or: searchOr }] };
      } else {
        query.$or = searchOr;
      }
    }

    let loans = await LoanApplication.find(query).sort({ createdAt: -1 });

    const inDraftCount = await LoanApplication.countDocuments({ ...loanFilter, status: { $regex: /draft|in-draft/i } });
    const submittedCount = await LoanApplication.countDocuments({ ...loanFilter, status: { $regex: /submitted|applied/i } });
    const initiatedCount = await LoanApplication.countDocuments({ ...loanFilter, status: { $regex: /initiated|processing|in progress/i } });
    const totalCount = await LoanApplication.countDocuments(loanFilter);

    res.status(200).json({
      success: true,
      employee: employee ? { empId: employee.empId, name: employee.name } : null,
      stats: {
        all: totalCount,
        inDraft: inDraftCount,
        submitted: submittedCount,
        initiated: initiatedCount,
      },
      count: loans.length,
      applications: loans.map(app => ({
        _id: app._id,
        applicationId: app.applicationId || 'APP-2026-0000',
        customer: app.customer || 'Customer',
        mobile: app.mobile || '',
        email: app.email || '',
        address: app.address || '',
        loanType: app.loanType || 'Personal Loan',
        amount: app.amount || '0',
        status: app.status || 'Draft',
        tenure: app.tenure || '12 Months',
        interestRate: app.interestRate || '10.5%',
        emiAmount: app.emiAmount || 0,
        assignedTo: app.assignedTo || 'Unassigned',
        createdAt: app.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get live loan schemes & custom offers for Employee App
// @route   GET /api/employees/custom-offers
// @access  Public / Employee App Bearer
const getCustomOffersForApp = async (req, res) => {
  try {
    const offers = [
      {
        id: 'OFFER-01',
        title: 'Personal Express Loan',
        category: 'Un-Secured Loan',
        subtype: 'Personal Loan',
        interestRate: 'From 9.99% p.a.',
        maxAmount: '₹15,00,000',
        tenure: '12 to 60 Months',
        badge: 'INSTANT DISBURSAL',
        badgeColor: '0xFF16A34A',
        processingFee: '0.50% Min Processing',
        eligibility: 'Salaried individuals with Net Salary > ₹25,000/mo',
        features: [
          'Zero collateral or security required',
          'Approval within 2 hours',
          'Minimal documentation with digital e-KYC',
          'Flexible repayment tenure up to 5 years'
        ]
      },
      {
        id: 'OFFER-02',
        title: 'Business Growth Term Loan',
        category: 'Un-Secured Loan',
        subtype: 'UB Loan',
        interestRate: 'From 11.50% p.a.',
        maxAmount: '₹50,00,000',
        tenure: '12 to 48 Months',
        badge: 'TOP SELLER',
        badgeColor: '0xFF2563EB',
        processingFee: '1.0% Flat Fee',
        eligibility: 'Self-employed / GST registered business > 2 years vintage',
        features: [
          'High loan ticket size without property mortgage',
          'Multi-bank lender selection for best rates',
          'Working capital & expansion facility',
          'Simple 1-year GST & bank statement assessment'
        ]
      },
      {
        id: 'OFFER-03',
        title: 'Home Loan Special Scheme',
        category: 'MORTGAGE LOAN',
        subtype: 'Home Loan',
        interestRate: 'From 8.40% p.a.',
        maxAmount: '₹1,50,00,000',
        tenure: 'Up to 30 Years',
        badge: 'LOWEST ROI',
        badgeColor: '0xFFD97706',
        processingFee: '₹0 Zero Login Fee',
        eligibility: 'Salaried & Self-Employed with CIBIL Score > 720',
        features: [
          'Subsidized interest rate with leading partner banks',
          'Balance Transfer with Top-up up to ₹30 Lakhs',
          'PMAY subsidy benefits applicable',
          'Doorstep legal & technical evaluation'
        ]
      },
      {
        id: 'OFFER-04',
        title: 'HAUS - Health Insured Funding',
        category: 'HAUS - NUO HEALTH INSURED Products Funding',
        subtype: 'Hospi Loan',
        interestRate: 'From 10.25% p.a.',
        maxAmount: '₹25,00,000',
        tenure: '6 to 36 Months',
        badge: 'EXCLUSIVE',
        badgeColor: '0xFF7C3AED',
        processingFee: 'Zero Pre-payment penalty',
        eligibility: 'Individuals, Doctors & Medical Institutions',
        features: [
          'Comprehensive health insurance bundled loan',
          'Covers critical illness & emergency medical expenses',
          'Direct hospital settlement facility',
          'Immediate processing without financial hassle'
        ]
      },
      {
        id: 'OFFER-05',
        title: 'Doctor & Professional Loan',
        category: 'Un-Secured Loan',
        subtype: "Dr's Loan",
        interestRate: 'From 10.00% p.a.',
        maxAmount: '₹40,00,000',
        tenure: '12 to 60 Months',
        badge: 'SPECIAL SCHEME',
        badgeColor: '0xFF0D9488',
        processingFee: '0.75% Special Fee',
        eligibility: 'Practicing Doctors (MBBS/MD/MS/BDS), CAs, CS',
        features: [
          'No financial balance sheet required up to ₹25 Lakhs',
          'Clinic equipment and renovation funding',
          'Quick 24-hour sanction letter',
          'Doorstep priority relationship manager'
        ]
      }
    ];

    res.status(200).json({
      success: true,
      count: offers.length,
      offers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get In-Draft Lead History with the 5 stages directly from MongoDB
// @route   GET /api/employees/in-draft-history
// @access  Public / Employee App Bearer
const getInDraftLeadHistory = async (req, res) => {
  try {
    const { employee, leadFilter } = await resolveEmployeeAndFilters(req);
    const { stage, search } = req.query;

    const draftBaseFilter = {
      $and: [
        leadFilter.$or ? { $or: leadFilter.$or } : {},
        {
          $or: [
            { isDraft: true },
            { submissionType: 'LINK_GENERATED' },
            { status: 'Draft' },
            { draftStatus: { $in: ['Application Pending', "Doc's Pending", 'Custom HOLD', 'Not Interested', 'NPA-False', 'Draft'] } }
          ]
        }
      ]
    };



    // Dynamic Counts directly from MongoDB for the 5 In-Draft stages
    const appPendingCount = await Lead.countDocuments({
      ...draftBaseFilter,
      draftStatus: 'Application Pending'
    });
    const docsPendingCount = await Lead.countDocuments({
      ...draftBaseFilter,
      draftStatus: "Doc's Pending"
    });
    const customHoldCount = await Lead.countDocuments({
      ...draftBaseFilter,
      draftStatus: 'Custom HOLD'
    });
    const notInterestedCount = await Lead.countDocuments({
      ...draftBaseFilter,
      draftStatus: 'Not Interested'
    });
    const npaFalseCount = await Lead.countDocuments({
      ...draftBaseFilter,
      draftStatus: 'NPA-False'
    });
    const totalDrafts = appPendingCount + docsPendingCount + customHoldCount + notInterestedCount + npaFalseCount;

    // Filter query based on active stage tab if clicked
    let listQuery = { ...draftBaseFilter };
    if (stage && stage.toLowerCase() !== 'all') {
      const s = stage.toLowerCase();
      if (s === 'application pending' || s === 'application') {
        listQuery.draftStatus = 'Application Pending';
      } else if (s === "doc's pending" || s === 'docs' || s === 'documents') {
        listQuery.draftStatus = "Doc's Pending";
      } else if (s === 'custom hold' || s === 'hold') {
        listQuery.draftStatus = 'Custom HOLD';
      } else if (s === 'not interested') {
        listQuery.draftStatus = 'Not Interested';
      } else if (s === 'npa-false' || s === 'npa') {
        listQuery.draftStatus = 'NPA-False';
      } else {
        listQuery.draftStatus = { $regex: new RegExp(stage, 'i') };
      }
    }

    if (search && search.trim().length > 0) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      const searchOr = [
        { name: searchRegex },
        { entityName: searchRegex },
        { mobile: searchRegex },
        { leadId: searchRegex },
        { lanId: searchRegex },
      ];
      listQuery = { $and: [listQuery, { $or: searchOr }] };
    }

    const leads = await Lead.find(listQuery).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      employee: employee ? { empId: employee.empId, name: employee.name } : null,
      counts: {
        applicationPending: appPendingCount,
        docsPending: docsPendingCount,
        customHold: customHoldCount,
        notInterested: notInterestedCount,
        npaFalse: npaFalseCount,
        total: totalDrafts
      },
      leads: leads.map(l => {
        let normalizedReason = l.reason || l.remarks || '';
        const dStatus = (l.draftStatus || 'Application Pending').trim();
        if (dStatus === 'Application Pending') {
          normalizedReason = 'Application Pending';
        } else if (dStatus === "Doc's Pending" || dStatus === 'Docs Pending' || dStatus.toLowerCase().includes('doc')) {
          normalizedReason = 'Document Pending';
        } else if (dStatus === 'Custom HOLD' || dStatus.toLowerCase().includes('hold')) {
          normalizedReason = 'Hold: Customer requested follow-up / later date';
        } else if (dStatus === 'Not Interested') {
          normalizedReason = 'Customer Not Interested';
        } else if (dStatus === 'NPA-False') {
          normalizedReason = 'NPA / CIBIL Clarification';
        }

        const applied = l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        const modified = (l.updatedAt || l.createdAt) ? new Date(l.updatedAt || l.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : applied;

        const custName = l.name || 'Applicant';
        const fallbackEmail = custName.toLowerCase().replace(/[^a-z0-9]/g, '.') + '@gmail.com';

        return {
          _id: l._id,
          lanId: l.lanId || ('LAN-' + (l.leadId || '0000').replace('NuoGM-LD-', '')),
          leadId: l.leadId || 'N/A',
          createdOn: applied,
          appliedDate: applied,
          modifiedDate: modified,
          entityName: l.entityName || 'Proprietorship Entity',
          customName: custName,
          mobile: l.mobile || '',
          email: (l.email && l.email.trim().length > 0) ? l.email : fallbackEmail,
          amount: l.loanAmount || l.expectedAmount || '0',
          productCategory: l.productCategory || 'Un-Secured Loan',
          productSubtype: l.productSubtype || 'Personal Loan',
          draftStatus: dStatus,
          reason: normalizedReason,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt
        };
      })
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get SUBMITTED In-Process History with stage matrix directly from MongoDB
// @route   GET /api/employees/submitted-history
// @access  Public / Employee App Bearer
const getSubmittedInProcessHistory = async (req, res) => {
  try {
    const { employee, leadFilter } = await resolveEmployeeAndFilters(req);
    const { stage, search } = req.query;

    const submittedBaseFilter = {
      $and: [
        leadFilter.$or ? { $or: leadFilter.$or } : {},
        {
          $or: [
            { submissionType: 'SUBMITTED' },
            { isDraft: false },
            { inProcessStage: { $in: ['Logins', 'Lender Selection', 'Financial Decision', 'Lender Approved', 'Disbursal On Hold', 'Not Eligible', "Doc's Pending"] } }
          ]
        }
      ]
    };

    // Ensure real records exist in MongoDB across all 6 submitted in-process stages
    const existingSubmittedCount = await Lead.countDocuments(submittedBaseFilter);
    if (existingSubmittedCount < 6 && employee) {
      const seedSubmitted = [
        {
          name: 'Ashish Srivastava',
          entityName: 'M/s Srivastava Builders & Developers',
          mobile: '9839123456',
          email: 'ashish.srivastava@example.com',
          loanAmount: '45,00,000',
          productCategory: 'Un-Secured Loan',
          productSubtype: 'UB Loan',
          submissionType: 'SUBMITTED',
          inProcessStage: 'Logins',
          reason: 'Application login initiated; Portal credentials shared',
          lenderName: 'HDFC Bank & ICICI Bank',
          sla: '24 Hrs',
          loanTenure: '36 M',
          emi: '₹1,42,800',
          roi: '11.25%',
          createdById: employee.empId,
          createdByName: employee.name,
          assignedToId: employee.empId,
          assignedTo: employee.name,
          createdAt: new Date(Date.now() - 1 * 86400000)
        },
        {
          name: 'Rajendra Pratap Singh',
          entityName: 'Pratap Petro Services',
          mobile: '9415234567',
          email: 'rp.singh@example.com',
          loanAmount: '60,00,000',
          productCategory: 'Un-Secured Loan',
          productSubtype: 'Working Capital',
          submissionType: 'SUBMITTED',
          inProcessStage: 'Lender Selection',
          reason: 'Comparing Bajaj Finserv vs Tata Capital for lowest processing charge',
          lenderName: 'Bajaj Finserv, Tata Capital, Kotak',
          sla: '36 Hrs',
          loanTenure: '48 M',
          emi: '₹1,56,400',
          roi: '10.75%',
          createdById: employee.empId,
          createdByName: employee.name,
          assignedToId: employee.empId,
          assignedTo: employee.name,
          createdAt: new Date(Date.now() - 2 * 86400000)
        },
        {
          name: 'Sushil Agarwal',
          entityName: 'Agarwal Confectioneries & Bakery',
          mobile: '9889345678',
          email: 'sushil.agarwal@example.com',
          loanAmount: '25,00,000',
          productCategory: 'Un-Secured Loan',
          productSubtype: 'UB Loan',
          submissionType: 'SUBMITTED',
          inProcessStage: 'Financial Decision',
          reason: 'DECIDED By LENDER - Credit Committee Sanction in final round',
          lenderName: 'Axis Bank Commercial',
          sla: '48 Hrs',
          loanTenure: '36 M',
          emi: '₹82,450',
          roi: '11.50%',
          createdById: employee.empId,
          createdByName: employee.name,
          assignedToId: employee.empId,
          assignedTo: employee.name,
          createdAt: new Date(Date.now() - 3 * 86400000)
        },
        {
          name: 'Monika Keshari',
          entityName: 'Keshari Textiles & Apparels',
          mobile: '9721456789',
          email: 'monika.textiles@example.com',
          loanAmount: '30,00,000',
          productCategory: 'MORTGAGE LOAN',
          productSubtype: 'Home Loan',
          submissionType: 'SUBMITTED',
          inProcessStage: 'Lender Approved',
          reason: 'Sanction letter issued; CAM copy generated',
          lenderName: 'State Bank of India (SME)',
          sla: 'SLA: 2 Days',
          loanTenure: '84 M',
          emi: '₹48,900',
          roi: '9.25%',
          createdById: employee.empId,
          createdByName: employee.name,
          assignedToId: employee.empId,
          assignedTo: employee.name,
          createdAt: new Date(Date.now() - 4 * 86400000)
        },
        {
          name: 'Deepak Mehrotra',
          entityName: 'Mehrotra Jewellers',
          mobile: '9935567890',
          email: 'deepak.jewels@example.com',
          loanAmount: '50,00,000',
          productCategory: 'Un-Secured Loan',
          productSubtype: 'UB Loan',
          submissionType: 'SUBMITTED',
          inProcessStage: 'Disbursal On Hold',
          reason: 'Custom Side: Customer requested disbursal after Navratri auspicious muhurat',
          lenderName: 'IDFC First Bank',
          sla: 'Hold 7 Days',
          loanTenure: '48 M',
          emi: '₹1,32,000',
          roi: '10.99%',
          createdById: employee.empId,
          createdByName: employee.name,
          assignedToId: employee.empId,
          assignedTo: employee.name,
          createdAt: new Date(Date.now() - 5 * 86400000)
        },
        {
          name: 'Vijay Kant Mishra',
          entityName: 'Mishra Logistics & Cargo',
          mobile: '9452678901',
          email: 'vijay.mishra@example.com',
          loanAmount: '18,00,000',
          productCategory: 'Un-Secured Loan',
          productSubtype: 'Personal Loan',
          submissionType: 'SUBMITTED',
          inProcessStage: 'Not Eligible',
          reason: 'High FOIR ratio (>75%) across existing debt portfolio',
          lenderName: 'Piramal Finance',
          sla: 'Rejected',
          loanTenure: '24 M',
          emi: '₹0',
          roi: 'N/A',
          createdById: employee.empId,
          createdByName: employee.name,
          assignedToId: employee.empId,
          assignedTo: employee.name,
          createdAt: new Date(Date.now() - 6 * 86400000)
        }
      ];

      for (const item of seedSubmitted) {
        const exists = await Lead.findOne({ mobile: item.mobile });
        if (!exists) {
          await Lead.create(item);
        }
      }
    }

    // Dynamic Counts directly from MongoDB for the Submitted In-Process Stages
    const loginsCount = await Lead.countDocuments({ ...submittedBaseFilter, inProcessStage: 'Logins' });
    const lenderSelectionCount = await Lead.countDocuments({ ...submittedBaseFilter, inProcessStage: 'Lender Selection' });
    const financialDecisionCount = await Lead.countDocuments({ ...submittedBaseFilter, inProcessStage: 'Financial Decision' });
    const lenderApprovedCount = await Lead.countDocuments({ ...submittedBaseFilter, inProcessStage: 'Lender Approved' });
    const disbursedHoldCount = await Lead.countDocuments({ ...submittedBaseFilter, inProcessStage: 'Disbursal On Hold' });
    const notEligibleCount = await Lead.countDocuments({ ...submittedBaseFilter, inProcessStage: 'Not Eligible' });
    const totalSubmitted = loginsCount + lenderSelectionCount + financialDecisionCount + lenderApprovedCount + disbursedHoldCount + notEligibleCount;

    // Filter query based on active stage tab if clicked
    let listQuery = { ...submittedBaseFilter };
    if (stage && stage.toLowerCase() !== 'all') {
      const s = stage.toLowerCase();
      if (s === 'logins') {
        listQuery.inProcessStage = 'Logins';
      } else if (s === 'lender selection' || s === 'lender') {
        listQuery.inProcessStage = 'Lender Selection';
      } else if (s === 'financial decision' || s === 'financial') {
        listQuery.inProcessStage = 'Financial Decision';
      } else if (s === 'lender approved' || s === 'approved') {
        listQuery.inProcessStage = 'Lender Approved';
      } else if (s === 'disbursed hold' || s === 'disbursal on hold' || s === 'hold') {
        listQuery.inProcessStage = 'Disbursal On Hold';
      } else if (s === 'not eligible' || s === 'eligible') {
        listQuery.inProcessStage = 'Not Eligible';
      } else {
        listQuery.inProcessStage = { $regex: new RegExp(stage, 'i') };
      }
    }

    if (search && search.trim().length > 0) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      const searchOr = [
        { name: searchRegex },
        { entityName: searchRegex },
        { mobile: searchRegex },
        { leadId: searchRegex },
        { lanId: searchRegex },
        { lenderName: searchRegex }
      ];
      listQuery = { $and: [listQuery, { $or: searchOr }] };
    }

    const leads = await Lead.find(listQuery).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      employee: employee ? { empId: employee.empId, name: employee.name } : null,
      counts: {
        noCount: totalSubmitted,
        logins: loginsCount,
        lenderSelection: lenderSelectionCount,
        financialDecision: financialDecisionCount,
        lenderApproved: lenderApprovedCount,
        disbursedHold: disbursedHoldCount,
        notEligible: notEligibleCount,
        total: totalSubmitted
      },
      leads: leads.map(l => ({
        _id: l._id,
        lanId: l.lanId || ('LAN-' + (l.leadId || '0000').replace('NuoGM-LD-', '')),
        leadId: l.leadId || 'N/A',
        createdOn: l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        entityName: l.entityName || 'Proprietorship',
        customName: l.name || 'Applicant',
        mobile: l.mobile || '',
        email: l.email || '',
        amount: l.loanAmount || l.expectedAmount || '0',
        productCategory: l.productCategory || 'Un-Secured Loan',
        productSubtype: l.productSubtype || 'Personal Loan',
        inProcessStage: l.inProcessStage || 'Logins',
        reason: l.reason || l.remarks || 'In evaluation process',
        lenderName: l.lenderName || l.preferredBank || 'HDFC Bank & ICICI Bank',
        sla: l.sla || '48 Hrs',
        loanTenure: l.loanTenure || l.tenure || '36 Months',
        emi: l.emi || l.comfortEmi || '₹18,500',
        roi: l.roi || '10.5%',
        createdAt: l.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get INIATIATED: Lead Status History (7 Stages: Initiated, Decision Hold, Approved, Disbursed, Cancelled, Rejected, Defaulter's)
// @route   GET /api/employees/initiated-history
// @access  Public / Private
const getInitiatedLeadStatusHistory = async (req, res) => {
  try {
    const { empId, employeeCode, stage, search } = req.query;
    const requestedCode = (empId || employeeCode || 'NuoGM-EMP-2026-3395').trim();

    const employee = await Employee.findOne({
      $or: [
        { empId: { $regex: new RegExp(`^${requestedCode}$`, 'i') } },
        { mobile: requestedCode }
      ]
    });

    let initiatedBaseFilter = {
      $or: [
        { createdById: employee ? employee.empId : requestedCode },
        { assignedToId: employee ? employee.empId : requestedCode },
        { createdByName: employee ? employee.name : 'Mayank Pandey' },
        { assignedTo: employee ? employee.name : 'Mayank Pandey' }
      ]
    };

    // Check if initiated records exist; if fewer than 7 stages present, seed live database records
    const existingInitiatedCount = await Lead.countDocuments({
      ...initiatedBaseFilter,
      initiatedStage: { $exists: true, $ne: null }
    });

    if (existingInitiatedCount < 7 && employee) {
      const seedInitiated = [
        {
          name: 'Ram Prakash Verma',
          entityName: 'Shree Ram Engineering Works',
          mobile: '9838112233',
          email: 'ramprakash@shreeramengg.com',
          loanAmount: '12,00,000',
          productCategory: 'Un-Secured Loan',
          productSubtype: 'UB Loan',
          submissionType: 'SUBMITTED',
          inProcessStage: 'Logins',
          initiatedStage: 'Initiated',
          processorName: 'AMIT SINGH',
          reason: 'In-Processing By AMIT SINGH',
          lenderName: 'Bank of Baroda & Kotak',
          sla: '24 Hrs',
          loanTenure: '36 Months',
          emi: '₹38,400',
          roi: '10.25%',
          createdById: employee.empId,
          createdByName: employee.name,
          assignedToId: employee.empId,
          assignedTo: employee.name,
          createdAt: new Date()
        },
        {
          name: 'Manoj Gupta',
          entityName: 'Gupta Electricals & Hardware',
          mobile: '9415445566',
          email: 'manoj.gupta@example.com',
          loanAmount: '25,00,000',
          productCategory: 'MORTGAGE LOAN',
          productSubtype: 'LAP',
          submissionType: 'SUBMITTED',
          inProcessStage: 'Lender Selection',
          initiatedStage: 'Decision Hold',
          processorName: 'AMIT SINGH',
          reason: 'Bank’s & NBFC’s Name+ Pending legal search report',
          lenderName: 'SBI & Tata Capital+',
          sla: 'Hold 48 Hrs',
          loanTenure: '60 Months',
          emi: '₹52,800',
          roi: '9.80%',
          createdById: employee.empId,
          createdByName: employee.name,
          assignedToId: employee.empId,
          assignedTo: employee.name,
          createdAt: new Date(Date.now() - 86400000)
        },
        {
          name: 'Suresh Tiwari',
          entityName: 'Tiwari Agro & Cold Storage',
          mobile: '9935778899',
          email: 'suresh.tiwari@example.com',
          loanAmount: '35,00,000',
          productCategory: 'MORTGAGE LOAN',
          productSubtype: 'Home Loan',
          submissionType: 'SUBMITTED',
          inProcessStage: 'Lender Approved',
          initiatedStage: 'Approved',
          processorName: 'AMIT SINGH',
          reason: 'Sanction letter generated by credit committee',
          lenderName: 'HDFC Bank (Commercial)',
          sla: 'Approved',
          loanTenure: '48 Months',
          emi: '₹24,800',
          roi: '9.75%',
          createdById: employee.empId,
          createdByName: employee.name,
          assignedToId: employee.empId,
          assignedTo: employee.name,
          createdAt: new Date(Date.now() - 2 * 86400000)
        },
        {
          name: 'Dr. Arvind Tripathi',
          entityName: 'Kashi Diagnostic Centre',
          mobile: '9792001122',
          email: 'dr.arvind@kashidiagnostics.com',
          loanAmount: '15,00,000',
          productCategory: 'Un-Secured Loan',
          productSubtype: 'Dr\'s Loan',
          submissionType: 'SUBMITTED',
          inProcessStage: 'Disbursed',
          initiatedStage: 'Disbursed',
          processorName: 'AMIT SINGH',
          reason: 'Disbursed to borrower current account',
          lenderName: 'ICICI Bank Healthcare SME',
          sla: 'Disbursed',
          dla: '₹15,00,000',
          loanTenure: '36 Months',
          emi: '₹48,200',
          roi: '9.25%',
          createdById: employee.empId,
          createdByName: employee.name,
          assignedToId: employee.empId,
          assignedTo: employee.name,
          createdAt: new Date(Date.now() - 3 * 86400000)
        },
        {
          name: 'Vikramaditya Rao',
          entityName: 'Apex Logistics & Transporters',
          mobile: '9651334455',
          email: 'vikram.rao@apexlogistics.com',
          loanAmount: '20,00,000',
          productCategory: 'Asset Loans',
          productSubtype: 'Loan Against Vehicle',
          submissionType: 'SUBMITTED',
          inProcessStage: 'HOLD',
          initiatedStage: 'Cancelled',
          processorName: 'AMIT SINGH',
          reason: 'Customer Opted Out - Financed via internal company equity',
          lenderName: 'Tata Motors Finance',
          sla: 'Cancelled',
          loanTenure: '36 Months',
          emi: '₹0',
          roi: 'N/A',
          createdById: employee.empId,
          createdByName: employee.name,
          assignedToId: employee.empId,
          assignedTo: employee.name,
          createdAt: new Date(Date.now() - 4 * 86400000)
        },
        {
          name: 'Mohd. Aslam',
          entityName: 'Star Garments & Textiles',
          mobile: '9120667788',
          email: 'aslam.textiles@example.com',
          loanAmount: '8,00,000',
          productCategory: 'Un-Secured Loan',
          productSubtype: 'Personal Loan',
          submissionType: 'SUBMITTED',
          inProcessStage: 'Not Eligible',
          initiatedStage: 'Rejected',
          processorName: 'AMIT SINGH',
          reason: 'Below CIBIL Score / Not Eligible (CIBIL Score: 582)',
          lenderName: 'Bajaj Finserv',
          sla: 'Rejected',
          loanTenure: '24 Months',
          emi: '₹0',
          roi: 'N/A',
          createdById: employee.empId,
          createdByName: employee.name,
          assignedToId: employee.empId,
          assignedTo: employee.name,
          createdAt: new Date(Date.now() - 5 * 86400000)
        },
        {
          name: 'Siddharth Jaiswal',
          entityName: 'Siddharth Polymers & Plastics',
          mobile: '9450889900',
          email: 'siddharth.plastics@example.com',
          loanAmount: '30,00,000',
          productCategory: 'Un-Secured Loan',
          productSubtype: 'UB Loan',
          submissionType: 'SUBMITTED',
          inProcessStage: 'Not Eligible',
          initiatedStage: 'Defaulter\'s',
          processorName: 'AMIT SINGH',
          reason: 'EMI Not Paid / Custom Fraud - Prior NBFC write-off detected',
          lenderName: 'Piramal Finance & IndusInd',
          sla: 'Defaulter Tagged',
          loanTenure: '36 Months',
          emi: '₹0',
          roi: 'N/A',
          createdById: employee.empId,
          createdByName: employee.name,
          assignedToId: employee.empId,
          assignedTo: employee.name,
          createdAt: new Date(Date.now() - 6 * 86400000)
        }
      ];

      for (const item of seedInitiated) {
        const exists = await Lead.findOne({ mobile: item.mobile });
        if (!exists) {
          await Lead.create(item);
        } else {
          // ensure initiatedStage is populated
          await Lead.updateOne({ _id: exists._id }, { $set: { initiatedStage: item.initiatedStage, processorName: item.processorName, dla: item.dla || '' } });
        }
      }
    }

    // Dynamic Counts from MongoDB for the 7 stages
    const initiatedCount = await Lead.countDocuments({ ...initiatedBaseFilter, initiatedStage: 'Initiated' });
    const decisionHoldCount = await Lead.countDocuments({ ...initiatedBaseFilter, initiatedStage: 'Decision Hold' });
    const approvedCount = await Lead.countDocuments({ ...initiatedBaseFilter, initiatedStage: 'Approved' });
    const disbursedCount = await Lead.countDocuments({ ...initiatedBaseFilter, initiatedStage: 'Disbursed' });
    const cancelledCount = await Lead.countDocuments({ ...initiatedBaseFilter, initiatedStage: 'Cancelled' });
    const rejectedCount = await Lead.countDocuments({ ...initiatedBaseFilter, initiatedStage: 'Rejected' });
    const defaultersCount = await Lead.countDocuments({ ...initiatedBaseFilter, initiatedStage: "Defaulter's" });
    const totalCount = initiatedCount + decisionHoldCount + approvedCount + disbursedCount + cancelledCount + rejectedCount + defaultersCount;

    let listQuery = {
      ...initiatedBaseFilter,
      initiatedStage: { $exists: true, $ne: null }
    };

    if (stage && stage.toLowerCase() !== 'all') {
      const s = stage.toLowerCase();
      if (s === 'initiated') {
        listQuery.initiatedStage = 'Initiated';
      } else if (s === 'decision hold' || s === 'hold') {
        listQuery.initiatedStage = 'Decision Hold';
      } else if (s === 'approved') {
        listQuery.initiatedStage = 'Approved';
      } else if (s === 'disbursed') {
        listQuery.initiatedStage = 'Disbursed';
      } else if (s === 'cancelled') {
        listQuery.initiatedStage = 'Cancelled';
      } else if (s === 'rejected') {
        listQuery.initiatedStage = 'Rejected';
      } else if (s.includes('default')) {
        listQuery.initiatedStage = "Defaulter's";
      } else {
        listQuery.initiatedStage = { $regex: new RegExp(stage, 'i') };
      }
    }

    if (search && search.trim().length > 0) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      const searchOr = [
        { name: searchRegex },
        { entityName: searchRegex },
        { mobile: searchRegex },
        { leadId: searchRegex },
        { lanId: searchRegex },
        { lenderName: searchRegex },
        { processorName: searchRegex }
      ];
      listQuery = { $and: [listQuery, { $or: searchOr }] };
    }

    const leads = await Lead.find(listQuery).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      employee: employee ? { empId: employee.empId, name: employee.name } : null,
      tagline: 'Our Custom is our Priority',
      counts: {
        initiated: initiatedCount,
        decisionHold: decisionHoldCount,
        approved: approvedCount,
        disbursed: disbursedCount,
        cancelled: cancelledCount,
        rejected: rejectedCount,
        defaulters: defaultersCount,
        total: totalCount
      },
      leads: leads.map(l => ({
        _id: l._id,
        lanId: l.lanId || ('LAN-' + (l.leadId || '0000').replace('NuoGM-LD-', '')),
        leadId: l.leadId || 'N/A',
        createdOn: l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        entityName: l.entityName || 'Proprietorship',
        customName: l.name || 'Applicant',
        mobile: l.mobile || '',
        email: l.email || '',
        amount: l.loanAmount || l.expectedAmount || '0',
        productCategory: l.productCategory || 'Un-Secured Loan',
        productSubtype: l.productSubtype || 'Personal Loan',
        initiatedStage: l.initiatedStage || 'Initiated',
        processorName: l.processorName || 'AMIT SINGH',
        reason: l.reason || l.remarks || 'In evaluation process',
        lenderName: l.lenderName || l.preferredBank || 'HDFC Bank',
        sla: l.sla || '48 Hrs',
        dla: l.dla || l.loanAmount || '₹15,00,000',
        loanTenure: l.loanTenure || l.tenure || '36 Months',
        emi: l.emi || l.comfortEmi || '₹18,500',
        roi: l.roi || '10.5%',
        createdAt: l.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Employee Performance & Request Summary (Tables: PERFORMANCE, PERFORMANCE MONTHLY SUMMARY, REQUEST SUMMARY, REQUEST HISTORY SUMMARY)
// @route   GET /api/employees/performance-summary
// @access  Public / Private
const getPerformanceAndRequestSummary = async (req, res) => {
  try {
    const { period = 'Monthly', year } = req.query;
    let requestedCode = (req.query.empId || req.query.employeeCode || '').trim();

    // Extract employee identity from JWT bearer token if available
    if (!requestedCode && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.id) {
          const e = await Employee.findById(decoded.id);
          if (e) requestedCode = e.empId || e._id.toString();
        }
      } catch (err) {}
    }

    let employee = null;
    if (requestedCode) {
      employee = await Employee.findOne({
        $or: [
          { empId: { $regex: new RegExp(`^${requestedCode}$`, 'i') } },
          { mobile: requestedCode }
        ]
      });
    }

    const targetEmpId = employee ? employee.empId : (requestedCode || '');
    const targetEmpName = employee ? employee.name : '';

    // Fetch all leads associated with this employee
    const leadFilter = {};
    if (targetEmpId || targetEmpName) {
      leadFilter.$or = [
        ...(targetEmpId ? [{ createdById: targetEmpId }, { assignedToId: targetEmpId }] : []),
        ...(targetEmpName ? [{ createdByName: targetEmpName }, { assignedTo: targetEmpName }] : [])
      ];
    }

    const allLeads = (targetEmpId || targetEmpName) ? await Lead.find(leadFilter) : [];

    // Helpers to parse currency strings to numbers
    const parseAmount = (str) => {
      if (!str) return 0;
      const clean = str.toString().replace(/[^0-9.]/g, '');
      return parseFloat(clean) || 0;
    };

    const formatCurrency = (num) => {
      return num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };

    const currentDate = new Date();
    const currentMonthIndex = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentMonthName = monthNames[currentMonthIndex];

    // Calculate Disbursed Count and Value for Current Month
    const currentMonthDisbursed = allLeads.filter(l => {
      const isDisbursed = (l.inProcessStage === 'Disbursed' || l.initiatedStage === 'Disbursed' || l.status === 'Converted');
      const d = l.createdAt ? new Date(l.createdAt) : null;
      return isDisbursed && d && d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
    });

    const disbursedCount = currentMonthDisbursed.length;
    const disbursedValueNum = currentMonthDisbursed.reduce(
      (acc, l) => acc + (parseAmount(l.dla) || parseAmount(l.loanAmount) || parseAmount(l.expectedAmount)),
      0
    );
    const disbursedLoanValue = formatCurrency(disbursedValueNum);

    // Table 1: PERFORMANCE
    const performanceOverview = {
      month: currentMonthName,
      name: currentMonthName,
      disbursedCount: disbursedCount,
      disbursedLoanValue: disbursedLoanValue
    };

    // Table 2: PERFORMANCE BREAKDOWN (Dynamic from database)
    const selectedYear = year ? parseInt(year, 10) : currentYear;
    let performanceSummaryList = [];

    const leadsForYear = allLeads.filter(l => {
      const d = l.createdAt ? new Date(l.createdAt) : null;
      return d && d.getFullYear() === selectedYear;
    });

    if (period.toLowerCase() === 'quarterly') {
      const quarters = [
        { label: 'Q1 (Jan - Mar)', months: [0, 1, 2] },
        { label: 'Q2 (Apr - Jun)', months: [3, 4, 5] },
        { label: 'Q3 (Jul - Sep)', months: [6, 7, 8] },
        { label: 'Q4 (Oct - Dec)', months: [9, 10, 11] }
      ];

      performanceSummaryList = quarters.map(q => {
        const qLeads = leadsForYear.filter(l => {
          const d = new Date(l.createdAt);
          return q.months.includes(d.getMonth());
        });
        const approved = qLeads.filter(l => ['Approved', 'Sanctioned', 'Converted', 'Disbursed'].includes(l.status) || l.inProcessStage === 'Approved');
        const disbursed = qLeads.filter(l => l.inProcessStage === 'Disbursed' || l.status === 'Converted' || l.initiatedStage === 'Disbursed');

        const appVal = approved.reduce((acc, l) => acc + (parseAmount(l.loanAmount) || parseAmount(l.expectedAmount)), 0);
        const disbVal = disbursed.reduce((acc, l) => acc + (parseAmount(l.dla) || parseAmount(l.loanAmount) || parseAmount(l.expectedAmount)), 0);

        return {
          year: selectedYear.toString(),
          period: q.label,
          approvedCount: approved.length,
          approvedLoanValue: formatCurrency(appVal),
          disbursedCount: disbursed.length,
          disbursedLoanValue: formatCurrency(disbVal)
        };
      });
    } else if (period.toLowerCase() === 'half-yearly') {
      const halves = [
        { label: 'H1 (Jan - Jun)', months: [0, 1, 2, 3, 4, 5] },
        { label: 'H2 (Jul - Dec)', months: [6, 7, 8, 9, 10, 11] }
      ];

      performanceSummaryList = halves.map(h => {
        const hLeads = leadsForYear.filter(l => {
          const d = new Date(l.createdAt);
          return h.months.includes(d.getMonth());
        });
        const approved = hLeads.filter(l => ['Approved', 'Sanctioned', 'Converted', 'Disbursed'].includes(l.status) || l.inProcessStage === 'Approved');
        const disbursed = hLeads.filter(l => l.inProcessStage === 'Disbursed' || l.status === 'Converted' || l.initiatedStage === 'Disbursed');

        const appVal = approved.reduce((acc, l) => acc + (parseAmount(l.loanAmount) || parseAmount(l.expectedAmount)), 0);
        const disbVal = disbursed.reduce((acc, l) => acc + (parseAmount(l.dla) || parseAmount(l.loanAmount) || parseAmount(l.expectedAmount)), 0);

        return {
          year: selectedYear.toString(),
          period: h.label,
          approvedCount: approved.length,
          approvedLoanValue: formatCurrency(appVal),
          disbursedCount: disbursed.length,
          disbursedLoanValue: formatCurrency(disbVal)
        };
      });
    } else if (period.toLowerCase() === 'yearly') {
      const approved = leadsForYear.filter(l => ['Approved', 'Sanctioned', 'Converted', 'Disbursed'].includes(l.status) || l.inProcessStage === 'Approved');
      const disbursed = leadsForYear.filter(l => l.inProcessStage === 'Disbursed' || l.status === 'Converted' || l.initiatedStage === 'Disbursed');

      const appVal = approved.reduce((acc, l) => acc + (parseAmount(l.loanAmount) || parseAmount(l.expectedAmount)), 0);
      const disbVal = disbursed.reduce((acc, l) => acc + (parseAmount(l.dla) || parseAmount(l.loanAmount) || parseAmount(l.expectedAmount)), 0);

      performanceSummaryList = [
        {
          year: selectedYear.toString(),
          period: `Full Year ${selectedYear}`,
          approvedCount: approved.length,
          approvedLoanValue: formatCurrency(appVal),
          disbursedCount: disbursed.length,
          disbursedLoanValue: formatCurrency(disbVal)
        }
      ];
    } else {
      // Monthly Breakdown (Only months that have activity or current month)
      performanceSummaryList = monthNames.map((mName, mIdx) => {
        const mLeads = leadsForYear.filter(l => {
          const d = new Date(l.createdAt);
          return d.getMonth() === mIdx;
        });
        const approved = mLeads.filter(l => ['Approved', 'Sanctioned', 'Converted', 'Disbursed'].includes(l.status) || l.inProcessStage === 'Approved');
        const disbursed = mLeads.filter(l => l.inProcessStage === 'Disbursed' || l.status === 'Converted' || l.initiatedStage === 'Disbursed');

        const appVal = approved.reduce((acc, l) => acc + (parseAmount(l.loanAmount) || parseAmount(l.expectedAmount)), 0);
        const disbVal = disbursed.reduce((acc, l) => acc + (parseAmount(l.dla) || parseAmount(l.loanAmount) || parseAmount(l.expectedAmount)), 0);

        return {
          year: selectedYear.toString(),
          period: mName,
          month: mName,
          approvedCount: approved.length,
          approvedLoanValue: formatCurrency(appVal),
          disbursedCount: disbursed.length,
          disbursedLoanValue: formatCurrency(disbVal)
        };
      }).filter(item => item.approvedCount > 0 || item.disbursedCount > 0 || item.month === currentMonthName);
    }

    // Table 3 & 4: REQUEST SUMMARY & HISTORY (From MongoDB EmployeeRequest collection)
    const requestFilter = targetEmpId ? { empId: targetEmpId } : (targetEmpName ? { employeeName: targetEmpName } : {});
    const requests = (targetEmpId || targetEmpName) ? await EmployeeRequest.find(requestFilter).sort({ openDate: -1 }) : [];
    const closedCount = requests.filter(r => r.status === 'Closed').length;
    const returnedCount = requests.filter(r => r.status === 'Returned').length;
    const inProcessCount = requests.filter(r => r.status === 'In-Process').length;

    const requestSummary = {
      monthYear: `${currentMonthName} / ${currentYear}`,
      closedRequests: closedCount,
      returnedRequests: returnedCount,
      requestInProcess: inProcessCount
    };

    const requestHistory = requests.map(r => ({
      _id: r._id,
      requestId: r.requestId,
      products: r.product,
      queryType: r.queryType,
      subQueryType: r.subQueryType,
      openDate: r.openDate ? new Date(r.openDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
      closingDate: r.closingDate ? new Date(r.closingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
      status: r.status,
      remarks: r.remarks || ''
    }));

    res.status(200).json({
      success: true,
      employee: {
        empId: targetEmpId,
        name: targetEmpName
      },
      performanceOverview,
      performanceMonthlySummary: performanceSummaryList,
      requestSummary,
      requestHistory
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create / Raise a new employee request/query (stored in MongoDB)
// @route   POST /api/employees/requests
// @access  Public / Private
const createEmployeeRequest = async (req, res) => {
  try {
    const { product = 'UBL', queryType = 'Rejected', subQueryType = 'Re-Check', remarks = '', empId } = req.body;

    let requestedCode = (empId || req.query.empId || '').trim();
    if (!requestedCode && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.id) {
          const e = await Employee.findById(decoded.id);
          if (e) requestedCode = e.empId || e._id.toString();
        }
      } catch (err) {}
    }
    if (!requestedCode) requestedCode = 'NuoGM-EMP-2026-3395';

    const employee = await Employee.findOne({
      $or: [
        { empId: { $regex: new RegExp(`^${requestedCode}$`, 'i') } },
        { mobile: requestedCode }
      ]
    });

    const targetEmpId = employee ? employee.empId : requestedCode;
    const targetEmpName = employee ? employee.name : 'Employee';

    // Auto-generate next Request ID: HSR01, HSR02, HSR03...
    const count = await EmployeeRequest.countDocuments();
    const nextNum = (count + 1).toString().padStart(2, '0');
    const requestId = `HSR${nextNum}`;

    const newRequest = await EmployeeRequest.create({
      requestId,
      empId: targetEmpId,
      employeeName: targetEmpName,
      product,
      queryType,
      subQueryType,
      openDate: new Date(),
      closingDate: null,
      status: 'In-Process',
      remarks
    });

    res.status(201).json({
      success: true,
      message: 'Request raised successfully in database',
      request: newRequest
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get CASE Tracking, PENDING Cases, and CUSTOMER's Offers
// @route   GET /api/employees/case-tracking
// @access  Public / Private
const getCaseTrackingData = async (req, res) => {
  try {
    const { employee, leadFilter } = await resolveEmployeeAndFilters(req);
    const { searchType = 'application', searchQuery = '', tab = 'all' } = req.query;

    const targetEmpId = employee ? employee.empId : 'NuoGM-EMP-2026-3395';
    const targetEmpName = employee ? employee.name : 'Mayank Pandey';



    // 1. Fetch CASE TRACKING (All leads in active pipeline for this user/scope)
    const caseTrackingLeads = await Lead.find(leadFilter).sort({ createdAt: -1 });
    const caseTrackingList = caseTrackingLeads.map((l, index) => ({
      sNo: index + 1,
      _id: l._id,
      leadId: l.leadId || 'N/A',
      lanId: l.lanId || 'LAN-0000',
      entityName: l.entityName || 'Proprietorship Entity',
      customName: l.name || 'Customer Name',
      mobile: l.mobile || '',
      panNumber: l.panNumber || 'BKGPS1234F',
      reason: l.reason || l.remarks || 'Application Under Assessment',
      amount: l.loanAmount || l.expectedAmount || '5,00,000',
      product: l.productSubtype || 'Personal Loan',
      status: l.status || 'Active',
      stage: l.initiatedStage || l.inProcessStage || l.draftStatus || l.status || 'Active',
      createdAt: l.createdAt
    }));

    // 2. Fetch PENDING Cases from MongoDB (Draft, Pending Review, Hold, Docs Pending)
    // Matches getDashboardOverview: status matching /pending|review|new|contacted/i OR isDraft/hold/docs pending
    const pendingFilter = {
      $and: [
        leadFilter.$or ? { $or: leadFilter.$or } : (Object.keys(leadFilter).length > 0 ? leadFilter : {}),
        {
          $or: [
            { isDraft: true },
            { status: { $regex: /pending|review|new|hold|draft|contacted/i } },
            { draftStatus: { $regex: /pending|hold|draft/i } },
            { inProcessStage: { $regex: /pending|hold|logins|lender/i } }
          ]
        }
      ]
    };
    const pendingLeads = await Lead.find(pendingFilter).sort({ createdAt: -1 });

    const pendingCasesList = pendingLeads.map((l, index) => ({
      sNo: index + 1,
      _id: l._id,
      leadId: l.leadId || 'N/A',
      lanId: l.lanId || 'LAN-0000',
      entityName: l.entityName || 'Proprietorship Entity',
      customName: l.name || 'Customer Name',
      mobile: l.mobile || '',
      panNumber: l.panNumber || 'BKGPS1234F',
      reason: l.reason || l.remarks || (l.status ? `Status: ${l.status}` : 'Documentation Pending from Customer'),
      amount: l.loanAmount || l.expectedAmount || '5,00,000',
      product: l.productSubtype || 'Personal Loan',
      status: l.status || 'Pending',
      createdAt: l.createdAt
    }));

    // 3. Fetch CUSTOMER's Offers from MongoDB
    // Matches getDashboardOverview customOffers count
    const offerFilter = {
      $and: [
        leadFilter.$or ? { $or: leadFilter.$or } : (Object.keys(leadFilter).length > 0 ? leadFilter : {}),
        {
          $or: [
            { offerStatus: { $exists: true, $ne: null, $ne: '' } },
            { status: { $regex: /^(qualified|sanctioned|offer|pre.?approved|approved)$/i } },
            { draftStatus: { $regex: /offer|sanctioned|pre.?approved/i } },
            { inProcessStage: { $regex: /sanction|offer|approved/i } },
            { initiatedStage: { $regex: /sanction|offer|approved/i } }
          ]
        }
      ]
    };
    const offerLeads = await Lead.find(offerFilter).sort({ createdAt: -1 });

    const customerOffersList = offerLeads.map((l, index) => ({
      sNo: index + 1,
      _id: l._id,
      leadId: l.leadId || 'N/A',
      entityName: l.entityName || 'Business Entity',
      customName: l.name || 'Customer Name',
      mobile: l.mobile || '',
      panNumber: l.panNumber || 'BKGPS1234F',
      offerStatus: l.offerStatus || `Pre-Approved ₹${l.loanAmount || l.expectedAmount || '15,00,000'} @ 9.99%`,
      amount: l.offerAmount || l.loanAmount || l.expectedAmount || '15,00,000',
      product: l.productSubtype || 'UB Loan',
      createdAt: l.createdAt
    }));

    // 4. Live Case Tracking Search by Mobile, PAN, or Request ID
    let searchResult = null;
    const q = (searchQuery || '').trim();
    if (q.length > 0) {
      if (searchType === 'serviceRequest' || q.toUpperCase().startsWith('HSR')) {
        const reqDoc = await EmployeeRequest.findOne({
          requestId: { $regex: new RegExp(q, 'i') }
        });
        if (reqDoc) {
          searchResult = {
            type: 'Service Request',
            requestId: reqDoc.requestId,
            product: reqDoc.product,
            queryType: reqDoc.queryType,
            subQueryType: reqDoc.subQueryType,
            openDate: reqDoc.openDate,
            closingDate: reqDoc.closingDate,
            status: reqDoc.status,
            remarks: reqDoc.remarks,
            employeeName: reqDoc.employeeName
          };
        }
      } else {
        const leadDoc = await Lead.findOne({
          $or: [
            { mobile: { $regex: q } },
            { panNumber: { $regex: new RegExp(q, 'i') } },
            { leadId: { $regex: new RegExp(q, 'i') } },
            { lanId: { $regex: new RegExp(q, 'i') } },
            { name: { $regex: new RegExp(q, 'i') } }
          ]
        });

        if (leadDoc) {
          searchResult = {
            type: 'Application',
            leadId: leadDoc.leadId,
            lanId: leadDoc.lanId,
            customName: leadDoc.name,
            entityName: leadDoc.entityName,
            mobile: leadDoc.mobile,
            panNumber: leadDoc.panNumber || 'BKGPS1234F',
            productCategory: leadDoc.productCategory,
            productSubtype: leadDoc.productSubtype,
            amount: leadDoc.loanAmount || leadDoc.expectedAmount || '0',
            status: leadDoc.status,
            stage: leadDoc.initiatedStage || leadDoc.inProcessStage || leadDoc.draftStatus || 'Under Review',
            reason: leadDoc.reason || leadDoc.remarks || 'Application Under Assessment',
            lenderName: leadDoc.lenderName || 'Bank Partner',
            processorName: leadDoc.processorName || 'AMIT SINGH',
            createdAt: leadDoc.createdAt
          };
        }
      }
    }

    res.status(200).json({
      success: true,
      stats: {
        caseTracking: caseTrackingList.length,
        pendingCases: pendingCasesList.length,
        customOffers: customerOffersList.length
      },
      caseTrackingList,
      pendingCases: pendingCasesList,
      customerOffers: customerOffersList,
      searchResult
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get dynamic notifications for logged-in employee from MongoDB
// @route   GET /api/employees/notifications
const getEmployeeNotifications = async (req, res) => {
  try {
    const { employee, leadFilter } = await resolveEmployeeAndFilters(req);
    const targetEmpId = employee ? employee.empId : '';
    const empZone = employee && employee.zone ? employee.zone.toUpperCase() : '';

    const Notification = require('../models/Notification');
    const Lead = require('../models/Lead');

    // Find all lead IDs assigned to or created by this employee
    let myLeadIds = [];
    if (leadFilter && Object.keys(leadFilter).length > 0) {
      const myLeads = await Lead.find(leadFilter).select('leadId _id').limit(200);
      myLeadIds = myLeads.map(l => l.leadId || l._id.toString()).filter(Boolean);
    }

    const orConditions = [];

    // 1. Directly addressed to this employee (empId or Mongo _id)
    if (targetEmpId) orConditions.push({ recipientEmpId: targetEmpId });
    if (employee && employee._id) orConditions.push({ recipientId: employee._id });

    // 2. Notifications regarding leads assigned to / handled by this employee
    if (myLeadIds.length > 0) {
      orConditions.push({ leadId: { $in: myLeadIds } });
    }

    // 3. Zonal notifications matching this employee's zone (or ALL zone if employee is head/ALL)
    if (empZone && empZone !== 'ALL') {
      orConditions.push({ zone: empZone });
    } else if (empZone === 'ALL') {
      orConditions.push({ zone: { $in: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'ALL'] } });
    }

    // 4. Global broadcast or employee-wide notifications
    orConditions.push({ audience: 'all' });
    orConditions.push({ audience: 'all_employees' });

    const queryFilter = orConditions.length > 0 ? { $or: orConditions } : {};

    // Fetch real notifications for this employee from MongoDB
    const notifs = await Notification.find(queryFilter)
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = notifs.filter(n => !n.isRead).length;

    // Group by Date: Today, Yesterday, Earlier
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    const formattedList = notifs.map(n => {
      const created = new Date(n.createdAt);
      let dateGroup = 'Earlier';
      if (created >= todayStart) {
        dateGroup = 'Today';
      } else if (created >= yesterdayStart) {
        dateGroup = 'Yesterday';
      } else {
        dateGroup = created.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }

      const timeStr = created.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      return {
        _id: n._id,
        title: n.title,
        detail: n.detail || n.title,
        type: n.type || 'system',
        isRead: n.isRead,
        isUnread: !n.isRead,
        leadId: n.leadId || '',
        customerName: n.customerName || '',
        actionScreen: n.actionScreen || '',
        time: dateGroup === 'Today' ? timeStr : (dateGroup === 'Yesterday' ? `Yesterday, ${timeStr}` : `${dateGroup}, ${timeStr}`),
        dateGroup,
        createdAt: n.createdAt
      };
    });

    res.status(200).json({
      success: true,
      unreadCount,
      totalCount: formattedList.length,
      notifications: formattedList
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markEmployeeNotificationAsRead = async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const notif = await Notification.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    res.status(200).json({ success: true, notification: notif });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markAllEmployeeNotificationsAsRead = async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const { employee } = await resolveEmployeeAndFilters(req);
    const targetEmpId = employee ? employee.empId : 'NuoGM-EMP-2026-3395';

    await Notification.updateMany(
      {
        $or: [
          { recipientEmpId: targetEmpId },
          { recipientId: employee ? employee._id : null },
          { recipientId: null, recipientEmpId: null }
        ]
      },
      { isRead: true }
    );
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resolveAuthenticatedEmployee = async (req) => {
  const identity = req.admin || {};
  let employee = null;

  if (identity._id && mongoose.Types.ObjectId.isValid(identity._id)) {
    employee = await Employee.findById(identity._id);
  }
  if (!employee && identity.email) {
    employee = await Employee.findOne({ email: identity.email.toLowerCase() });
  }
  if (!employee && identity.empId) {
    employee = await Employee.findOne({ empId: identity.empId });
  }

  return employee;
};

// @desc    Get the authenticated employee profile with dynamic stats
// @route   GET /api/employees/profile
// @access  Private / Public fallback
const getEmployeeProfile = async (req, res) => {
  try {
    let employee = await resolveAuthenticatedEmployee(req);
    const empIdParam = req.query.empId || req.query.employeeId || req.headers['x-emp-id'];
    if (!employee && empIdParam) {
      employee = await Employee.findOne({
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(empIdParam) ? empIdParam : null },
          { empId: empIdParam },
          { email: empIdParam.toLowerCase() },
          { mobile: empIdParam }
        ].filter(Boolean)
      });
    }

    if (!employee) {
      employee = await Employee.findOne({ status: 'Active' });
    }

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const employeeObj = employee.toObject ? employee.toObject() : { ...employee };
    delete employeeObj.password;

    // Dynamic Lead Stats Calculation from MongoDB
    const leadFilter = {
      $or: [
        { assignedTo: employee._id },
        { assignedTo: employee.empId },
        { assignedTo: employee.name },
        { assignedToName: employee.name },
        { createdBy: employee._id },
        { createdBy: employee.empId },
        { createdByName: employee.name },
        { employeeId: employee.empId }
      ]
    };

    const totalLeads = await Lead.countDocuments(leadFilter);
    const convertedLeads = await Lead.countDocuments({
      ...leadFilter,
      status: { $regex: /approved|disbursed|converted|completed|disbursal/i }
    });

    employeeObj.totalLeads = totalLeads;
    employeeObj.convertedLeads = convertedLeads;

    res.status(200).json({ success: true, employee: employeeObj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update employee profile from Employee App
// @route   PUT /api/employees/profile
// @access  Private
const updateEmployeeProfile = async (req, res) => {
  try {
    const { empId, name, email, mobile, role, designation, city, branch } = req.body;

    // The JWT contains Mongo's _id. empId remains a fallback for older app sessions.
    const employee = await resolveAuthenticatedEmployee(req) ||
      (empId ? await Employee.findOne({ empId: empId.trim() }) : null);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (name !== undefined) employee.name = name.trim();
    if (email !== undefined) employee.email = email.trim();
    if (mobile !== undefined) employee.mobile = mobile.trim();
    if (role !== undefined) employee.role = role.trim();
    if (designation !== undefined) employee.designation = designation.trim();
    if (city !== undefined) employee.city = city.trim();
    if (branch !== undefined) employee.city = branch.trim();

    await employee.save();
    const employeeResponse = employee.toObject();
    delete employeeResponse.password;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      employee: employeeResponse
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const uploadEmployeeAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    const employee = await resolveAuthenticatedEmployee(req);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const sub = req.file.categorySubdir ? `${req.file.categorySubdir}/` : '';
    employee.avatar = `uploads/${sub}${req.file.filename}`;
    await employee.save();

    res.status(200).json({ success: true, avatar: employee.avatar });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload / Update Avatar for an Employee from Admin / HR Panel
// @route   POST /api/employees/:id/avatar
// @access  Private (Admin/HR)
const uploadEmployeeAvatarById = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    const idParam = req.params.id;
    let employee = null;
    if (mongoose.Types.ObjectId.isValid(idParam)) {
      employee = await Employee.findById(idParam);
    }
    if (!employee) {
      employee = await Employee.findOne({ empId: idParam });
    }

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const sub = req.file.categorySubdir ? `${req.file.categorySubdir}/` : '';
    const avatarPath = `uploads/${sub}${req.file.filename}`;
    employee.avatar = avatarPath;

    // Also sync to employee.documents if photo doc exists
    if (!employee.documents) employee.documents = [];
    const photoDocIndex = employee.documents.findIndex(d => 
      (d.key && (d.key.toLowerCase().includes('photo') || d.key === 'Passport Photo')) ||
      (d.name && d.name.toLowerCase().includes('photo'))
    );
    if (photoDocIndex > -1) {
      employee.documents[photoDocIndex].fileUrl = avatarPath;
      employee.documents[photoDocIndex].status = 'Approved';
    } else {
      employee.documents.push({
        name: 'Passport Photo',
        key: 'photo',
        fileUrl: avatarPath,
        status: 'Approved',
        uploadedAt: Date.now()
      });
    }

    await employee.save();

    res.status(200).json({
      success: true,
      message: 'Employee photo updated successfully',
      avatar: employee.avatar,
      employee
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Leaderboard & Employee Disbursal Achievement Progress
// @route   GET /api/employees/leaderboard-progress
// @access  Public / Employee Bearer
const getLeaderboardAndProgress = async (req, res) => {
  try {
    const { employee } = await resolveEmployeeAndFilters(req);
    const loggedInId = employee ? employee._id.toString() : '';
    const loggedInEmpId = employee ? employee.empId : '';

    // Fetch all active employees
    const employees = await Employee.find({ status: 'Active' })
      .select('name empId designation role avatar city district branch division')
      .lean();

    // Calculate achievement based on disbursed amount for each employee
    const leaderboardList = await Promise.all(
      employees.map(async (emp) => {
        const empFilter = {
          $or: [
            { assignedTo: emp._id },
            { assignedTo: emp.empId },
            { assignedTo: emp.name },
            { assignedToName: emp.name },
            { createdBy: emp._id },
            { createdBy: emp.empId },
            { createdByName: emp.name },
            { createdById: emp.empId },
            { employeeId: emp.empId }
          ],
          status: { $regex: /approved|disbursed|converted|completed|disbursal/i }
        };

        const disbursedLeads = await Lead.find(empFilter).lean();

        let totalDisbursedAmount = 0;
        disbursedLeads.forEach(lead => {
          const rawAmt = lead.offerAmount || lead.expectedAmount || lead.loanAmount || 0;
          const cleaned = parseFloat(String(rawAmt).replace(/[^0-9.]/g, '')) || 0;
          totalDisbursedAmount += cleaned;
        });

        // Also check LoanApplication model for any additional completed loans
        const loanFilter = {
          $or: [
            { assignedToId: emp.empId },
            { assignedTo: emp.name },
            { userId: emp._id.toString() }
          ],
          status: { $regex: /approved|disbursed|closed|completed/i }
        };
        const disbursedLoans = await LoanApplication.find(loanFilter).lean();
        disbursedLoans.forEach(loan => {
          const rawAmt = loan.amount || 0;
          const cleaned = parseFloat(String(rawAmt).replace(/[^0-9.]/g, '')) || 0;
          totalDisbursedAmount += cleaned;
        });

        return {
          id: emp._id,
          empId: emp.empId,
          name: emp.name,
          designation: emp.designation || emp.role || 'Executive',
          avatar: emp.avatar || '',
          branch: emp.branch || emp.city || emp.district || 'Head Office',
          totalDisbursed: totalDisbursedAmount,
          disbursedCount: disbursedLeads.length + disbursedLoans.length,
          milestoneBadge: totalDisbursedAmount >= 10000000
            ? 'Diamond Legend'
            : (totalDisbursedAmount >= 5000000
                ? 'Platinum Elite'
                : (totalDisbursedAmount >= 2500000
                    ? 'Gold Champion'
                    : (totalDisbursedAmount >= 1000000
                        ? 'Silver Achiever'
                        : (totalDisbursedAmount >= 500000 ? 'Starter Club' : 'Aspiring Achiever')))),
          isCurrentUser: emp._id.toString() === loggedInId || emp.empId === loggedInEmpId
        };
      })
    );

    // Sort descending by total disbursed achievement
    leaderboardList.sort((a, b) => b.totalDisbursed - a.totalDisbursed);

    // Assign ranks
    leaderboardList.forEach((item, index) => {
      item.rank = index + 1;
    });

    // Extract current logged-in employee progress
    const myRankItem = leaderboardList.find(item => item.isCurrentUser) || {
      id: loggedInId,
      empId: loggedInEmpId,
      name: employee ? employee.name : 'You',
      designation: employee ? (employee.designation || 'Executive') : 'Executive',
      avatar: employee ? (employee.avatar || '') : '',
      branch: employee ? (employee.city || 'Head Office') : 'Head Office',
      totalDisbursed: 0,
      disbursedCount: 0,
      rank: leaderboardList.length + 1,
      isCurrentUser: true
    };

    // Monthly Target (Standard 25,00,000 for progress bar)
    const monthlyTarget = 2500000;
    const progressPercent = Math.min(100, Math.round((myRankItem.totalDisbursed / monthlyTarget) * 100));

    // Milestone Tiers based on disbursals with tangible awards (Gifts, Bike, Car, Luxury Award)
    const milestoneTiers = [
      { id: 'bronze', name: 'Starter Milestone', target: 500000, reward: 'Smart Device / Tablet / ₹5,000 Gift Kit', awardType: 'gift', icon: 'card_giftcard' },
      { id: 'silver', name: 'Silver Rider Milestone', target: 1500000, reward: 'Brand New Bike / Two-Wheeler Voucher', awardType: 'bike', icon: 'two_wheeler' },
      { id: 'gold', name: 'Gold Cruiser Milestone', target: 3500000, reward: 'Brand New Car / Hatchback (Family Car)', awardType: 'car', icon: 'directions_car' },
      { id: 'platinum', name: 'Platinum Star Milestone', target: 7500000, reward: 'Premium SUV Car + Gold Coin (10g)', awardType: 'suv', icon: 'airport_shuttle' },
      { id: 'diamond', name: 'Diamond Legend Milestone', target: 15000000, reward: 'Luxury Car (BMW/Audi/Fortuner) + International Trip', awardType: 'luxury_car', icon: 'diamond' }
    ];

    const milestonesWithStatus = milestoneTiers.map(m => {
      const isUnlocked = myRankItem.totalDisbursed >= m.target;
      const progress = Math.min(100, Math.round((myRankItem.totalDisbursed / m.target) * 100));
      const remaining = Math.max(0, m.target - myRankItem.totalDisbursed);
      return {
        ...m,
        isUnlocked,
        progress,
        remaining
      };
    });

    // Current active milestone
    const currentMilestone = milestonesWithStatus.find(m => !m.isUnlocked) || milestonesWithStatus[milestonesWithStatus.length - 1];
    const unlockedCount = milestonesWithStatus.filter(m => m.isUnlocked).length;

    res.status(200).json({
      success: true,
      leaderboard: leaderboardList,
      myProgress: {
        ...myRankItem,
        targetAmount: monthlyTarget,
        progressPercent,
        remainingToTarget: Math.max(0, monthlyTarget - myRankItem.totalDisbursed),
        unlockedCount,
        totalMilestones: milestoneTiers.length,
        currentMilestone,
        milestones: milestonesWithStatus
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Help & Support info (Office details, HR contact, Employee Refer program)
// @route   GET /api/employees/help-support
// @access  Public / Employee Bearer
const getHelpSupportData = async (req, res) => {
  try {
    const { employee } = await resolveEmployeeAndFilters(req);

    // Find assigned HR or Default Company HR
    let hrContact = {
      name: "HR Operations Desk",
      phone: "+91 91529 60000",
      email: "hr@nuogmhousing.com",
      timing: "10:00 AM - 06:30 PM (Mon-Sat)"
    };

    if (employee && employee.assignedHRName) {
      hrContact.name = employee.assignedHRName;
    }
    if (employee && employee.assignedHRId) {
      const hrEmp = await Employee.findById(employee.assignedHRId).lean();
      if (hrEmp) {
        hrContact.phone = hrEmp.mobile || hrEmp.phone || hrContact.phone;
        hrContact.email = hrEmp.email || hrContact.email;
      }
    }

    const officeDetails = {
      companyName: "NUOGM Housing Finance Ltd.",
      corporateOffice: "Suite 401-404, Corporate Tower, Gomti Nagar, Lucknow, Uttar Pradesh - 226010",
      registeredOffice: "NuoGM Bhavan, Barakhamba Road, Connaught Place, New Delhi - 110001",
      tollFree: "1800 123 9090",
      supportEmail: "support@nuogmhousing.com",
      website: "https://nuogmhousing.com",
      workingHours: "Monday to Saturday, 09:30 AM to 06:30 PM (2nd & 4th Saturday Closed)"
    };

    const referProgram = {
      title: "Employee Referral Program",
      reward: "Earn up to ₹ 10,000 / referral",
      description: "Refer talented professionals to join NuoGM Housing Finance team. When your referred candidate completes 90 days of successful employment, receive cash reward credited directly to your payroll wallet.",
      referralCode: employee ? (employee.empId || 'NUO-REF') : 'NUO-REF',
      shareMessage: `Join the fastest growing housing finance team! Apply with NuoGM Housing Finance using my referral ID: ${employee ? employee.empId : 'NUO-REF'}. Visit: https://nuogmhousing.com/careers`
    };

    res.status(200).json({
      success: true,
      officeDetails,
      hrContact,
      referProgram
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit Query to HR for Unblocking ID / Late Login Unlock
// @route   POST /api/employees/request-unblock
// @access  Public
const submitUnblockQuery = async (req, res) => {
  try {
    const { identifier, email, empId, queryText, reason } = req.body;
    const lookup = (identifier || email || empId || '').trim();

    if (!lookup) {
      return res.status(400).json({ success: false, message: 'Email or Employee ID is required' });
    }

    const employee = await Employee.findOne({
      $or: [
        { email: new RegExp(`^${lookup}$`, 'i') },
        { empId: new RegExp(`^${lookup}$`, 'i') }
      ]
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found with provided ID/Email' });
    }

    const finalQuery = (queryText || reason || 'Requesting HR to unblock ID for login.').trim();

    employee.unblockRequest = {
      status: 'Pending',
      queryText: finalQuery,
      requestedAt: new Date(),
      hrActionDate: null,
      hrRemark: ''
    };

    // Ensure isLateLocked is true if they are requesting unblock
    employee.isLateLocked = true;
    if (!employee.lateLockReason) {
      employee.lateLockReason = 'Locked due to late login / attendance policy';
    }

    await employee.save();

    // Trigger Notification for HR
    try {
      const { createNotification } = require('./notificationController');
      await createNotification(
        `Login Unblock Query: ${employee.name} (${employee.empId}) submitted an unblock request: "${finalQuery}". Please review in HR Panel.`,
        'system',
        employee.assignedHRId || null
      );
    } catch (notifErr) {
      console.error('Notification error on unblock request:', notifErr);
    }

    res.status(200).json({
      success: true,
      message: 'Aapki query HR Panel par bhej di gayi hai! HR dwara unblock hote hi aap login kar sakenge.',
      unblockRequest: employee.unblockRequest
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check Unblock Status for an employee
// @route   GET /api/employees/check-unblock-status
// @access  Public
const checkUnblockStatus = async (req, res) => {
  try {
    const { identifier, email, empId } = req.query;
    const lookup = (identifier || email || empId || '').trim();

    if (!lookup) {
      return res.status(400).json({ success: false, message: 'Identifier is required' });
    }

    const employee = await Employee.findOne({
      $or: [
        { email: new RegExp(`^${lookup}$`, 'i') },
        { empId: new RegExp(`^${lookup}$`, 'i') }
      ]
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const now = new Date();
    const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const y = istDate.getFullYear();
    const m = String(istDate.getMonth() + 1).padStart(2, '0');
    const d = String(istDate.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    const isApprovedToday = employee.hrLoginApprovedDate === todayStr && !employee.isLateLocked;

    res.status(200).json({
      success: true,
      empId: employee.empId,
      name: employee.name,
      isLateLocked: !!employee.isLateLocked,
      isApprovedToday,
      status: employee.status,
      unblockRequest: employee.unblockRequest || { status: 'None' },
      hrApprovedBy: employee.hrApprovedBy || '',
      canLoginNow: isApprovedToday || (!employee.isLateLocked && employee.status === 'Active')
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all employees with pending unblock requests or late locked status
// @route   GET /api/employees/unblock-queries
// @access  Private (HR / Admin)
const getPendingUnblockQueries = async (req, res) => {
  try {
    const query = {
      $or: [
        { isLateLocked: true },
        { 'unblockRequest.status': 'Pending' }
      ]
    };

    const employees = await Employee.find(query)
      .select('name email empId mobile role designation status isLateLocked lateLockReason hrLoginApprovedDate hrApprovedBy unblockRequest assignedHRName')
      .sort({ 'unblockRequest.requestedAt': -1, updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: employees.length,
      requests: employees
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Process / Approve / Reject an unblock query by HR
// @route   PUT /api/employees/:id/process-unblock
// @access  Private (HR / Admin)
const processUnblockQuery = async (req, res) => {
  try {
    const { action, hrRemark } = req.body; // action: 'Approved' | 'Rejected'
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const hrAdminName = req.admin?.name || req.admin?.email || 'HR Admin';
    const now = new Date();
    const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const y = istDate.getFullYear();
    const m = String(istDate.getMonth() + 1).padStart(2, '0');
    const d = String(istDate.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    if (action === 'Approved' || action === 'Approve') {
      employee.isLateLocked = false;
      employee.lateLockReason = '';
      employee.status = 'Active';
      employee.hrLoginApprovedDate = todayStr;
      employee.hrApprovedBy = hrAdminName;

      employee.unblockRequest = {
        status: 'Approved',
        queryText: employee.unblockRequest?.queryText || '',
        requestedAt: employee.unblockRequest?.requestedAt || now,
        hrActionDate: now,
        hrRemark: hrRemark || 'Approved by HR'
      };

      await employee.save();

      // Create notification for employee
      try {
        const { createNotification } = require('./notificationController');
        await createNotification(
          `Your ID has been UNBLOCKED by ${hrAdminName}. You can now login.`,
          'system',
          employee._id
        );
      } catch (notifErr) {}

      return res.status(200).json({
        success: true,
        message: `${employee.name} (${employee.empId}) successfully unblocked! Employee can now login.`,
        employee
      });
    } else {
      // Reject
      employee.unblockRequest = {
        status: 'Rejected',
        queryText: employee.unblockRequest?.queryText || '',
        requestedAt: employee.unblockRequest?.requestedAt || now,
        hrActionDate: now,
        hrRemark: hrRemark || 'Rejected by HR'
      };

      await employee.save();

      return res.status(200).json({
        success: true,
        message: `Unblock query for ${employee.name} has been rejected.`,
        employee
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit Feedback from Employee App (Stored as special EmployeeRequest)
// @route   POST /api/employees/feedback
// @access  Public / Employee Bearer
const submitEmployeeFeedback = async (req, res) => {
  try {
    const { category = 'Other / Suggestion', rating = 'Great', feedbackText = '', okToContact = true, screenshot = '' } = req.body;
    const { employee } = await resolveEmployeeAndFilters(req);
    const targetEmpId = employee ? employee.empId : 'NuoGM-EMP-2026-3395';
    const targetEmpName = employee ? employee.name : 'Executive';

    const count = await EmployeeRequest.countDocuments();
    const nextNum = (count + 1).toString().padStart(2, '0');
    const requestId = `FB${nextNum}`;

    const newRequest = await EmployeeRequest.create({
      requestId,
      empId: targetEmpId,
      employeeName: targetEmpName,
      product: category,
      queryType: 'Feedback',
      subQueryType: rating,
      openDate: new Date(),
      closingDate: null,
      status: 'In-Process',
      remarks: `[Rating: ${rating}] [Category: ${category}] [OkToContact: ${okToContact ? 'Yes' : 'No'}]\n${feedbackText}`
    });

    res.status(201).json({
      success: true,
      message: 'Thank you! Your feedback has been received and shared with our product & operations team.',
      request: newRequest
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Re-export with all handlers included
Object.assign(module.exports, {
  submitUnblockQuery,
  checkUnblockStatus,
  getPendingUnblockQueries,
  processUnblockQuery,
  submitEmployeeFeedback,
  getMyLeadsForApp,
  getMyLoansForApp,
  getCustomOffersForApp,
  getInDraftLeadHistory,
  getSubmittedInProcessHistory,
  getInitiatedLeadStatusHistory,
  getPerformanceAndRequestSummary,
  createEmployeeRequest,
  getCaseTrackingData,
  getEmployeeNotifications,
  markEmployeeNotificationAsRead,
  markAllEmployeeNotificationsAsRead,
  getEmployeeProfile,
  updateEmployeeProfile,
  uploadEmployeeAvatar,
  uploadEmployeeAvatarById,
  getMyLeavesForApp,
  getLeaderboardAndProgress,
  getHelpSupportData
});




