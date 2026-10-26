const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const Department = require('../models/Department');

// Default built-in headings
const DEFAULT_HEADINGS = [
  { _id: 'default_grossMonthly', key: 'grossMonthly', label: 'Gross Monthly', isDefault: true, type: 'currency' },
  { _id: 'default_grossYearly', key: 'grossYearly', label: 'Gross Yearly', isDefault: true, type: 'currency' },
  { _id: 'default_transport', key: 'transport', label: 'Transport', isDefault: true, type: 'currency' },
  { _id: 'default_perfBonus', key: 'perfBonus', label: 'Perf. Bonus', isDefault: true, type: 'currency' },
  { _id: 'default_achievement', key: 'achievement', label: 'Achievement', isDefault: true, type: 'currency' },
  { _id: 'default_incentives', key: 'incentives', label: 'Incentives', isDefault: true, type: 'currency' }
];

// Helper to check heading management permissions
const canManageHeadings = (admin) => {
  if (!admin) return false;
  const roleLower = (admin.role || '').toLowerCase();
  const desigLower = (admin.designation || '').toLowerCase();
  const cleanRole = roleLower.replace(/[^a-z0-9]/g, '');
  const cleanDesig = desigLower.replace(/[^a-z0-9]/g, '');

  const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'administrator'].includes(roleLower) || 
                        ['superadmin', 'admin', 'administrator'].includes(cleanRole);
  const isHRHead = ['hr head', 'hr_head', 'hr admin', 'hradmin', 'hr'].includes(roleLower) || 
                   ['hrhead', 'hradmin', 'hr'].includes(cleanRole) || 
                   desigLower.includes('hr head') || cleanDesig.includes('hrhead') ||
                   (admin.isDepartmentHead && (admin.department || '').toLowerCase().includes('hr'));

  if (isMasterAdmin || isHRHead) return true;

  // Juniors (HR Manager / HR Executive) require explicit permission granted by HR Head / Super Admin
  const perms = admin.permissions || [];
  return perms.includes('Manage Payroll Headings') || perms.includes('Manage Payroll');
};

// @desc    Get dynamic payroll headings
// @route   GET /api/payroll/headings
// @access  Private/Admin
const getPayrollHeadings = async (req, res) => {
  try {
    const doc = await Department.findOne({ departmentId: 'SETTINGS_PAYROLL_HEADINGS' });
    
    let headings = [];
    if (doc && doc.description) {
      try {
        headings = JSON.parse(doc.description);
      } catch (e) {
        headings = [...DEFAULT_HEADINGS];
      }
    } else {
      headings = [...DEFAULT_HEADINGS];
      await Department.findOneAndUpdate(
        { departmentId: 'SETTINGS_PAYROLL_HEADINGS' },
        { 
          $set: { 
            name: 'System Payroll Headings',
            departmentCode: 'SYS_PAYROLL_HEADINGS',
            description: JSON.stringify(headings)
          } 
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    const hasManagePermission = canManageHeadings(req.admin);

    res.status(200).json({
      success: true,
      canManage: hasManagePermission,
      headings: (headings && headings.length > 0) ? headings : DEFAULT_HEADINGS
    });
  } catch (error) {
    console.error('Fatal error in getPayrollHeadings:', error);
    res.status(200).json({
      success: true,
      canManage: true,
      headings: DEFAULT_HEADINGS
    });
  }
};

// @desc    Add a dynamic payroll heading / column
// @route   POST /api/payroll/headings
// @access  Private/Admin (Super Admin, HR Head, or Junior with permission)
const createPayrollHeading = async (req, res) => {
  try {
    if (!canManageHeadings(req.admin)) {
      return res.status(403).json({
        message: 'Permission denied. Only Super Admin, HR Head or permitted HR staff can add new payroll headings.'
      });
    }

    const { label, key, type, defaultValue } = req.body;

    if (!label || !label.trim()) {
      return res.status(400).json({ message: 'Heading label is required' });
    }

    // Generate safe key
    const generatedKey = (key && key.trim()) 
      ? key.trim().replace(/[^a-zA-Z0-9_]/g, '') 
      : label.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');

    const doc = await Department.findOne({ departmentId: 'SETTINGS_PAYROLL_HEADINGS' });
    let headings = [];
    if (doc && doc.description) {
      try {
        headings = JSON.parse(doc.description);
      } catch (e) {
        headings = [...DEFAULT_HEADINGS];
      }
    } else {
      headings = [...DEFAULT_HEADINGS];
    }

    // Check duplicate key or label
    const existing = headings.find(h => 
      h.key.toLowerCase() === generatedKey.toLowerCase() || 
      h.label.toLowerCase() === label.trim().toLowerCase()
    );

    if (existing) {
      return res.status(400).json({ message: 'A payroll heading with this name or key already exists' });
    }

    const adminId = (req.admin?._id && require('mongoose').Types.ObjectId.isValid(req.admin._id))
      ? req.admin._id.toString()
      : null;

    const newHeading = {
      _id: new (require('mongoose').Types.ObjectId)().toString(),
      key: generatedKey,
      label: label.trim(),
      type: type || 'currency',
      defaultValue: defaultValue !== undefined ? Number(defaultValue) : 0,
      isDefault: false,
      createdBy: adminId,
      createdByName: req.admin?.name || '',
      createdByRole: req.admin?.role || '',
      createdAt: new Date().toISOString()
    };

    headings.push(newHeading);

    await Department.findOneAndUpdate(
      { departmentId: 'SETTINGS_PAYROLL_HEADINGS' },
      { 
        $set: { 
          name: 'System Payroll Headings',
          departmentCode: 'SYS_PAYROLL_HEADINGS',
          description: JSON.stringify(headings)
        } 
      },
      { upsert: true, returnDocument: 'after' }
    );

    res.status(201).json({ success: true, message: 'Payroll heading created successfully', heading: newHeading });
  } catch (error) {
    console.error('Error creating payroll heading:', error);
    res.status(500).json({ message: error.message || 'Server error creating payroll heading' });
  }
};

// @desc    Delete a dynamic payroll heading
// @route   DELETE /api/payroll/headings/:id
// @access  Private/Admin (Super Admin, HR Head, or Junior with permission)
const deletePayrollHeading = async (req, res) => {
  try {
    if (!canManageHeadings(req.admin)) {
      return res.status(403).json({
        message: 'Permission denied. Only Super Admin, HR Head or permitted HR staff can delete payroll headings.'
      });
    }

    const targetId = req.params.id;
    const doc = await Department.findOne({ departmentId: 'SETTINGS_PAYROLL_HEADINGS' });
    let headings = [];
    if (doc && doc.description) {
      try {
        headings = JSON.parse(doc.description);
      } catch (e) {
        headings = [...DEFAULT_HEADINGS];
      }
    } else {
      headings = [...DEFAULT_HEADINGS];
    }

    const headingIndex = headings.findIndex(h => (h._id && h._id.toString() === targetId) || h.key === targetId);
    if (headingIndex === -1) {
      return res.status(404).json({ message: 'Payroll heading not found' });
    }

    if (headings[headingIndex].isDefault) {
      return res.status(400).json({ message: 'Default standard headings cannot be removed' });
    }

    headings.splice(headingIndex, 1);

    await Department.findOneAndUpdate(
      { departmentId: 'SETTINGS_PAYROLL_HEADINGS' },
      { 
        $set: { 
          name: 'System Payroll Headings',
          departmentCode: 'SYS_PAYROLL_HEADINGS',
          description: JSON.stringify(headings)
        } 
      },
      { upsert: true, returnDocument: 'after' }
    );

    res.status(200).json({ success: true, message: 'Payroll heading deleted successfully' });
  } catch (error) {
    console.error('Error deleting payroll heading:', error);
    res.status(500).json({ message: error.message || 'Server error deleting payroll heading' });
  }
};

// @desc    Get all payrolls
// @route   GET /api/payroll
// @access  Private/Admin
const getAllPayrolls = async (req, res) => {
  try {
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
    
    const isExecutive = !isMasterAdmin && !isHRHead && (
      roleLower.includes('executive') || cleanRole.includes('executive') ||
      desigLower.includes('executive') || cleanDesig.includes('executive')
    );

    const isManager = !isMasterAdmin && !isHRHead && !isExecutive && (
      roleLower.includes('manager') || cleanRole.includes('manager') ||
      desigLower.includes('manager') || cleanDesig.includes('manager')
    );

    const employeeQuery = { status: 'Active' };

    // Never show the logged-in user themselves in subordinate payroll management
    if (req.admin && req.admin._id) {
      employeeQuery._id = { $ne: req.admin._id };
    }

    // Role-based scoping
    if (isMasterAdmin) {
      // Sees all active employees (except self)
    } else if (isHRHead) {
      // HR Head sees all subordinate employees (exclude Superadmin/Admin/HR Head and self)
      employeeQuery.role = { $not: /superadmin|super admin|hr\s*head/i };
    } else if (isManager) {
      // HR Manager sees ALL Zones (Pan-India): HR Executives and all subordinate Staff
      // Excludes HR Head, HR Managers, Superadmin and self
      employeeQuery.role = { $not: /superadmin|super admin|admin|hr\s*head|hr\s*manager|manager/i };
    } else if (isExecutive) {
      // HR Executive sees strictly their own zone assigned/hired employees (No seniors, no self)
      const adminIdStr = req.admin?._id ? req.admin._id.toString() : '';
      const execZone = req.admin?.zone || 'NORTH';

      employeeQuery.role = { $not: /superadmin|super admin|admin|hr\s*head|hr\s*manager|manager|hr\s*executive/i };
      employeeQuery.zone = execZone;
      employeeQuery.$or = [
        { assignedHRId: adminIdStr },
        { assignedHRName: req.admin?.name },
        { zone: execZone }
      ];
    }

    const employees = await Employee.find(employeeQuery).select('empId name email role department zone assignedHRName onboardingStatus');
    const payrolls = await Payroll.find();
    
    // Map payrolls to employees
    const result = employees.map(emp => {
      const empPayroll = payrolls.find(p => p.employeeId.toString() === emp._id.toString());
      const isSelf = (req.admin?._id && emp._id.toString() === req.admin._id.toString()) || 
                     (req.admin?.email && emp.email === req.admin.email);
      
      const customFieldsObj = empPayroll && empPayroll.customFields 
        ? (empPayroll.customFields instanceof Map ? Object.fromEntries(empPayroll.customFields) : empPayroll.customFields) 
        : {};

      return {
        id: emp._id,
        empId: emp.empId || emp._id.toString(),
        name: emp.name,
        email: emp.email,
        role: emp.role || 'Employee',
        department: emp.department || '',
        zone: emp.zone || 'NORTH',
        assignedHRName: emp.assignedHRName || '',
        isSelf: !!isSelf,
        payroll: empPayroll ? {
          grossMonthly: empPayroll.grossMonthly,
          grossYearly: empPayroll.grossYearly,
          transport: empPayroll.transport,
          perfBonus: empPayroll.perfBonus,
          achievement: empPayroll.achievement,
          incentives: empPayroll.incentives,
          customFields: customFieldsObj,
          approvalStatus: empPayroll.approvalStatus || 'Approved',
          submittedByName: empPayroll.submittedByName || '',
          submittedByRole: empPayroll.submittedByRole || '',
          approvedByName: empPayroll.approvedByName || '',
          rejectionReason: empPayroll.rejectionReason || ''
        } : {
          grossMonthly: 0,
          grossYearly: 0,
          transport: 0,
          perfBonus: 0,
          achievement: 0,
          incentives: 0,
          customFields: {},
          approvalStatus: 'Approved',
          submittedByName: '',
          submittedByRole: '',
          approvedByName: '',
          rejectionReason: ''
        }
      };
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update employee payroll (with HR Manager approval workflow for HR Executive)
// @route   PUT /api/payroll/:employeeId
// @access  Private/Admin
const updatePayroll = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { grossMonthly, grossYearly, transport, perfBonus, achievement, incentives, customFields } = req.body;

    const roleLower = (req.admin?.role || '').toLowerCase();
    const cleanRole = roleLower.replace(/[^a-z0-9]/g, '');
    const isExecutive = cleanRole.includes('executive');

    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // HR Executive cannot modify their own salary
    if (isExecutive && (
      (req.admin?._id && employee._id.toString() === req.admin._id.toString()) ||
      (req.admin?.email && employee.email === req.admin.email)
    )) {
      return res.status(403).json({ message: 'You can only view/track your own salary structure. Contact HR Manager / HR Head for salary modifications.' });
    }

    let payroll = await Payroll.findOne({ employeeId });

    const approvalStatus = isExecutive ? 'Pending Approval' : 'Approved';

    if (payroll) {
      payroll.grossMonthly = grossMonthly !== undefined ? Number(grossMonthly) : payroll.grossMonthly;
      payroll.grossYearly = grossYearly !== undefined ? Number(grossYearly) : payroll.grossYearly;
      payroll.transport = transport !== undefined ? Number(transport) : payroll.transport;
      payroll.perfBonus = perfBonus !== undefined ? Number(perfBonus) : payroll.perfBonus;
      payroll.achievement = achievement !== undefined ? Number(achievement) : payroll.achievement;
      payroll.incentives = incentives !== undefined ? Number(incentives) : payroll.incentives;
      
      if (customFields && typeof customFields === 'object') {
        payroll.customFields = customFields;
      }

      payroll.approvalStatus = approvalStatus;
      payroll.submittedBy = req.admin?._id;
      payroll.submittedByName = req.admin?.name || 'HR Executive';
      payroll.submittedByRole = req.admin?.role || 'HR Executive';
      if (!isExecutive) {
        payroll.approvedBy = req.admin?._id;
        payroll.approvedByName = req.admin?.name || 'HR Manager';
      }
    } else {
      payroll = new Payroll({
        employeeId,
        grossMonthly: grossMonthly || 0,
        grossYearly: grossYearly || 0,
        transport: transport || 0,
        perfBonus: perfBonus || 0,
        achievement: achievement || 0,
        incentives: incentives || 0,
        customFields: customFields || {},
        approvalStatus,
        submittedBy: req.admin?._id,
        submittedByName: req.admin?.name || 'HR Executive',
        submittedByRole: req.admin?.role || 'HR Executive',
        approvedBy: isExecutive ? null : req.admin?._id,
        approvedByName: isExecutive ? '' : (req.admin?.name || 'HR Manager')
      });
    }

    await payroll.save();
    res.status(200).json(payroll);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve employee payroll structure (HR Manager / HR Head / Admin)
// @route   PUT /api/payroll/:employeeId/approve
// @access  Private/Admin
const approvePayroll = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const payroll = await Payroll.findOne({ employeeId });
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll structure not found' });
    }

    payroll.approvalStatus = 'Approved';
    payroll.approvedBy = req.admin?._id;
    payroll.approvedByName = req.admin?.name || 'HR Manager';
    payroll.rejectionReason = '';

    await payroll.save();
    res.status(200).json({ success: true, message: 'Payroll approved successfully', payroll });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reject employee payroll structure (HR Manager / HR Head / Admin)
// @route   PUT /api/payroll/:employeeId/reject
// @access  Private/Admin
const rejectPayroll = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { reason } = req.body;
    const payroll = await Payroll.findOne({ employeeId });
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll structure not found' });
    }

    payroll.approvalStatus = 'Rejected';
    payroll.approvedBy = req.admin?._id;
    payroll.approvedByName = req.admin?.name || 'HR Manager';
    payroll.rejectionReason = reason || 'Rejected by HR Manager';

    await payroll.save();
    res.status(200).json({ success: true, message: 'Payroll rejected', payroll });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  getAllPayrolls, 
  updatePayroll, 
  approvePayroll, 
  rejectPayroll,
  getPayrollHeadings,
  createPayrollHeading,
  deletePayrollHeading
};
