const Employee = require('../models/Employee');

const getScopedEmployeeQuery = (req) => {
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
  
  const query = {};
  if (req.admin && req.admin._id) {
    query._id = { $ne: req.admin._id };
  }

  const requestedZone = req.query.zone;
  if (requestedZone && requestedZone !== 'All' && requestedZone !== 'all' && requestedZone !== 'ALL') {
    query.zone = requestedZone;
  }

  const isExecutive = !isMasterAdmin && !isHRHead && (
    roleLower.includes('executive') || cleanRole.includes('executive') ||
    desigLower.includes('executive') || cleanDesig.includes('executive')
  );

  const isManager = !isMasterAdmin && !isHRHead && !isExecutive && (
    roleLower.includes('manager') || cleanRole.includes('manager') ||
    desigLower.includes('manager') || cleanDesig.includes('manager')
  );

  if (isExecutive) {
    // HR Executive only sees their own activity and employees hired/handled by them
    const adminIdStr = req.admin?._id ? req.admin._id.toString() : '';
    const nameRegex = new RegExp(req.admin?.name || '', 'i');
    query.role = { $not: /superadmin|super admin|admin|hr\s*head|hr\s*manager|manager/i };

    const cond = [
      { assignedHRId: adminIdStr },
      { assignedHRName: nameRegex }
    ];
    if (req.admin?.zone && req.admin.zone !== 'ALL') {
      cond.push({ zone: req.admin.zone });
    }
    query.$or = cond;
  } else if (isManager) {
    query.role = { $not: /superadmin|super admin|admin|hr\s*head/i };
    if (req.admin?.zone && req.admin.zone !== 'ALL' && !requestedZone) {
      query.zone = req.admin.zone;
    }
  }

  if (req.query.department && req.query.department !== 'All' && req.query.department !== 'all') {
    query.division = req.query.department;
  }

  return query;
};

// @desc    Get Employee Reports
// @route   GET /api/reports/employee
// @access  Private
const getEmployeeReport = async (req, res) => {
  try {
    const query = getScopedEmployeeQuery(req);
    const employees = await Employee.find(query);
    
    // 1. Department Breakdown (Pie chart)
    const deptCount = {};
    employees.forEach(emp => {
      const div = emp.division || 'Unassigned';
      deptCount[div] = (deptCount[div] || 0) + 1;
    });
    
    const departmentChartData = Object.keys(deptCount).map(key => ({
      name: key,
      y: deptCount[key]
    }));

    // 2. New Hires over last 6 months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const categories = [];
    const hiresData = [0, 0, 0, 0, 0, 0];
    
    // Setup last 6 months categories
    for (let i = 5; i >= 0; i--) {
      let d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      categories.push(monthNames[d.getMonth()]);
    }

    employees.forEach(emp => {
      const createdAt = new Date(emp.createdAt);
      if (createdAt) {
        const diffMonths = (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth());
        if (diffMonths >= 0 && diffMonths <= 5) {
          const idx = 5 - diffMonths;
          hiresData[idx]++;
        }
      }
    });

    res.status(200).json({
      totalEmployees: employees.length,
      departmentChartData,
      growthCategories: categories,
      growthData: hiresData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Attendance Reports
// @route   GET /api/reports/attendance
// @access  Private
const getAttendanceReport = async (req, res) => {
  try {
    const query = getScopedEmployeeQuery(req);
    const employees = await Employee.find(query);
    
    // Mock Weekly Logic for Attendance columns
    let presentData = [0, 0, 0, 0, 0];
    let lateData = [0, 0, 0, 0, 0];
    let absentData = [0, 0, 0, 0, 0];
    
    // Department late incidents
    const lateByDept = {};

    const now = new Date();
    const currentMonthStr = now.toISOString().slice(0, 7); // 'YYYY-MM'

    employees.forEach(emp => {
      const div = emp.division || 'Unassigned';
      if (!lateByDept[div]) lateByDept[div] = 0;

      if (emp.attendance && emp.attendance.length > 0) {
        emp.attendance.forEach((record) => {
          if (record.date && record.date.startsWith(currentMonthStr)) {
            const day = parseInt(record.date.split('-')[2], 10);
            let weekIdx = Math.floor((day - 1) / 7);
            if (weekIdx > 4) weekIdx = 4; // cap at 5th week

            if (record.status === 'Present') presentData[weekIdx]++;
            else if (record.status === 'Absent' || record.status === 'Leave') absentData[weekIdx]++;
            else if (record.status === 'Half Day' || record.status === 'Late') {
              lateData[weekIdx]++;
              lateByDept[div]++;
            }
          }
        });
      }
    });

    const lateCategories = Object.keys(lateByDept);
    const lateChartData = Object.values(lateByDept);

    res.status(200).json({
      attendanceWeekly: {
        present: presentData,
        late: lateData,
        absent: absentData
      },
      lateDepartment: {
        categories: lateCategories,
        data: lateChartData
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Leave Reports
// @route   GET /api/reports/leaves
// @access  Private
const getLeaveReport = async (req, res) => {
  try {
    const query = getScopedEmployeeQuery(req);
    const employees = await Employee.find(query);
    
    let approved = 0, pending = 0, rejected = 0;
    const leaveTypes = {
      'Sick Leave': 0,
      'Casual Leave': 0,
      'Earned Leave': 0,
      'Emergency Leave': 0
    };

    employees.forEach(emp => {
      if (emp.leaves && emp.leaves.length > 0) {
        emp.leaves.forEach(lv => {
          if (lv.status === 'Approved') approved++;
          else if (lv.status === 'Pending') pending++;
          else if (lv.status === 'Rejected') rejected++;

          const typeName = lv.type || 'Casual Leave';
          if (leaveTypes[typeName] !== undefined) {
            leaveTypes[typeName] += 1;
          } else {
            leaveTypes['Casual Leave'] += 1;
          }
        });
      }
    });

    const leaveSummaryData = [
      { name: 'Approved', y: approved },
      { name: 'Pending', y: pending },
      { name: 'Rejected', y: rejected }
    ];

    const leaveTypesCategories = Object.keys(leaveTypes);
    const leaveTypesData = Object.values(leaveTypes);

    res.status(200).json({
      leaveSummaryData,
      leaveTypesCategories,
      leaveTypesData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Documents Reports
// @route   GET /api/reports/documents
// @access  Private
const getDocumentReport = async (req, res) => {
  try {
    const query = getScopedEmployeeQuery(req);
    const employees = await Employee.find(query);
    
    let verified = 0, pending = 0, rejected = 0;
    const uploadsByDept = {};

    employees.forEach(emp => {
      const div = emp.division || 'Unassigned';
      if (!uploadsByDept[div]) uploadsByDept[div] = 0;

      if (emp.documents && emp.documents.length > 0) {
        emp.documents.forEach(doc => {
          if (doc.status === 'Verified') verified++;
          else if (doc.status === 'Rejected') rejected++;
          else pending++;
          
          uploadsByDept[div]++;
        });
      }
    });

    const documentStatusData = [
      { name: 'Verified', y: verified },
      { name: 'Pending', y: pending },
      { name: 'Rejected', y: rejected }
    ];

    res.status(200).json({
      documentStatusData,
      uploadsDepartment: {
        categories: Object.keys(uploadsByDept),
        data: Object.values(uploadsByDept)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Performance Reports
// @route   GET /api/reports/performance
// @access  Private
const getPerformanceReport = async (req, res) => {
  try {
    const query = getScopedEmployeeQuery(req);
    const employees = await Employee.find(query);
    
    let outstanding = 0, exceeds = 0, meets = 0, needsImprovement = 0;
    employees.forEach(emp => {
      // If there is no real performance rating field in the db, we keep it 0.
      if (emp.performanceRating === 'Outstanding') outstanding++;
      else if (emp.performanceRating === 'Exceeds Expectations') exceeds++;
      else if (emp.performanceRating === 'Meets Expectations') meets++;
      else if (emp.performanceRating === 'Needs Improvement') needsImprovement++;
    });

    const performanceRatingsData = [outstanding, exceeds, meets, needsImprovement];

    // Dummy KPI trend, since we don't have KPI monthly tables yet
    const kpiCategories = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const kpiData = [0, 0, 0, 0, 0, 0];

    res.status(200).json({
      performanceRatingsData,
      kpiCategories,
      kpiData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getEmployeeReport,
  getAttendanceReport,
  getLeaveReport,
  getDocumentReport,
  getPerformanceReport
};
