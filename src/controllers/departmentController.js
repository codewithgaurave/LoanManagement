const Department = require('../models/Department');
const Employee = require('../models/Employee');
const Admin = require('../models/Admin');

// Default sub-roles mapping for standard departments
const DEFAULT_SUB_ROLES = {
  'OPERATIONAL': ['Operation Manager', 'Operation Executive', 'Treasury Officer', 'Payroll Manager', 'Account Manager', 'Credit Manager'],
  'FIELD-SALES': ['Sales Trainer', 'Relationship Manager', 'Relationship Executive', 'Relationship Officer'],
  'BRANCH SALES': ['Regional Sales Manager', 'Area Sales Manager', 'Branch Manager', 'Reporting Team Manager'],
  'COLLECTIONS': ['Collection Manager', 'Collection Executive', 'Field Investigation Officer'],
  'OFFICIAL WORK': ['Customer Care Executive - CCE', 'Customer Support Representative - CSR', 'Front Desk Executive'],
  'HR': ['HR Manager', 'HR Executive', 'Recruitment Specialist'],
  'CREDIT': ['Credit Manager', 'Credit Executive', 'Underwriter', 'Risk Analyst'],
  'ACCOUNTS': ['Chief Accountant', 'Senior Accountant', 'Cashier']
};

// @desc    Get all departments enriched with Head details, headcount, team members and budget
// @route   GET /api/departments
// @access  Private / Public
const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find({ departmentId: { $not: /^SETTINGS_/ } }).populate('headEmployeeId', 'name email mobile designation role empId avatar').sort({ name: 1 });
    const employees = await Employee.find({ status: 'Active' });

    const enrichedDepartments = await Promise.all(departments.map(async (dept) => {
      // Find all employees belonging to this department
      const deptEmployees = employees.filter(emp => 
        (emp.departmentId && emp.departmentId.toString() === dept._id.toString()) ||
        (emp.division && emp.division.toLowerCase() === dept.name.toLowerCase())
      );
      
      const headcount = deptEmployees.length;
      
      // Calculate dynamic budget from grossMonthly if no override budget exists
      let calculatedBudget = 0;
      if (dept.budget > 0) {
        calculatedBudget = dept.budget;
      } else {
        calculatedBudget = deptEmployees.reduce((acc, emp) => acc + ((emp.grossMonthly || 0) * 12), 0);
      }

      // Check for Head info
      let headObj = dept.headEmployeeId;
      let currentHeadName = dept.head;
      let currentHeadRole = dept.headRole;
      let headEmail = dept.headEmail;
      let headPhone = dept.headPhone;

      if (headObj) {
        currentHeadName = headObj.name;
        currentHeadRole = headObj.designation || headObj.role;
        headEmail = headObj.email;
        headPhone = headObj.mobile;
      } else if (currentHeadName === 'N/A' && deptEmployees.length > 0) {
        // Auto-detect potential head if manager/head designation exists
        const potentialHead = deptEmployees.find(e => 
          e.isDepartmentHead ||
          e.designation?.toLowerCase().includes('head') ||
          e.designation?.toLowerCase().includes('manager')
        );
        if (potentialHead) {
          currentHeadName = potentialHead.name;
          currentHeadRole = potentialHead.designation;
          headEmail = potentialHead.email;
          headPhone = potentialHead.mobile;
        }
      }

      // Sub-roles list
      const subRoles = dept.subRoles && dept.subRoles.length > 0 
        ? dept.subRoles 
        : (DEFAULT_SUB_ROLES[dept.name.toUpperCase()] || Array.from(new Set(deptEmployees.map(e => e.designation).filter(Boolean))));

      return {
        _id: dept._id,
        id: dept.departmentId,
        departmentCode: dept.departmentCode || `D-${dept.name.substring(0, 3).toUpperCase()}`,
        name: dept.name,
        description: dept.description,
        head: currentHeadName,
        headRole: currentHeadRole,
        headEmployeeId: dept.headEmployeeId?._id || dept.headEmployeeId || null,
        headDetails: headObj || (currentHeadName !== 'N/A' ? { name: currentHeadName, designation: currentHeadRole, email: headEmail, phone: headPhone } : null),
        subRoles,
        headcount: headcount,
        teamMembers: deptEmployees.map(e => ({
          _id: e._id,
          empId: e.empId,
          name: e.name,
          email: e.email,
          mobile: e.mobile,
          designation: e.designation,
          role: e.role,
          isHead: e.isDepartmentHead || (dept.headEmployeeId && dept.headEmployeeId._id?.toString() === e._id.toString())
        })),
        budgetNum: calculatedBudget,
        status: dept.status
      };
    }));

    res.status(200).json(enrichedDepartments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get complete organizational hierarchy tree (Heads -> Sub-roles -> Employees)
// @route   GET /api/departments/hierarchy
// @access  Private
const getDepartmentHierarchy = async (req, res) => {
  try {
    const departments = await Department.find({ status: 'Active' }).populate('headEmployeeId');
    const employees = await Employee.find({ status: 'Active' });

    const hierarchy = departments.map(dept => {
      const deptEmployees = employees.filter(emp => 
        (emp.departmentId && emp.departmentId.toString() === dept._id.toString()) ||
        (emp.division && emp.division.toLowerCase() === dept.name.toLowerCase())
      );

      return {
        departmentId: dept._id,
        departmentName: dept.name,
        departmentCode: dept.departmentCode || `D-${dept.name.substring(0, 3).toUpperCase()}`,
        head: dept.headEmployeeId ? {
          _id: dept.headEmployeeId._id,
          name: dept.headEmployeeId.name,
          email: dept.headEmployeeId.email,
          mobile: dept.headEmployeeId.mobile,
          designation: dept.headEmployeeId.designation,
          role: dept.headEmployeeId.role,
          empId: dept.headEmployeeId.empId
        } : {
          name: dept.head,
          designation: dept.headRole,
          email: dept.headEmail,
          mobile: dept.headPhone
        },
        subRoles: dept.subRoles || [],
        teamCount: deptEmployees.length,
        team: deptEmployees.map(emp => ({
          _id: emp._id,
          empId: emp.empId,
          name: emp.name,
          email: emp.email,
          mobile: emp.mobile,
          designation: emp.designation,
          role: emp.role,
          reportsTo: dept.headEmployeeId ? dept.headEmployeeId.name : dept.head
        }))
      };
    });

    res.status(200).json(hierarchy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign or change Department Head
// @route   PUT /api/departments/:id/assign-head
// @access  Private (Super Admin)
const assignDepartmentHead = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    if (!employeeId) {
      // Remove head
      if (department.headEmployeeId) {
        await Employee.findByIdAndUpdate(department.headEmployeeId, { isDepartmentHead: false });
      }
      department.headEmployeeId = null;
      department.head = 'N/A';
      department.headRole = 'N/A';
      department.headEmail = '';
      department.headPhone = '';
      await department.save();
      return res.status(200).json({ message: 'Department Head unassigned', department });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Unset previous head flag if exists
    if (department.headEmployeeId && department.headEmployeeId.toString() !== employee._id.toString()) {
      await Employee.findByIdAndUpdate(department.headEmployeeId, { isDepartmentHead: false });
    }

    // Set new head on department
    department.headEmployeeId = employee._id;
    department.head = employee.name;
    department.headRole = employee.designation || 'Department Head';
    department.headEmail = employee.email;
    department.headPhone = employee.mobile;
    await department.save();

    // Mark employee as Department Head & link department
    employee.isDepartmentHead = true;
    employee.departmentId = department._id;
    employee.division = department.name;
    await employee.save();

    // Update all team members in this department to report to this head
    await Employee.updateMany(
      { 
        $or: [{ departmentId: department._id }, { division: department.name }],
        _id: { $ne: employee._id }
      },
      { 
        $set: { 
          reportsToHeadId: employee._id,
          reportsToHeadName: employee.name,
          departmentId: department._id
        } 
      }
    );

    // If head has an Admin account, sync role/permissions
    let admin = await Admin.findOne({ email: employee.email });
    if (admin) {
      admin.role = `${department.name} Head`;
      await admin.save();
    }

    res.status(200).json({ 
      message: `${employee.name} assigned as Head of ${department.name}`, 
      department,
      head: employee 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new department
// @route   POST /api/departments
// @access  Private
const createDepartment = async (req, res) => {
  try {
    const { name, head, headRole, headEmployeeId, subRoles, budget, status, description, departmentCode } = req.body;
    
    // Check if department already exists
    const deptExists = await Department.findOne({ name });
    if (deptExists) {
      return res.status(400).json({ message: 'Department with this name already exists' });
    }

    // Generate simple ID
    const count = await Department.countDocuments();
    const departmentId = `DEPT-${(count + 1).toString().padStart(2, '0')}`;

    let resolvedHeadName = head || 'N/A';
    let resolvedHeadRole = headRole || 'N/A';
    let resolvedHeadEmail = '';
    let resolvedHeadPhone = '';

    if (headEmployeeId) {
      const emp = await Employee.findById(headEmployeeId);
      if (emp) {
        resolvedHeadName = emp.name;
        resolvedHeadRole = emp.designation || 'Department Head';
        resolvedHeadEmail = emp.email;
        resolvedHeadPhone = emp.mobile;
        emp.isDepartmentHead = true;
        await emp.save();
      }
    }

    const department = await Department.create({
      departmentId,
      departmentCode: departmentCode || `D-${name.substring(0, 3).toUpperCase()}`,
      name,
      description: description || '',
      head: resolvedHeadName,
      headRole: resolvedHeadRole,
      headEmployeeId: headEmployeeId || null,
      headEmail: resolvedHeadEmail,
      headPhone: resolvedHeadPhone,
      subRoles: subRoles || (DEFAULT_SUB_ROLES[name.toUpperCase()] || []),
      budget: budget || 0,
      status: status || 'Active'
    });

    res.status(201).json(department);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a department
// @route   PUT /api/departments/:id
// @access  Private
const updateDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const { headEmployeeId } = req.body;
    if (headEmployeeId && headEmployeeId !== department.headEmployeeId?.toString()) {
      const emp = await Employee.findById(headEmployeeId);
      if (emp) {
        req.body.head = emp.name;
        req.body.headRole = emp.designation || 'Department Head';
        req.body.headEmail = emp.email;
        req.body.headPhone = emp.mobile;
        emp.isDepartmentHead = true;
        emp.departmentId = department._id;
        await emp.save();
      }
    }

    const updatedDept = await Department.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json(updatedDept);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a department
// @route   DELETE /api/departments/:id
// @access  Private
const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    if (department.headEmployeeId) {
      await Employee.findByIdAndUpdate(department.headEmployeeId, { isDepartmentHead: false });
    }

    await department.deleteOne();
    res.status(200).json({ message: 'Department removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDepartments,
  getDepartmentHierarchy,
  assignDepartmentHead,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
