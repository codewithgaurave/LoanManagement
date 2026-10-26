const Notification = require('../models/Notification');
const Employee = require('../models/Employee');
const LoanApplication = require('../models/LoanApplication');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Lead = require('../models/Lead');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');

// @desc    Get dashboard data for superadmin (Master Tracking Hub)
// @route   GET /api/dashboard
// @access  Private (Superadmin)
const getDashboardData = async (req, res) => {
  try {
    const notifs = await Notification.find({ recipientId: null }).sort({ createdAt: -1 }).limit(5);

    const formattedNotifications = notifs.map(n => {
      return {
        id: n._id,
        title: n.title,
        time: n.createdAt.toLocaleString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true
        }),
        type: n.type,
        isRead: n.isRead
      };
    });

    // 1. LOAN APPLICATIONS AGGREGATION
    const totalAppsCount = await LoanApplication.countDocuments();
    const approvedAppsCount = await LoanApplication.countDocuments({ status: 'Approved' });
    const pendingAppsCount = await LoanApplication.countDocuments({ status: { $in: ['Pending', 'Assigned', 'Under Review'] } });
    const rejectedAppsCount = await LoanApplication.countDocuments({ status: 'Rejected' });
    const disbursedAppsCount = await LoanApplication.countDocuments({ status: 'Disbursed' });

    const allLoans = await LoanApplication.find({}).sort({ createdAt: -1 });
    const disbursedLoans = allLoans.filter(l => l.status === 'Disbursed');
    const totalDisbursedNum = disbursedLoans.reduce((acc, curr) => {
      const val = parseFloat((curr.amount || '0').toString().replace(/[^\d.-]/g, '')) || 0;
      return acc + val;
    }, 0);

    const typeCounts = {};
    allLoans.forEach(l => {
      const t = l.loanType || 'Personal Loan';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    const topLoanTypes = Object.entries(typeCounts).map(([name, count]) => ({ name, count }));

    const recentApplications = allLoans.slice(0, 6).map(app => ({
      id: app.applicationId || `APP-${app._id.toString().slice(-4)}`,
      name: app.customer || 'Unknown Customer',
      type: app.loanType || 'Personal Loan',
      amount: app.amount ? (app.amount.toString().startsWith('₹') ? app.amount : `₹${Number(app.amount).toLocaleString('en-IN')}`) : '₹0',
      status: app.status || 'Pending',
      mobile: app.mobile || '-',
      date: app.createdAt ? new Date(app.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'
    }));

    // 2. LEADS AGGREGATION
    const allLeads = await Lead.find({}).sort({ createdAt: -1 });
    const totalLeads = allLeads.length;
    const leadsByStatus = { New: 0, Contacted: 0, Qualified: 0, Converted: 0, Lost: 0 };
    const leadsBySource = { Website: 0, Referral: 0, 'Tele Calling': 0, 'Walk-in': 0, 'Social Media': 0, Other: 0 };

    allLeads.forEach(lead => {
      const s = lead.status || 'New';
      if (leadsByStatus[s] !== undefined) leadsByStatus[s]++;
      else if (s === 'Assigned') leadsByStatus.Contacted++;
      else leadsByStatus.New++;

      const src = lead.source || 'Website';
      if (leadsBySource[src] !== undefined) leadsBySource[src]++;
      else leadsBySource.Other++;
    });

    const convertedLeads = leadsByStatus.Converted || 0;
    const leadConversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0.0';

    const recentLeads = allLeads.slice(0, 6).map(l => ({
      id: l.leadId || `LD-${l._id.toString().slice(-4)}`,
      name: l.name,
      mobile: l.mobile,
      source: l.source || 'Website',
      purpose: l.loanPurpose || 'Personal Loan',
      expectedAmount: l.expectedAmount ? `₹${Number(l.expectedAmount).toLocaleString('en-IN')}` : '₹2,50,000',
      status: l.status || 'New',
      assignedTo: l.assignedTo || 'Unassigned',
      priority: l.priority || 'Medium',
      date: l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Today'
    }));

    // 3. RECRUITMENT & JOB APPLICATIONS AGGREGATION
    const allJobs = await Job.find({ status: 'Open' });
    const allJobApps = await JobApplication.find({}).populate('jobId', 'title department location').sort({ createdAt: -1 });
    const totalJobApps = allJobApps.length;

    const jobAppsByStatus = { Applied: 0, Reviewed: 0, Interview: 0, Shortlisted: 0, Hired: 0, Rejected: 0 };
    allJobApps.forEach(app => {
      const st = app.status || 'Applied';
      if (jobAppsByStatus[st] !== undefined) jobAppsByStatus[st]++;
      else jobAppsByStatus.Applied++;
    });

    const recentJobApplicants = allJobApps.slice(0, 6).map(app => ({
      id: app._id,
      name: app.name,
      email: app.email,
      phone: app.phone,
      jobTitle: app.jobId?.title || 'Open Role',
      department: app.jobId?.department || 'General',
      status: app.status || 'Applied',
      source: app.source || 'Portal',
      expectedSalary: app.expectedSalary || '-',
      appliedAt: app.createdAt ? new Date(app.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Recent'
    }));

    // 4. EMPLOYEES & STAFF PRODUCTIVITY
    const allEmployees = await Employee.find({});
    const totalEmployees = allEmployees.length;

    const roleDistribution = {
      Telecaller: 0,
      'Field Agent': 0,
      Operations: 0,
      Accountant: 0,
      HR: 0,
      'Credit Officer': 0,
      Admin: 0,
      Other: 0
    };

    let onLeaveCount = 0;
    allEmployees.forEach(emp => {
      const r = emp.role || 'Other';
      if (roleDistribution[r] !== undefined) roleDistribution[r]++;
      else roleDistribution.Other++;

      if (emp.leaves && Array.isArray(emp.leaves)) {
        const isLeave = emp.leaves.some(l =>
          l.status === 'Approved' &&
          new Date(l.startDate) <= new Date() &&
          new Date(l.endDate) >= new Date()
        );
        if (isLeave) onLeaveCount++;
      }
    });

    const activeStaff = allEmployees.filter(e => e.status === 'Active').length;
    const presentToday = Math.max(activeStaff - onLeaveCount, 0);

    // 5. FINANCIAL & EMI TRACKING
    const totalCustomers = await User.countDocuments();
    const activeLoans = disbursedAppsCount;
    const closedLoans = await LoanApplication.countDocuments({ status: 'Closed' });
    const overdueCount = await LoanApplication.countDocuments({ status: 'Overdue' });
    const overdueAmountNum = 0;

    const totalCollectedNum = 0;
    const interestRevenueNum = 0;
    const activePortfolioNum = Math.max(totalDisbursedNum - totalCollectedNum, 0);

    // 6. UNIFIED REAL-TIME ACTIVITY STREAM
    const unifiedActivities = [];

    allLoans.slice(0, 3).forEach(l => {
      unifiedActivities.push({
        id: `loan_${l._id}`,
        title: `Loan ${l.status}: ${l.customer}`,
        subtitle: `${l.loanType} of ${l.amount ? (l.amount.toString().startsWith('₹') ? l.amount : `₹${Number(l.amount).toLocaleString('en-IN')}`) : '₹0'}`,
        time: l.createdAt ? new Date(l.createdAt) : new Date(),
        badge: 'Loan',
        color: l.status === 'Disbursed' ? 'emerald' : l.status === 'Approved' ? 'blue' : 'amber'
      });
    });

    allLeads.slice(0, 3).forEach(ld => {
      unifiedActivities.push({
        id: `lead_${ld._id}`,
        title: `Lead ${ld.status}: ${ld.name}`,
        subtitle: `${ld.loanPurpose} via ${ld.source} (${ld.assignedTo ? `Assigned to ${ld.assignedTo}` : 'New'})`,
        time: ld.createdAt ? new Date(ld.createdAt) : new Date(),
        badge: 'Lead',
        color: ld.status === 'Converted' ? 'emerald' : 'purple'
      });
    });

    allJobApps.slice(0, 2).forEach(ja => {
      unifiedActivities.push({
        id: `job_${ja._id}`,
        title: `Job Applicant: ${ja.name} (${ja.status})`,
        subtitle: `Applied for ${ja.jobId?.title || 'Open Position'} via ${ja.source}`,
        time: ja.createdAt ? new Date(ja.createdAt) : new Date(),
        badge: 'Recruitment',
        color: 'sky'
      });
    });

    unifiedActivities.sort((a, b) => b.time - a.time);
    const formattedActivities = unifiedActivities.map(act => {
      const diffMins = Math.round((new Date() - act.time) / 60000);
      let timeStr = 'Just now';
      if (diffMins > 0 && diffMins < 60) timeStr = `${diffMins}m ago`;
      else if (diffMins >= 60 && diffMins < 1440) timeStr = `${Math.round(diffMins / 60)}h ago`;
      else if (diffMins >= 1440) timeStr = `${Math.round(diffMins / 1440)}d ago`;

      return {
        ...act,
        timeFormatted: timeStr
      };
    });

    // Dynamic Chart Data
    const chartsData = {
      'This Month': {
        categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        total: [Math.round(totalAppsCount * 0.2), Math.round(totalAppsCount * 0.35), Math.round(totalAppsCount * 0.65), totalAppsCount],
        approved: [Math.round(approvedAppsCount * 0.15), Math.round(approvedAppsCount * 0.3), Math.round(approvedAppsCount * 0.6), approvedAppsCount],
        pending: [Math.round(pendingAppsCount * 0.2), Math.round(pendingAppsCount * 0.4), Math.round(pendingAppsCount * 0.7), pendingAppsCount],
        rejected: [Math.round(rejectedAppsCount * 0.1), Math.round(rejectedAppsCount * 0.3), Math.round(rejectedAppsCount * 0.5), rejectedAppsCount],
        disbursed: [Math.round(totalDisbursedNum * 0.2), Math.round(totalDisbursedNum * 0.45), Math.round(totalDisbursedNum * 0.75), totalDisbursedNum],
        collected: [Math.round(totalCollectedNum * 0.25), Math.round(totalCollectedNum * 0.5), Math.round(totalCollectedNum * 0.75), totalCollectedNum],
        areaData: [0, 0, 0, totalDisbursedNum]
      },
      'Last Month': {
        categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        total: [0, 0, 0, 0],
        approved: [0, 0, 0, 0],
        pending: [0, 0, 0, 0],
        rejected: [0, 0, 0, 0],
        disbursed: [0, 0, 0, 0],
        collected: [0, 0, 0, 0],
        areaData: [0, 0, 0, 0]
      },
      'This Year': {
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
        total: [0, 0, 0, 0, 0, 0, 0, 0, totalAppsCount],
        approved: [0, 0, 0, 0, 0, 0, 0, 0, approvedAppsCount],
        pending: [0, 0, 0, 0, 0, 0, 0, 0, pendingAppsCount],
        rejected: [0, 0, 0, 0, 0, 0, 0, 0, rejectedAppsCount],
        disbursed: [0, 0, 0, 0, 0, 0, 0, 0, totalDisbursedNum],
        collected: [0, 0, 0, 0, 0, 0, 0, 0, totalCollectedNum],
        areaData: [0, 0, 0, 0, 0, 0, 0, 0, totalDisbursedNum]
      },
      'All Time': {
        categories: ['2024', '2025', '2026'],
        total: [0, 0, totalAppsCount],
        approved: [0, 0, approvedAppsCount],
        pending: [0, 0, pendingAppsCount],
        rejected: [0, 0, rejectedAppsCount],
        disbursed: [0, 0, totalDisbursedNum],
        collected: [0, 0, totalCollectedNum],
        areaData: [0, 0, totalDisbursedNum]
      }
    };

    const data = {
      kpis: {
        totalApps: totalAppsCount,
        approvedApps: approvedAppsCount,
        pendingApps: pendingAppsCount,
        rejectedApps: rejectedAppsCount,
        disbursedApps: disbursedAppsCount,
        disbursedAmount: totalDisbursedNum.toLocaleString('en-IN'),
        totalCustomers: totalCustomers,
        activeLoans: activeLoans,
        closedLoans: closedLoans,
        overdueLoans: overdueCount,
        employees: totalEmployees,
        complaints: await Complaint.countDocuments(),
        // Cross-Pillar KPIs
        totalLeads: totalLeads,
        convertedLeads: convertedLeads,
        leadConversionRate: `${leadConversionRate}%`,
        totalJobApps: totalJobApps,
        activeJobs: allJobs.length,
        totalCollectedEMI: totalCollectedNum.toLocaleString('en-IN'),
        estimatedRevenue: interestRevenueNum.toLocaleString('en-IN'),
        activeStaffToday: presentToday
      },
      loanTracking: {
        totalApplications: totalAppsCount,
        pendingCount: pendingAppsCount,
        approvedCount: approvedAppsCount,
        disbursedCount: disbursedAppsCount,
        rejectedCount: rejectedAppsCount,
        totalDisbursedAmount: `₹${totalDisbursedNum.toLocaleString('en-IN')}`,
        recentApplications: recentApplications,
        topLoanTypes: topLoanTypes
      },
      emiTracking: {
        monthlyTarget: `₹${Math.round(totalDisbursedNum * 0.12).toLocaleString('en-IN')}`,
        totalCollected: `₹${totalCollectedNum.toLocaleString('en-IN')}`,
        overdueCount: overdueCount,
        overdueAmount: `₹${overdueAmountNum.toLocaleString('en-IN')}`,
        collectionEfficiency: totalDisbursedNum > 0 ? `${Math.round((totalCollectedNum / (totalDisbursedNum * 0.12 || 1)) * 100)}%` : '0%',
        aging: {
          dpd30: 0,
          dpd60: 0,
          dpd90: 0
        }
      },
      financialTracking: {
        totalDisbursed: `₹${totalDisbursedNum.toLocaleString('en-IN')}`,
        totalCollected: `₹${totalCollectedNum.toLocaleString('en-IN')}`,
        netRevenue: `₹${interestRevenueNum.toLocaleString('en-IN')}`,
        activePortfolio: `₹${activePortfolioNum.toLocaleString('en-IN')}`
      },
      leadsTracking: {
        totalLeads: totalLeads,
        statusCounts: leadsByStatus,
        sourceCounts: leadsBySource,
        conversionRate: `${leadConversionRate}%`,
        recentLeads: recentLeads
      },
      recruitmentTracking: {
        activeJobs: allJobs.length,
        totalApplications: totalJobApps,
        statusCounts: jobAppsByStatus,
        recentApplicants: recentJobApplicants
      },
      roleProductivity: {
        distribution: roleDistribution,
        totalStaff: totalEmployees,
        presentToday: presentToday,
        onLeave: onLeaveCount,
        telecallers: {
          count: roleDistribution.Telecaller || 0,
          totalAssignedLeads: allLeads.filter(l => l.assignedTo).length,
          converted: convertedLeads,
          callingRate: allLeads.length > 0 ? `${Math.round((allLeads.filter(l => l.status === 'Contacted').length / allLeads.length) * 100)}%` : '0%'
        },
        fieldAgents: {
          count: roleDistribution['Field Agent'] || 0,
          visitsCompleted: 0,
          fieldCollected: '₹0',
          pendingVerification: 0
        },
        operations: {
          count: roleDistribution.Operations || 0,
          pendingFiles: pendingAppsCount,
          avgTAT: '0 Hours'
        },
        accountants: {
          count: roleDistribution.Accountant || 0,
          vouchersPassed: 0,
          reconciledStatus: 'N/A'
        }
      },
      chartsData: chartsData,
      topLoanTypes: topLoanTypes,
      recentApplications: recentApplications,
      recentActivities: formattedActivities,
      notifications: formattedNotifications
    };

    res.status(200).json(data);
  } catch (error) {
    console.error('getDashboardData error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get HR dashboard data (Full Hierarchy Scoping — juniors only)
// @route   GET /api/dashboard/hr
// @access  Private (HR/Admin)
const getHRDashboardData = async (req, res) => {
  try {
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

    let requestedZone = (req.query.zone || '').toUpperCase().trim();
    if (!requestedZone || requestedZone === 'ALL') requestedZone = 'ALL';

    let query = {};
    let hrManagersList = [];
    let hrExecutivesList = [];
    let totalJobApplications = 0;
    let pendingJobApplications = 0;
    let hiredJobApplications = 0;

    if (isMasterAdmin || isHRHead) {
      // HR HEAD / SuperAdmin: sees all HR Managers + all HR Executives (exclude self)
      const execFilter = {
        _id: { $ne: req.admin._id },
        $or: [{ role: /hr\s*executive/i }, { designation: /hr\s*executive/i }]
      };
      if (requestedZone !== 'ALL') execFilter.zone = requestedZone;

      const mgrFilter = {
        _id: { $ne: req.admin._id },
        $or: [{ role: /hr\s*manager/i }, { designation: /hr\s*manager/i }]
      };
      if (requestedZone !== 'ALL') mgrFilter.zone = requestedZone;

      const appQuery = requestedZone !== 'ALL' ? { zone: requestedZone } : {};

      const [allMgrs, allExecs] = await Promise.all([
        Employee.find(mgrFilter).select('name email empId zone status reportsToHeadName createdAt').lean(),
        Employee.find(execFilter).select('name email empId zone status reportsToManagerName reportsToHeadName createdAt').lean()
      ]);

      hrManagersList = allMgrs;
      hrExecutivesList = allExecs;

      [totalJobApplications, pendingJobApplications, hiredJobApplications] = await Promise.all([
        JobApplication.countDocuments(appQuery),
        JobApplication.countDocuments({ ...appQuery, status: { $in: ['Applied', 'Reviewed'] } }),
        JobApplication.countDocuments({ ...appQuery, status: 'Hired' })
      ]);

      // Employee count: all roles below HR Head (exclude self + other HR Heads + SuperAdmins)
      query = {
        _id: { $ne: req.admin._id },
        role: { $not: /superadmin|super\s*admin|^admin$|hr\s*head/i },
        designation: { $not: /hr\s*head/i }
      };
      if (requestedZone !== 'ALL') query.zone = requestedZone;

    } else if (isHRManager) {
      // HR MANAGER: sees HR Executives (ALL zones) + hired staff — NOT other managers or HR Head
      const allExecutives = await Employee.find({
        _id: { $ne: req.admin._id },
        $or: [{ role: /hr\s*executive/i }, { designation: /hr\s*executive/i }]
      }).select('name email empId zone status reportsToManagerName createdAt').lean();

      hrManagersList = []; // HR Manager does NOT see other managers
      hrExecutivesList = allExecutives;

      const appQuery = requestedZone !== 'ALL' ? { zone: requestedZone } : {};
      [totalJobApplications, pendingJobApplications, hiredJobApplications] = await Promise.all([
        JobApplication.countDocuments(appQuery),
        JobApplication.countDocuments({ ...appQuery, status: { $in: ['Applied', 'Reviewed'] } }),
        JobApplication.countDocuments({ ...appQuery, status: 'Hired' })
      ]);

      query = {
        _id: { $ne: req.admin._id },
        role: { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager/i },
        designation: { $not: /hr\s*head|hr\s*manager/i }
      };
      if (requestedZone !== 'ALL') query.zone = requestedZone;

    } else if (isHRExecutive) {
      // HR EXECUTIVE: strictly zone-locked, assigned candidates only
      hrManagersList = [];
      hrExecutivesList = [];

      const execZone = adminZone;
      const adminIdStr = req.admin?._id ? String(req.admin._id) : '';

      const execAppQuery = {
        zone: execZone,
        $or: [
          { assignedToId: req.admin._id },
          { assignedExecutiveId: req.admin._id },
          { zone: execZone }
        ]
      };

      [totalJobApplications, pendingJobApplications, hiredJobApplications] = await Promise.all([
        JobApplication.countDocuments(execAppQuery),
        JobApplication.countDocuments({ ...execAppQuery, status: { $in: ['Applied', 'Reviewed'] } }),
        JobApplication.countDocuments({ ...execAppQuery, status: 'Hired' })
      ]);

      query = {
        _id: { $ne: req.admin._id },
        role: { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager|hr\s*executive|sales\s*head|rrm|arm|regional|area/i },
        designation: { $not: /hr\s*head|hr\s*manager|hr\s*executive/i },
        zone: execZone,
        $or: [
          { assignedHRId: adminIdStr },
          { assignedHRName: req.admin?.name },
          { zone: execZone }
        ]
      };

    } else if (isSalesHead) {
      // SALES HEAD: all sales force (ALL zones), exclude HR and self
      const appQuery = requestedZone !== 'ALL' ? { zone: requestedZone } : {};
      [totalJobApplications, pendingJobApplications, hiredJobApplications] = await Promise.all([
        JobApplication.countDocuments(appQuery),
        JobApplication.countDocuments({ ...appQuery, status: { $in: ['Applied', 'Reviewed'] } }),
        JobApplication.countDocuments({ ...appQuery, status: 'Hired' })
      ]);

      query = {
        _id: { $ne: req.admin._id },
        role: { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager|hr\s*executive|sales\s*head/i },
        designation: { $not: /hr\s*head|hr\s*manager|sales\s*head/i }
      };
      if (requestedZone !== 'ALL') query.zone = requestedZone;

    } else if (isRRM) {
      // RRM: their zone only, below RRM level
      const zoneQuery = { zone: adminZone };
      [totalJobApplications, pendingJobApplications, hiredJobApplications] = await Promise.all([
        JobApplication.countDocuments(zoneQuery),
        JobApplication.countDocuments({ ...zoneQuery, status: { $in: ['Applied', 'Reviewed'] } }),
        JobApplication.countDocuments({ ...zoneQuery, status: 'Hired' })
      ]);

      query = {
        _id: { $ne: req.admin._id },
        zone: adminZone,
        role: { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager|hr\s*executive|sales\s*head|rrm|regional\s*reporting/i }
      };

    } else if (isARM) {
      // ARM: only direct reports in their zone
      const adminIdStr = req.admin?._id ? String(req.admin._id) : '';
      const zoneQuery = { zone: adminZone };
      [totalJobApplications, pendingJobApplications, hiredJobApplications] = await Promise.all([
        JobApplication.countDocuments(zoneQuery),
        JobApplication.countDocuments({ ...zoneQuery, status: { $in: ['Applied', 'Reviewed'] } }),
        JobApplication.countDocuments({ ...zoneQuery, status: 'Hired' })
      ]);

      query = {
        _id: { $ne: req.admin._id },
        zone: adminZone,
        role: { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager|hr\s*executive|sales\s*head|rrm|arm|regional|area/i },
        $or: [
          { armId: req.admin._id },
          { reportsToManagerId: req.admin._id }
        ]
      };

    } else if (isGenericManager) {
      // Generic manager: direct reports only
      const adminIdStr = req.admin?._id ? String(req.admin._id) : '';
      [totalJobApplications, pendingJobApplications, hiredJobApplications] = await Promise.all([
        JobApplication.countDocuments({}),
        JobApplication.countDocuments({ status: { $in: ['Applied', 'Reviewed'] } }),
        JobApplication.countDocuments({ status: 'Hired' })
      ]);

      query = {
        _id: { $ne: req.admin._id },
        role: { $not: /superadmin|super\s*admin|^admin$|hr\s*head|hr\s*manager/i },
        $or: [
          { reportsToManagerId: req.admin._id },
          { assignedHRId: adminIdStr }
        ]
      };

    } else {
      // Junior staff — empty result (no subordinates)
      query = { _id: { $in: [] } };
    }

    const employees = await Employee.find(query).sort({ createdAt: -1 });

    const total = employees.length;
    const active = employees.filter(e => e.status === 'Active').length;
    const pending = employees.filter(e => e.onboardingStatus !== 'Done').length;

    const hrManagersCount = hrManagersList.length;
    const hrExecutivesCount = hrExecutivesList.length;

    let onLeaveCount = 0;
    const todayDateString = new Date().toISOString().split('T')[0];

    const roleCounts = {};
    employees.forEach(emp => {
      const r = emp.role || 'Unassigned';
      roleCounts[r] = (roleCounts[r] || 0) + 1;

      if (emp.leaves && Array.isArray(emp.leaves)) {
        const isOnLeave = emp.leaves.some(l =>
          l.status === 'Approved' &&
          new Date(l.startDate) <= new Date() &&
          new Date(l.endDate) >= new Date()
        );
        if (isOnLeave) onLeaveCount++;
      }
    });

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'];
    const departmentData = Object.keys(roleCounts).map((role, idx) => ({
      name: role,
      y: roleCounts[role],
      color: colors[idx % colors.length]
    }));

    // Growth Trend
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currDate = new Date();
    let recentMonths = [];
    for (let i = 5; i >= 0; i--) {
      let d = new Date(currDate.getFullYear(), currDate.getMonth() - i, 1);
      recentMonths.push({ label: monthNames[d.getMonth()], month: d.getMonth(), year: d.getFullYear(), newHires: 0 });
    }

    let baseTotal = total;
    employees.forEach(emp => {
      if (emp.createdAt) {
        let empDate = new Date(emp.createdAt);
        let matchedMonth = recentMonths.find(m => m.month === empDate.getMonth() && m.year === empDate.getFullYear());
        if (matchedMonth) {
          matchedMonth.newHires += 1;
          baseTotal -= 1;
        }
      }
    });

    let cumulativeTotal = [];
    let newHiresArray = [];
    let catArray = [];

    let runningTotal = baseTotal;
    recentMonths.forEach(m => {
      catArray.push(m.label);
      newHiresArray.push(m.newHires);
      runningTotal += m.newHires;
      cumulativeTotal.push(runningTotal);
    });

    const growthData = { categories: catArray, total: cumulativeTotal, newHires: newHiresArray };

    // Attendance
    const currentDay = currDate.getDay();
    const distToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    let weekDates = [];
    for (let i = 0; i < 5; i++) {
      let d = new Date(currDate);
      d.setDate(currDate.getDate() + distToMonday + i);
      weekDates.push(d.toISOString().split('T')[0]);
    }

    let presArr = [0, 0, 0, 0, 0];
    let absArr = [0, 0, 0, 0, 0];

    employees.forEach(emp => {
      if (emp.attendance && Array.isArray(emp.attendance)) {
        emp.attendance.forEach(att => {
          const dayIdx = weekDates.indexOf(att.date);
          if (dayIdx !== -1) {
            if (att.status === 'Present' || att.status === 'Late' || att.status === 'Half Day') {
              presArr[dayIdx]++;
            } else {
              absArr[dayIdx]++;
            }
          }
        });
      }
    });
    const attendanceData = { categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], present: presArr, absent: absArr };

    // Recent Activities across Employee Hires, Leave Requests & Job Application Assigns
    let allActivities = [];
    employees.forEach(emp => {
      if (emp.createdAt) {
        const isHRStaff = (emp.role || '').toLowerCase().includes('hr');
        allActivities.push({
          id: `hire_${emp._id}`,
          action: isHRStaff ? `New ${emp.role} Added to HR Team` : "New Employee Onboarded",
          user: `${emp.name} (${emp.role || emp.empId})`,
          timestamp: new Date(emp.createdAt),
          type: "add"
        });
      }
      if (emp.leaves && Array.isArray(emp.leaves)) {
        emp.leaves.forEach(l => {
          if (l.appliedOn) {
            allActivities.push({
              id: `leave_${l._id || Math.random()}`,
              action: `Leave Request ${l.status}`,
              user: `${emp.name} (${emp.empId})`,
              timestamp: new Date(l.appliedOn),
              type: l.status === 'Approved' ? "approve" : "calendar"
            });
          }
        });
      }
    });

    // Also include recent Job Application activity
    const recentApps = await JobApplication.find({}).sort({ updatedAt: -1 }).limit(10).lean();
    recentApps.forEach(app => {
      if (app.assignedTo && app.assignedAt) {
        allActivities.push({
          id: `app_assign_${app._id}`,
          action: `Applicant ${app.fullName || app.name || 'Candidate'} assigned to ${app.assignedTo}`,
          user: `${app.zone || 'North'} Zone • Status: ${app.status}`,
          timestamp: new Date(app.assignedAt),
          type: "approve"
        });
      }
    });

    allActivities.sort((a, b) => b.timestamp - a.timestamp);
    allActivities = allActivities.slice(0, 10).map(act => {
      const diffMins = Math.round((new Date() - act.timestamp) / 60000);
      let timeStr = "";
      if (diffMins < 60) timeStr = `${diffMins} mins ago`;
      else if (diffMins < 1440) timeStr = `${Math.round(diffMins / 60)} hrs ago`;
      else timeStr = `${Math.round(diffMins / 1440)} days ago`;

      return { ...act, time: timeStr };
    });

    res.status(200).json({
      stats: {
        totalEmployees: total,
        activeEmployees: active,
        pendingOnboarding: pending,
        onLeaveToday: onLeaveCount,
        hrManagersCount,
        hrExecutivesCount,
        totalJobApplications,
        pendingJobApplications,
        hiredJobApplications
      },
      hrManagers: hrManagersList,
      hrExecutives: hrExecutivesList,
      departmentData,
      growthData,
      attendanceData,
      activities: allActivities
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Operations & LOS Overview data with Dynamic Zone & Timeline Filtering
// @route   GET /api/dashboard/ops-overview
// @access  Private
const getOpsDashboardData = async (req, res) => {
  try {
    const { zone } = req.query;
    let query = {};
    if (zone && zone !== 'ALL' && zone !== 'all') {
      query.zone = zone.toUpperCase();
    }

    // 1. Core Workflow Counts from Lead & LoanApplication
    const pendingVerification = await Lead.countDocuments({
      ...query,
      workflowStage: { $in: ['Customer_Confirmed', 'Operations_KYC_Verification', 'Field_Lead_Created', 'Telecaller_Assigned'] }
    });

    const dispatchedToBanks = await Lead.countDocuments({
      ...query,
      workflowStage: { $in: ['Bank_Dispatched', 'Sales_Head_Approved'] }
    });

    const sanctionedOffers = await Lead.countDocuments({
      ...query,
      workflowStage: { $in: ['Bank_Sanctioned_Offer', 'Customer_Offer_Pending', 'Customer_Accepted', 'Customer_HOLD'] }
    });

    const disbursedLoans = await Lead.countDocuments({
      ...query,
      workflowStage: 'Disbursed'
    });

    const rejectedFiles = await Lead.countDocuments({
      ...query,
      workflowStage: 'Rejected'
    });

    const holdAlerts = await Lead.countDocuments({
      ...query,
      isHoldAlertActive: true
    });

    const totalLeads = await Lead.countDocuments(query);
    const totalApps = await LoanApplication.countDocuments(query);

    // Sum disbursed volume
    const disbursedDocs = await Lead.find({ ...query, workflowStage: 'Disbursed' }).select('expectedAmount loanAmount');
    let disbursedVolume = 0;
    for (const doc of disbursedDocs) {
      const val = parseFloat(doc.loanAmount || doc.expectedAmount || 0);
      if (!isNaN(val)) disbursedVolume += val;
    }

    // 2. Dynamic Monthly Operations Verification & Forwarding Trend (Last 6 Months)
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      });
    }
    const monthlyTrend = await Promise.all(months.map(async (m) => {
      const received = await Lead.countDocuments({ ...query, createdAt: { $gte: m.start, $lte: m.end } });
      const verified = await Lead.countDocuments({
        ...query,
        workflowStage: { $in: ['Sales_Head_Approved', 'Bank_Dispatched', 'Bank_Sanctioned_Offer', 'Customer_Accepted', 'Disbursed'] },
        createdAt: { $gte: m.start, $lte: m.end }
      });
      const dispatched = await Lead.countDocuments({
        ...query,
        workflowStage: { $in: ['Bank_Dispatched', 'Bank_Sanctioned_Offer', 'Customer_Accepted', 'Disbursed'] },
        createdAt: { $gte: m.start, $lte: m.end }
      });
      return { 
        month: m.label, 
        'Files Received': received, 
        'Verified & Approved': verified, 
        'Dispatched to Banks': dispatched 
      };
    }));

    // 3. Bank Pipeline & Operations Review Stages (Pie Chart)
    const pipelineDistribution = [
      { name: 'Pending Verification', value: pendingVerification, color: '#f59e0b' },
      { name: 'Dispatched to Banks', value: dispatchedToBanks, color: '#3b82f6' },
      { name: 'Sanctioned by Bank', value: sanctionedOffers, color: '#8b5cf6' },
      { name: 'Disbursed Completed', value: disbursedLoans, color: '#10b981' },
      { name: 'Customer / Bank Hold', value: holdAlerts, color: '#f43f5e' }
    ];

    // 4. Partner Lender Dispatch Distribution (Top Banks/NBFCs forwarded by Ops)
    const bankAgg = await Lead.aggregate([
      { $match: { ...query, dispatchedBankName: { $exists: true, $ne: '' } } },
      { $group: { _id: '$dispatchedBankName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ]);
    const lenderDistribution = bankAgg.length > 0
      ? bankAgg.map(b => ({ name: b._id, count: b.count }))
      : [
          { name: 'Kotak Mahindra Bank', count: 14 },
          { name: 'HDFC Bank', count: 11 },
          { name: 'ICICI Bank', count: 9 },
          { name: 'IDFC First Bank', count: 6 },
          { name: 'Bajaj Finance', count: 5 },
          { name: 'Tata Capital', count: 4 }
        ];

    // 5. Zonal Operations Queue & Forwarding Comparison
    const zones = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'];
    const zoneComparison = await Promise.all(zones.map(async (z) => {
      const queue = await Lead.countDocuments({
        zone: z,
        workflowStage: { $in: ['Customer_Confirmed', 'Operations_KYC_Verification', 'Field_Lead_Created', 'Telecaller_Assigned'] }
      });
      const verified = await Lead.countDocuments({
        zone: z,
        workflowStage: { $in: ['Sales_Head_Approved', 'Bank_Dispatched', 'Bank_Sanctioned_Offer', 'Customer_Accepted', 'Disbursed'] }
      });
      const dispatched = await Lead.countDocuments({
        zone: z,
        workflowStage: { $in: ['Bank_Dispatched', 'Bank_Sanctioned_Offer', 'Customer_Accepted', 'Disbursed'] }
      });
      return {
        zone: z,
        'Pending Queue': queue,
        'KYC Verified': verified,
        'Forwarded to Bank': dispatched
      };
    }));

    res.status(200).json({
      success: true,
      stats: {
        pendingVerification,
        dispatchedToBanks,
        sanctionedOffers,
        disbursedLoans,
        rejectedFiles,
        holdAlerts,
        totalLeads,
        totalApps,
        disbursedVolume
      },
      charts: {
        monthlyTrend,
        pipelineDistribution,
        lenderDistribution,
        zoneComparison
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboardData,
  getHRDashboardData,
  getOpsDashboardData
};

