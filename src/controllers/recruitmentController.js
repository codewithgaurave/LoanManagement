const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const { createNotification } = require('./notificationController');
const sendEmail = require('../utils/emailService');

// @desc    Get all jobs
// @route   GET /api/recruitment/jobs
// @access  Public (Only open & published jobs) or Private (All jobs for admin)
const getJobs = async (req, res) => {
  try {
    const { status, publishStatus, isPublic } = req.query;
    const query = {};

    // If request has no auth token (website) or explicit isPublic=true or status=Open from public website:
    const isPublicReq = isPublic === 'true' || (!req.admin && status === 'Open') || !req.headers?.authorization;

    if (isPublicReq) {
      query.status = 'Open';
      query.publishStatus = 'Published';
    } else {
      if (status && status !== 'all') query.status = status;
      if (publishStatus && publishStatus !== 'all') query.publishStatus = publishStatus;

      // Role & Zone-based scoping for staff in admin portal
      const roleLower = (req.admin?.role || '').toLowerCase();
      const desigLower = (req.admin?.designation || '').toLowerCase();
      const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'administrator'].includes(roleLower);
      const isHRHead = ['hr head', 'hr_head', 'hr admin', 'hradmin'].includes(roleLower) || desigLower.includes('hr head');
      const isExecutive = !isMasterAdmin && !isHRHead && (roleLower.includes('executive') || desigLower.includes('executive'));

      if (isExecutive && req.admin?.zone && req.admin.zone !== 'ALL') {
        query.$or = [
          { zone: req.admin.zone },
          { zone: 'ALL' },
          { createdBy: req.admin._id }
        ];
      }
    }
    
    // Fetch jobs matching query
    const jobs = await Job.find(query).sort({ createdAt: -1 });

    // Calculate hired counts for each job
    const jobsWithStats = await Promise.all(jobs.map(async (job) => {
      const hiredCount = await JobApplication.countDocuments({ jobId: job._id, status: 'Hired' });
      return { ...job.toObject(), hiredCount };
    }));

    // If public request, filter out those where hiredCount >= openings
    if (isPublicReq) {
       const activeJobs = jobsWithStats.filter(j => j.hiredCount < (j.openings || 1));
       return res.status(200).json(activeJobs);
    }
    
    res.status(200).json(jobsWithStats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get distinct filter options (departments & designations) from added active jobs
// @route   GET /api/recruitment/jobs-filters
// @access  Public
const getJobFilterOptions = async (req, res) => {
  try {
    const query = { status: 'Open', publishStatus: 'Published' };

    // Find all active published jobs
    const jobs = await Job.find(query).select('department designation title openings _id');

    // Calculate hired counts for each job to ensure we only include active unfilled jobs
    const activeJobs = [];
    for (const job of jobs) {
      const hiredCount = await JobApplication.countDocuments({ jobId: job._id, status: 'Hired' });
      if (hiredCount < (job.openings || 1)) {
        activeJobs.push(job);
      }
    }

    // Extract unique departments from active jobs
    const departments = Array.from(
      new Set(
        activeJobs
          .map(j => (j.department || '').trim())
          .filter(Boolean)
      )
    ).sort();

    // Map each department to its specific designations from the added jobs
    const departmentDesignations = {};
    for (const dept of departments) {
      const desigs = Array.from(
        new Set(
          activeJobs
            .filter(j => (j.department || '').trim().toLowerCase() === dept.toLowerCase())
            .flatMap(j => [j.designation, j.title])
            .map(d => (d || '').trim())
            .filter(Boolean)
        )
      ).sort();
      departmentDesignations[dept] = desigs;
    }

    // All distinct designations across all active jobs
    const allDesignations = Array.from(
      new Set(
        activeJobs
          .flatMap(j => [j.designation, j.title])
          .map(d => (d || '').trim())
          .filter(Boolean)
      )
    ).sort();

    res.status(200).json({
      departments,
      departmentDesignations,
      designations: allDesignations
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get job by ID
// @route   GET /api/recruitment/jobs/:id
// @access  Public
const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.status(200).json(job);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a job
// @route   POST /api/recruitment/jobs
// @access  Private (Admin/HR)
const createJob = async (req, res) => {
  try {
    const { title, designation, type, department, location, description, status, openings, skills, publishStatus, zone } = req.body;
    const { getZoneFromState } = require('../utils/zoneHelper');

    // Auto-detect or enforce Zone
    let assignedZone = zone;
    const roleLower = (req.admin?.role || '').toLowerCase();
    const desigLower = (req.admin?.designation || '').toLowerCase();
    const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'administrator'].includes(roleLower);
    const isHRHead = ['hr head', 'hr_head', 'hr admin', 'hradmin'].includes(roleLower) || desigLower.includes('hr head');
    const isExecutive = !isMasterAdmin && !isHRHead && (roleLower.includes('executive') || desigLower.includes('executive'));

    if (isExecutive && req.admin?.zone && req.admin.zone !== 'ALL') {
      // HR Executive is locked to their designated zone
      assignedZone = req.admin.zone;
    } else if (!assignedZone) {
      // Extract state from location string like "Lucknow, UTTAR PRADESH"
      const parts = (location || '').split(',');
      const statePart = parts.length > 1 ? parts[parts.length - 1].trim() : parts[0].trim();
      assignedZone = getZoneFromState(statePart) || req.admin?.zone || 'NORTH';
    }
    
    const job = new Job({
      title,
      designation: designation || title || '',
      type,
      department,
      location,
      zone: assignedZone || 'NORTH',
      description,
      openings: openings || 1,
      skills: skills || '',
      status: status || 'Open',
      publishStatus: publishStatus || 'Published',
      createdBy: req.admin._id
    });
    
    const createdJob = await job.save();
    res.status(201).json(createdJob);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a job
// @route   PUT /api/recruitment/jobs/:id
// @access  Private (Admin/HR)
const updateJob = async (req, res) => {
  try {
    const { title, designation, type, department, location, description, status, openings, skills, publishStatus, zone } = req.body;
    const job = await Job.findById(req.params.id);
    
    if (!job) return res.status(404).json({ message: 'Job not found' });
    
    job.title = title || job.title;
    if (designation !== undefined) job.designation = designation;
    job.type = type || job.type;
    job.department = department || job.department;
    job.location = location || job.location;
    if (zone !== undefined) job.zone = zone;
    job.description = description || job.description;
    job.status = status || job.status;
    if (publishStatus !== undefined) job.publishStatus = publishStatus;
    if (openings !== undefined) job.openings = openings;
    if (skills !== undefined) job.skills = skills;
    
    const updatedJob = await job.save();
    res.status(200).json(updatedJob);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a job
// @route   DELETE /api/recruitment/jobs/:id
// @access  Private (Admin/HR)
const deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    
    await Job.deleteOne({ _id: job._id });
    res.status(200).json({ message: 'Job removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Apply for a job
// @route   POST /api/recruitment/jobs/:id/apply
// @access  Public
const applyForJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId);
    
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.status !== 'Open') return res.status(400).json({ message: 'This job is no longer open for applications' });

    const data = req.body;
    
    // Parse JSON arrays for education and experience if they are sent as strings in FormData
    let education = [];
    let experience = [];
    if (data.education) {
      try { education = JSON.parse(data.education); } catch(e) { education = data.education; }
    }
    if (data.experience) {
      try { experience = JSON.parse(data.experience); } catch(e) { experience = data.experience; }
    }

    const exp0 = experience[0] || {};
    
    // Auto-compose address if presentAddress was not explicitly built
    const composedAddress = data.presentAddress || [
      data.flatHouseFloor,
      data.societyName,
      data.landmark,
      data.area,
      data.district,
      data.state,
      data.pincode ? `PIN - ${data.pincode}` : ''
    ].filter(Boolean).join(', ');

    const applicationData = {
      jobId,
      name: data.name,
      fatherName: data.fatherName,
      motherName: data.motherName,
      maritalStatus: data.maritalStatus,
      spouseName: data.spouseName,
      email: data.email,
      phone: data.phone,
      alternatePhone: data.alternatePhone,
      aadhaar: data.aadhaar,
      pan: data.pan,
      dob: data.dob,
      gender: data.gender,
      religion: data.religion,
      nationality: data.nationality || 'Indian',
      pincode: data.pincode,
      state: data.state,
      district: data.district,
      area: data.area,
      flatHouseFloor: data.flatHouseFloor,
      societyName: data.societyName,
      landmark: data.landmark,
      presentAddress: composedAddress || data.presentAddress || '',
      permanentAddress: data.permanentAddress || composedAddress || '',
      education,
      experience,
      expectedMonthlySalary: data.expectedMonthlySalary || data.expectedSalary || '',
      joinedComfortableDate: data.joinedComfortableDate || '',
      yearlyGrossSalary: data.yearlyGrossSalary || (exp0.grossPay ? String(Number(exp0.grossPay) * 12) : ''),
      monthlyNetSalary: data.monthlyNetSalary || exp0.netPay || '',
      expectedSalary: data.expectedSalary || data.expectedMonthlySalary || '',
      noticePeriod: data.noticePeriod || exp0.noticePeriod || (data.candidateType === 'Fresher' ? (data.joinedComfortableDate ? `Immediate (From ${data.joinedComfortableDate})` : 'Immediate') : 'Immediate'),
      reasonOfLeaving: data.reasonOfLeaving || exp0.reasonOfLeaving || '',
      candidateType: data.candidateType || 'Fresher',
      status: 'Applied'
    };

    // Handle uploaded files with category subdirectories
    if (req.files && Array.isArray(req.files)) {
      const getFileRelativeUrl = (file) => {
        if (!file) return undefined;
        const sub = file.categorySubdir ? `${file.categorySubdir}/` : '';
        return `uploads/${sub}${file.filename}`;
      };

      const profilePhoto = req.files.find(f => f.fieldname === 'profilePhoto');
      const resume = req.files.find(f => f.fieldname === 'resume');
      const coverLetter = req.files.find(f => f.fieldname === 'coverLetter');
      const salarySlip = req.files.find(f => f.fieldname === 'salarySlip');
      const experienceLetter = req.files.find(f => f.fieldname === 'experienceLetter');
      const relievingLetter = req.files.find(f => f.fieldname === 'relievingLetter');
      
      if (profilePhoto) applicationData.profilePhotoUrl = getFileRelativeUrl(profilePhoto);
      if (resume) applicationData.resumeUrl = getFileRelativeUrl(resume);
      if (coverLetter) applicationData.coverLetterUrl = getFileRelativeUrl(coverLetter);
      if (salarySlip) applicationData.salarySlipUrl = getFileRelativeUrl(salarySlip);
      if (experienceLetter) applicationData.experienceLetterUrl = getFileRelativeUrl(experienceLetter);
      if (relievingLetter) applicationData.relievingLetterUrl = getFileRelativeUrl(relievingLetter);
    }

    const { getZoneFromState } = require('../utils/zoneHelper');
    // Ensure application routes to the Zone for which the Job was posted (not candidate's home state)
    const targetJobZone = (job.zone && job.zone !== 'ALL') ? job.zone.toUpperCase() : getZoneFromState(data.state || job.location || '');
    const detectedZone = targetJobZone || 'NORTH';
    const appCounter = Date.now().toString().slice(-6);
    const uniqueAppNo = `APP-${detectedZone.slice(0, 2)}-${appCounter}`;

    const Admin = require('../models/Admin');
    const Employee = require('../models/Employee');

    // Run lookups in parallel for instant execution
    const [hrHeadFound, hrExecutive] = await Promise.all([
      Employee.findOne({
        $or: [
          { role: { $regex: /hr\s*head/i } },
          { designation: { $regex: /hr\s*head/i } },
          { isDepartmentHead: true, department: { $regex: /hr/i } }
        ]
      }).select('_id name').lean().then(async (head) => {
        if (head) return head;
        return Admin.findOne({
          $or: [
            { role: { $regex: /hr\s*head/i } },
            { subRole: { $regex: /hr\s*head/i } }
          ]
        }).select('_id name').lean();
      }),
      Employee.findOne({
        zone: detectedZone,
        status: 'Active',
        $or: [
          { role: { $regex: /hr\s*executive/i } },
          { designation: { $regex: /hr\s*executive/i } },
          { role: { $regex: /recruitment/i } }
        ]
      }).select('_id name reportsToManagerId').lean()
    ]);

    let hrManager = null;
    if (hrExecutive && hrExecutive.reportsToManagerId) {
      hrManager = await Employee.findById(hrExecutive.reportsToManagerId).select('_id name').lean();
    }
    if (!hrManager) {
      hrManager = await Employee.findOne({
        status: 'Active',
        $or: [
          { role: { $regex: /hr\s*manager/i } },
          { designation: { $regex: /hr\s*manager/i } }
        ]
      }).select('_id name').lean();
    }

    applicationData.applicationNo = uniqueAppNo;
    applicationData.zone = detectedZone;
    applicationData.assignedHeadId = hrHeadFound ? hrHeadFound._id : null;
    applicationData.assignedHeadName = hrHeadFound ? hrHeadFound.name : 'HR Head';
    applicationData.assignedManagerId = hrManager ? hrManager._id : null;
    applicationData.assignedManagerName = hrManager ? hrManager.name : null;
    applicationData.assignedExecutiveId = hrExecutive ? hrExecutive._id : null;
    applicationData.assignedTo = hrExecutive ? hrExecutive.name : 'Unassigned';
    applicationData.assignedToId = hrExecutive ? hrExecutive._id : null;
    applicationData.assignedAt = hrExecutive ? new Date() : null;

    const application = new JobApplication(applicationData);
    await application.save();

    // Respond immediately to client so apply is instantaneous
    res.status(201).json({
      message: 'Application submitted successfully',
      applicationId: application._id,
      applicationNo: uniqueAppNo,
      zone: detectedZone,
      assignedTo: application.assignedTo
    });

    // Send email to applicant in background (fire-and-forget)
    if (application.email) {
      setImmediate(() => {
        sendEmail({
          to: application.email,
          subject: `Application Received - ${job.title} (${uniqueAppNo})`,
          html: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
              <h2 style="color: #0EA5E9;">Application Received!</h2>
              <p>Dear <strong>${application.name}</strong>,</p>
              <p>Thank you for applying for the <strong>${job.title}</strong> position at HAUS NUO-Pay.</p>
              <p>Your Application Number is: <strong>${uniqueAppNo}</strong> (Zone: <strong>${detectedZone}</strong>).</p>
              <p>Our HR Executive team in <strong>${detectedZone} Zone</strong> ${hrExecutive ? `(Assigned: ${hrExecutive.name})` : ''} will review your profile and contact you shortly.</p>
              <br/>
              <p>Best Regards,</p>
              <p><strong>HAUS NUO-Pay HR Department (${detectedZone} Zone)</strong></p>
            </div>
          `
        }).catch(err => console.error('Error sending application email:', err));
      });
    }

    // Send notification to HR Executive/Head in background (fire-and-forget)
    const targetNotifyUser = hrExecutive || hrHeadFound;
    setImmediate(() => {
      createNotification(
        `New Job Application [${uniqueAppNo}] for ${job.title} from ${application.name} (${detectedZone} Zone)${hrExecutive ? ` assigned to ${hrExecutive.name}` : ''}`,
        'system',
        targetNotifyUser ? targetNotifyUser._id : null
      ).catch(err => console.error('Error creating application notification:', err));
    });

    return;
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};

const Employee = require('../models/Employee');

// @desc    Get all applications (Filtered by Zone & Role Hierarchy)
// @route   GET /api/recruitment/applications
// @access  Private (Admin/HR)
const getApplications = async (req, res) => {
  try {
    const { jobId, status, zone, unassigned, assignedToId } = req.query;
    let query = {};
    if (jobId) query.jobId = jobId;
    if (status && status !== 'all') query.status = status;
    if (zone && zone !== 'ALL') query.zone = zone;

    const roleLower = (req.admin?.role || '').toLowerCase();
    const designationLower = (req.admin?.designation || '').toLowerCase();
    const cleanRole = roleLower.replace(/[^a-z0-9]/g, '');
    const cleanDesig = designationLower.replace(/[^a-z0-9]/g, '');
    const adminZone = req.admin?.zone || 'ALL';

    const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'administrator'].includes(roleLower) || 
                          ['superadmin', 'admin', 'administrator'].includes(cleanRole);
    const isHRHead = ['hr admin', 'hr head', 'hr_head', 'hrhead', 'hr'].includes(roleLower) || 
                     ['hrhead', 'hradmin', 'hr'].includes(cleanRole) || 
                     designationLower.includes('hr head') || cleanDesig.includes('hrhead') ||
                     (req.admin?.isDepartmentHead && (req.admin?.department || '').toLowerCase().includes('hr'));
    const isHRManager = ['hr manager', 'hr_manager', 'hrmanager'].includes(roleLower) || 
                       ['hrmanager'].includes(cleanRole) || 
                       designationLower.includes('hr manager') || cleanDesig.includes('hrmanager');

    if (isMasterAdmin || isHRHead) {
      // SuperAdmin & Global HR Head track all applications across all zones
      if (unassigned === 'true') {
        query.assignedToId = null;
      } else if (assignedToId) {
        query.$or = [{ assignedToId }, { assignedExecutiveId: assignedToId }];
      }
    } else if (isHRManager) {
      // HR Manager tracks applications assigned to their team of HR Executives or their own ID
      const teamExecutives = await Employee.find({ reportsToManagerId: req.admin._id }).select('_id');
      const teamExecutiveIds = teamExecutives.map(e => e._id);
      query.$or = [
        { assignedManagerId: req.admin._id },
        { assignedToId: { $in: [req.admin._id, ...teamExecutiveIds] } },
        { assignedExecutiveId: { $in: teamExecutiveIds } }
      ];
      if (assignedToId) {
        query.assignedToId = assignedToId;
      }
    } else {
      // HR Executive sees all job applicants belonging to their zone
      if (adminZone && adminZone !== 'ALL') {
        query.zone = adminZone;
      }
    }

    const applications = await JobApplication.find(query)
      .populate('jobId', 'title department designation location zone')
      .populate('employeeId', 'grossMonthly payroll empId designation role onboardingStatus bankAccType bankAccName bankName bankBranch bankAccNum bankIfsc ref1Rel ref1Name ref1Mobile ref1Address ref2Rel ref2Name ref2Mobile ref2Address drivingLicence vehicleNumber landmark documents avatar')
      .populate('assignedHeadId', 'name email zone')
      .populate('assignedManagerId', 'name email phone')
      .populate('assignedExecutiveId', 'name email phone zone')
      .populate('assignedToId', 'name email phone zone')
      .sort({ createdAt: -1 });
      
    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get assignable staff for recruitment applications based on logged-in role
// @route   GET /api/recruitment/assignable-staff
// @access  Private (Admin/HR)
const getRecruitmentAssignableStaff = async (req, res) => {
  try {
    const roleLower = (req.admin?.role || '').toLowerCase();
    const designationLower = (req.admin?.designation || '').toLowerCase();
    const isMasterAdmin = ['super admin', 'superadmin', 'admin', 'administrator'].includes(roleLower);
    const isHRHead = ['hr head', 'hr_head', 'hr admin', 'hradmin', 'hr'].includes(roleLower) || 
                     designationLower.includes('hr head') ||
                     (req.admin?.isDepartmentHead && (req.admin?.department || '').toLowerCase().includes('hr'));
    const isHRManager = ['hr manager', 'hr_manager', 'hrmanager'].includes(roleLower) || 
                        designationLower.includes('hr manager');

    let assignableList = [];

    if (isMasterAdmin || isHRHead) {
      // HR Head assigns ONLY to HR Managers (Strictly No executives or other employees)
      assignableList = await Employee.find({
        status: 'Active',
        $or: [
          { role: { $regex: /hr\s*manager/i } },
          { designation: { $regex: /hr\s*manager/i } },
          { zonalRole: 'HR Manager' },
          { department: { $regex: /hr/i }, role: { $regex: /manager/i } },
          { department: { $regex: /hr/i }, designation: { $regex: /manager/i } }
        ]
      }).select('name email mobile phone role designation zone department').lean();
    } else if (isHRManager) {
      // HR Manager assigns to their team of HR Executives (or executives in their zone/reporting)
      const adminZone = req.admin?.zone || 'ALL';
      let execQuery = {
        status: 'Active',
        $or: [
          { reportsToManagerId: req.admin._id },
          { role: { $regex: /hr\s*executive|recruitment/i } },
          { designation: { $regex: /hr\s*executive|recruiter/i } },
          { zonalRole: 'HR Executive' }
        ]
      };
      if (adminZone !== 'ALL') {
        execQuery.zone = adminZone;
      }

      assignableList = await Employee.find(execQuery)
        .select('name email mobile phone role designation zone department reportsToManagerId')
        .lean();
    } else {
      // General fallback
      assignableList = await Employee.find({
        status: 'Active',
        $or: [
          { department: { $regex: /hr/i } },
          { role: { $regex: /hr|executive|telecaller/i } }
        ]
      }).select('name email mobile phone role designation zone department').lean();
    }

    res.status(200).json(assignableList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign single application (HR Head assigns to HR Manager, HR Manager assigns to HR Executive)
// @route   PUT /api/recruitment/applications/:id/assign
// @access  Private (HR Head / HR Manager only; Superadmin/Admin cannot assign)
const assignApplication = async (req, res) => {
  try {
    const roleLower = (req.admin?.role || '').toLowerCase();
    const designationLower = (req.admin?.designation || '').toLowerCase();
    const isMasterAdmin = ['super admin', 'superadmin', 'admin'].includes(roleLower);
    const isHRHead = ['hr head', 'hr_head', 'hr admin', 'hr'].includes(roleLower) || 
                     designationLower.includes('hr head') ||
                     (req.admin?.isDepartmentHead && (req.admin?.department || '').toLowerCase().includes('hr'));
    const isHRManager = ['hr manager', 'hr_manager', 'hrmanager'].includes(roleLower) || 
                        designationLower.includes('hr manager');
    const isHRLead = isHRHead || isHRManager;

    if (isMasterAdmin && !isHRLead) {
      return res.status(403).json({ 
        message: 'SuperAdmin / Admin is not permitted to assign job applications. Applications are auto-routed or assigned by the HR Head / HR Manager.' 
      });
    }

    const { assignedToId } = req.body;
    const application = await JobApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: 'Application not found' });

    let emp = null;
    if (assignedToId) {
      emp = await Employee.findById(assignedToId);
    }

    const previousAssignee = application.assignedTo || 'Unassigned';
    const assignedBy = req.admin ? `${req.admin.name} (${req.admin.role || req.admin.designation || 'HR Lead'})` : 'HR Lead';
    const assignedAt = new Date();

    if (emp) {
      const targetRole = (emp.role || '').toLowerCase();
      const targetDesig = (emp.designation || '').toLowerCase();
      const isTargetManager = targetRole.includes('manager') || targetDesig.includes('manager') || emp.zonalRole === 'HR Manager';

      if (isHRHead) {
        if (!isTargetManager) {
          return res.status(400).json({ message: 'HR Head can only assign applications to an HR Manager.' });
        }
        // HR Head assigned to HR Manager
        application.assignedManagerId = emp._id;
        application.assignedManagerName = emp.name;
        application.assignedTo = `Manager: ${emp.name}`;
        application.assignedToId = emp._id;
        application.assignedExecutiveId = null;
      } else {
        // HR Manager delegates to an Executive
        application.assignedExecutiveId = emp._id;
        application.assignedTo = emp.name;
        application.assignedToId = emp._id;
        if (!application.assignedManagerId) {
          if (isHRManager) {
            application.assignedManagerId = req.admin._id;
            application.assignedManagerName = req.admin.name;
          } else if (emp.reportsToManagerId) {
            application.assignedManagerId = emp.reportsToManagerId;
            application.assignedManagerName = emp.reportsToManagerName || null;
          }
        }
      }
    } else {
      application.assignedTo = null;
      application.assignedToId = null;
      application.assignedExecutiveId = null;
    }

    application.assignedBy = assignedBy;
    application.assignedAt = assignedAt;

    if (!application.assignmentHistory) application.assignmentHistory = [];
    application.assignmentHistory.push({
      assignedTo: emp ? emp.name : 'Unassigned',
      assignedToId: emp ? emp._id.toString() : null,
      assignedBy,
      assignedAt,
      previousAssignee
    });

    await application.save();
    res.status(200).json({ message: 'Application assigned successfully', application });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk assign applications
// @route   PUT /api/recruitment/applications/bulk-assign
// @access  Private (HR Head / HR Manager only; Superadmin/Admin cannot assign)
const bulkAssignApplications = async (req, res) => {
  try {
    const roleLower = (req.admin?.role || '').toLowerCase();
    const designationLower = (req.admin?.designation || '').toLowerCase();
    const isMasterAdmin = ['super admin', 'superadmin', 'admin'].includes(roleLower);
    const isHRHead = ['hr head', 'hr_head', 'hr admin', 'hr'].includes(roleLower) || 
                     designationLower.includes('hr head') ||
                     (req.admin?.isDepartmentHead && (req.admin?.department || '').toLowerCase().includes('hr'));
    const isHRManager = ['hr manager', 'hr_manager', 'hrmanager'].includes(roleLower) || 
                        designationLower.includes('hr manager');
    const isHRLead = isHRHead || isHRManager;

    if (isMasterAdmin && !isHRLead) {
      return res.status(403).json({ 
        message: 'SuperAdmin / Admin is not permitted to assign job applications. Applications are auto-routed or assigned by the HR Head / HR Manager.' 
      });
    }

    const { applicationIds, assignedToId } = req.body;
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ message: 'No applications provided' });
    }

    let emp = null;
    if (assignedToId) {
      emp = await Employee.findById(assignedToId);
    }

    const assignedBy = req.admin ? `${req.admin.name} (${req.admin.role || req.admin.designation || 'HR Lead'})` : 'HR Lead';
    const assignedAt = new Date();

    const isTargetManager = emp && ((emp.role || '').toLowerCase().includes('manager') || 
                                   (emp.designation || '').toLowerCase().includes('manager') || 
                                   emp.zonalRole === 'HR Manager');

    if (emp && isHRHead && !isTargetManager) {
      return res.status(400).json({ message: 'HR Head can only assign applications to an HR Manager.' });
    }

    const apps = await JobApplication.find({ _id: { $in: applicationIds } });
    for (const app of apps) {
      const previousAssignee = app.assignedTo || 'Unassigned';
      
      if (emp) {
        if (isHRHead && isTargetManager) {
          app.assignedManagerId = emp._id;
          app.assignedManagerName = emp.name;
          app.assignedTo = `Manager: ${emp.name}`;
          app.assignedToId = emp._id;
        } else {
          app.assignedExecutiveId = emp._id;
          app.assignedTo = emp.name;
          app.assignedToId = emp._id;
          if (emp.reportsToManagerId && !app.assignedManagerId) {
            app.assignedManagerId = emp.reportsToManagerId;
            app.assignedManagerName = emp.reportsToManagerName || null;
          }
        }
      } else {
        app.assignedTo = null;
        app.assignedToId = null;
        app.assignedExecutiveId = null;
      }

      app.assignedBy = assignedBy;
      app.assignedAt = assignedAt;

      if (!app.assignmentHistory) app.assignmentHistory = [];
      app.assignmentHistory.push({
        assignedTo: emp ? emp.name : 'Unassigned',
        assignedToId: emp ? emp._id.toString() : null,
        assignedBy,
        assignedAt,
        previousAssignee
      });

      await app.save();
    }

    res.status(200).json({ message: `${apps.length} applications assigned successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update application status (includes Hired -> Auto Employee Onboarding creation)
// @route   PUT /api/recruitment/applications/:id/status
// @access  Private (Admin/HR)
const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const application = await JobApplication.findById(req.params.id).populate('jobId');
    
    if (!application) return res.status(404).json({ message: 'Application not found' });
    
    application.status = status;

    // If status is changed to Hired, initiate onboarding and create Employee profile if not exists
    let createdEmployee = null;
    if (status === 'Hired') {
      application.onboardingStatus = 'Pending';

      // Check if Employee record already exists for this email
      let existingEmp = await Employee.findOne({ email: application.email });
      if (!existingEmp) {
        const year = new Date().getFullYear();
        const randId = Math.floor(1000 + Math.random() * 9000);
        const empId = `EMP-${year}-${randId}`;

        const resolvedZone = application.zone || application.jobId?.zone || req.admin?.zone || 'NORTH';
        const assignedHRId = application.assignedExecutiveId || req.admin?._id || null;
        const assignedHRName = application.assignedTo || req.admin?.name || 'HR Executive';

        const newEmp = new Employee({
          empId,
          name: application.name,
          email: application.email,
          mobile: application.phone,
          zone: resolvedZone,
          assignedHRId: assignedHRId ? String(assignedHRId) : null,
          assignedHRName: assignedHRName,
          assignedHRAt: new Date(),
          assignedTelecallerId: assignedHRId ? String(assignedHRId) : null,
          assignedTelecallerName: assignedHRName,
          fathersName: application.fatherName || '',
          mothersName: application.motherName || '',
          maritalStatus: application.maritalStatus || 'Single',
          presentAddress: application.presentAddress || '',
          permanentAddress: application.permanentAddress || application.presentAddress || '',
          pincode: application.pincode || '',
          district: application.district || '',
          state: application.state || '',
          city: application.area || '',
          aadhar: application.aadhaar || '',
          pan: application.pan || '',
          designation: application.jobId?.title || 'Team Member',
          role: 'Employee',
          division: application.jobId?.department || 'Operations',
          grossMonthly: application.monthlyNetSalary ? Number(application.monthlyNetSalary) : (application.expectedSalary ? Number(application.expectedSalary) : undefined),
          qual1Type: application.education?.[0]?.degree || 'Graduation',
          qual1Inst: application.education?.[0]?.institution || '',
          qual1Dist: application.education?.[0]?.districtState || application.education?.[0]?.location || '',
          qual1Year: application.education?.[0]?.endDate || '',
          expCompany: application.experience?.[0]?.company || '',
          expPosition: application.experience?.[0]?.title || '',
          expStart: application.experience?.[0]?.startDate || '',
          expEnd: application.experience?.[0]?.endDate || '',
          expGross: application.yearlyGrossSalary || '',
          expMonthly: application.monthlyNetSalary || '',
          expReason: application.reasonOfLeaving || '',
          bankAccName: application.name || '',
          documents: [
            ...(application.profilePhotoUrl ? [{ name: 'Passport Photo', key: 'photo', fileUrl: application.profilePhotoUrl, status: 'Pending' }] : []),
            ...(application.resumeUrl ? [{ name: 'Resume', key: 'degree', fileUrl: application.resumeUrl, status: 'Pending' }] : []),
            ...(application.salarySlipUrl ? [{ name: 'Salary Slip', key: 'experienceLetter', fileUrl: application.salarySlipUrl, status: 'Pending' }] : [])
          ],
          status: 'Active',
          onboardingStatus: 'Pending'
        });

        createdEmployee = await newEmp.save();
        application.employeeId = createdEmployee._id;
      } else {
        // Auto-merge any missing candidate fields into existing employee
        existingEmp.name = existingEmp.name || application.name;
        existingEmp.mobile = existingEmp.mobile || application.phone;
        existingEmp.fathersName = existingEmp.fathersName || application.fatherName;
        existingEmp.mothersName = existingEmp.mothersName || application.motherName;
        existingEmp.maritalStatus = existingEmp.maritalStatus || application.maritalStatus;
        existingEmp.presentAddress = existingEmp.presentAddress || application.presentAddress;
        existingEmp.permanentAddress = existingEmp.permanentAddress || application.permanentAddress || application.presentAddress;
        existingEmp.pincode = existingEmp.pincode || application.pincode;
        existingEmp.district = existingEmp.district || application.district;
        existingEmp.state = existingEmp.state || application.state;
        existingEmp.city = existingEmp.city || application.area;
        existingEmp.aadhar = existingEmp.aadhar || application.aadhaar;
        existingEmp.pan = existingEmp.pan || application.pan;
        existingEmp.designation = existingEmp.designation || application.jobId?.title;
        existingEmp.division = existingEmp.division || application.jobId?.department;
        if (!existingEmp.grossMonthly && application.monthlyNetSalary) {
          existingEmp.grossMonthly = Number(application.monthlyNetSalary);
        }
        if (!existingEmp.qual1Inst && application.education?.[0]) {
          existingEmp.qual1Type = application.education[0].degree || 'Graduation';
          existingEmp.qual1Inst = application.education[0].institution || '';
          existingEmp.qual1Dist = application.education[0].districtState || application.education[0].location || '';
          existingEmp.qual1Year = application.education[0].endDate || '';
        }
        if (!existingEmp.expCompany && application.experience?.[0]) {
          existingEmp.expCompany = application.experience[0].company || '';
          existingEmp.expPosition = application.experience[0].title || '';
          existingEmp.expStart = application.experience[0].startDate || '';
          existingEmp.expEnd = application.experience[0].endDate || '';
          existingEmp.expGross = application.yearlyGrossSalary || '';
          existingEmp.expMonthly = application.monthlyNetSalary || '';
          existingEmp.expReason = application.reasonOfLeaving || '';
        }
        const resolvedZone = application.zone || application.jobId?.zone || req.admin?.zone || 'NORTH';
        const assignedHRId = application.assignedExecutiveId || req.admin?._id || null;
        const assignedHRName = application.assignedTo || req.admin?.name || 'HR Executive';

        if (!existingEmp.zone || existingEmp.zone === 'ALL') existingEmp.zone = resolvedZone;
        if (!existingEmp.assignedHRId) {
          existingEmp.assignedHRId = assignedHRId ? String(assignedHRId) : null;
          existingEmp.assignedHRName = assignedHRName;
          existingEmp.assignedHRAt = new Date();
          existingEmp.assignedTelecallerId = assignedHRId ? String(assignedHRId) : null;
          existingEmp.assignedTelecallerName = assignedHRName;
        }

        existingEmp.bankAccName = existingEmp.bankAccName || application.name;
        await existingEmp.save();

        application.employeeId = existingEmp._id;
        createdEmployee = existingEmp;
      }
    }

    await application.save();
    
    // Send email to applicant about status update in background (fire-and-forget)
    if (application.email && application.jobId) {
      const emailContent = status === 'Hired' && createdEmployee
        ? `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
            <h2 style="color: #10B981;">Congratulations! You are Hired!</h2>
            <p>Dear <strong>${application.name}</strong>,</p>
            <p>We are delighted to inform you that you have been selected for the <strong>${application.jobId.title}</strong> position at HAUS NUO-Pay!</p>
            <p>Please complete your employee onboarding details and document uploads using the link below:</p>
            <p style="margin: 24px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/onboarding/${createdEmployee._id}" style="background-color: #0EA5E9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                Complete Your Onboarding
              </a>
            </p>
            <br/>
            <p>Best Regards,</p>
            <p><strong>HAUS NUO-Pay HR Team</strong></p>
          </div>
        `
        : `
          <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
            <h2 style="color: #0EA5E9;">Application Update</h2>
            <p>Dear <strong>${application.name}</strong>,</p>
            <p>This is an update regarding your application for the <strong>${application.jobId.title}</strong> position.</p>
            <p>Your application status has been updated to: <strong style="color: #0EA5E9; font-size: 16px;">${status}</strong></p>
            <p>If you have any questions or require further information, feel free to reach out to us.</p>
            <br/>
            <p>Best Regards,</p>
            <p><strong>HAUS NUO-Pay HR Team</strong></p>
          </div>
        `;

      setImmediate(() => {
        sendEmail({
          to: application.email,
          subject: status === 'Hired' ? `Offer & Onboarding - ${application.jobId.title}` : `Application Update - ${application.jobId.title}`,
          html: emailContent
        }).catch(err => console.error('Error sending status email:', err));
      });
    }

    res.status(200).json({ 
      message: 'Status updated', 
      application,
      employeeId: createdEmployee ? createdEmployee._id : application.employeeId
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update application details
// @route   PUT /api/recruitment/applications/:id
// @access  Private (Admin/HR)
const updateApplication = async (req, res) => {
  try {
    const data = req.body;
    const application = await JobApplication.findById(req.params.id);
    
    if (!application) return res.status(404).json({ message: 'Application not found' });
    
    // Parse JSON arrays for education and experience if they are sent as strings
    let education = application.education;
    let experience = application.experience;
    if (data.education) {
      try { education = JSON.parse(data.education); } catch(e) { education = data.education; }
    }
    if (data.experience) {
      try { experience = JSON.parse(data.experience); } catch(e) { experience = data.experience; }
    }

    application.name = data.name || application.name;
    application.fatherName = data.fatherName || application.fatherName;
    application.motherName = data.motherName || application.motherName;
    application.maritalStatus = data.maritalStatus || application.maritalStatus;
    application.spouseName = data.spouseName || application.spouseName;
    application.email = data.email || application.email;
    application.phone = data.phone || application.phone;
    application.alternatePhone = data.alternatePhone || application.alternatePhone;
    application.aadhaar = data.aadhaar || application.aadhaar;
    application.pan = data.pan || application.pan;
    application.dob = data.dob || application.dob;
    application.gender = data.gender || application.gender;
    application.religion = data.religion || application.religion;
    application.nationality = data.nationality || application.nationality;
    application.pincode = data.pincode || application.pincode;
    application.state = data.state || application.state;
    application.district = data.district || application.district;
    application.area = data.area || application.area;
    application.flatHouseFloor = data.flatHouseFloor || application.flatHouseFloor;
    application.societyName = data.societyName || application.societyName;
    application.landmark = data.landmark || application.landmark;
    application.presentAddress = data.presentAddress || application.presentAddress;
    application.permanentAddress = data.permanentAddress || application.permanentAddress;
    application.expectedMonthlySalary = data.expectedMonthlySalary || application.expectedMonthlySalary;
    application.joinedComfortableDate = data.joinedComfortableDate || application.joinedComfortableDate;
    application.yearlyGrossSalary = data.yearlyGrossSalary || application.yearlyGrossSalary;
    application.monthlyNetSalary = data.monthlyNetSalary || application.monthlyNetSalary;
    application.expectedSalary = data.expectedSalary || application.expectedSalary;
    application.noticePeriod = data.noticePeriod || application.noticePeriod;
    application.reasonOfLeaving = data.reasonOfLeaving || application.reasonOfLeaving;
    application.education = education;
    application.experience = experience;

    // Handle uploaded files if HR updates them
    if (req.files) {
      const profilePhoto = req.files.find(f => f.fieldname === 'profilePhoto');
      const resume = req.files.find(f => f.fieldname === 'resume');
      const coverLetter = req.files.find(f => f.fieldname === 'coverLetter');
      
      if (profilePhoto) application.profilePhotoUrl = `uploads/${profilePhoto.filename}`;
      if (resume) application.resumeUrl = `uploads/${resume.filename}`;
      if (coverLetter) application.coverLetterUrl = `uploads/${coverLetter.filename}`;
    }
    
    await application.save();
    res.status(200).json({ message: 'Application updated successfully', application });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  applyForJob,
  getApplications,
  getRecruitmentAssignableStaff,
  assignApplication,
  bulkAssignApplications,
  updateApplicationStatus,
  updateApplication,
  getJobFilterOptions
};