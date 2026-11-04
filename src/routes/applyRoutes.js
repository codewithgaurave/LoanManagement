const express = require('express');
const upload = require('../middlewares/uploadMiddleware');
const router = express.Router();
const Lead = require('../models/Lead');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');

// Handle Public Customer Form Submission (Online Link Upload)
// Dedicated file upload endpoint for customer apply portal
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const relativePath = 'uploads/' + (req.file.categorySubdir ? req.file.categorySubdir + '/' : '') + req.file.filename;
    return res.status(200).json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileUrl: relativePath
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/submit/:leadId', async (req, res) => {
  try {
    const rawLeadId = req.params.leadId;
    const { 
      panNumber, 
      aadhaarNumber, 
      address, 
      city, 
      state, 
      pincode, 
      documents = [], 
      customerRemarks 
    } = req.body;

    let lead = await Lead.findOne({
      $or: [
        { leadId: { $regex: new RegExp(`^${rawLeadId.trim()}$`, 'i') } },
        { lanId: { $regex: new RegExp(`^${rawLeadId.trim()}$`, 'i') } },
        ...(rawLeadId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: rawLeadId }] : [])
      ]
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Application reference not found' });
    }

    if (panNumber) lead.panNumber = panNumber;
    if (aadhaarNumber) lead.aadhaarApc = aadhaarNumber;
    if (address) lead.address = address;
    if (city) lead.city = city;
    if (state) lead.state = state;
    if (pincode) lead.pincode = pincode;

    // Append customer uploaded documents
    if (Array.isArray(documents) && documents.length > 0) {
      if (!lead.documents) lead.documents = [];
      documents.forEach(doc => {
        lead.documents.push({
          type: doc.type || 'Customer Document',
          fileName: doc.fileName || `${doc.type || 'Document'}.jpg`,
          fileUrl: doc.fileUrl || '',
          fileUrlBack: doc.fileUrlBack || '',
          fileNameBack: doc.fileNameBack || '',
          hasBothSides: Boolean(doc.fileUrlBack),
          remark: doc.remark || customerRemarks || 'Uploaded by customer via portal link',
          status: 'Pending',
          uploadedBy: 'Customer',
          uploadedAt: new Date()
        });
      });
    }

    const hasDocs = Array.isArray(documents) && documents.length > 0;

    lead.customerFormStatus = 'Completed';
    lead.customerFilledAt = new Date();

    if (hasDocs) {
      // Customer provided full form WITH documents -> moves to Lender Selection
      lead.workflowStage = 'Customer_Confirmed';
      lead.inProcessStage = 'Lender Selection';
      lead.submissionType = 'SUBMITTED';
      lead.isDraft = false;
      lead.status = 'Documents Pending';
    } else {
      // Customer submitted form WITHOUT documents -> goes to IN-DRAFT under "Doc's Pending"
      lead.workflowStage = 'Field_Lead_Created';
      lead.draftStatus = "Doc's Pending";
      lead.inProcessStage = "Doc's Pending";
      lead.isDraft = true;
      lead.submissionType = 'LINK_GENERATED';
      lead.status = 'Draft';
    }

    const savedLead = await lead.save();

    // Notify Telecaller & RM and Customer
    try {
      const { notifyEmployeeOrZone, notifyCustomer } = require('../services/firebaseService');
      await notifyEmployeeOrZone({
        recipientId: lead.telecallerId || lead.rmId || null,
        empId: lead.assignedToId || lead.createdById || null,
        zone: lead.zone,
        title: `Customer Docs Uploaded [${lead.zone}]: ${lead.name}`,
        body: `Customer ${lead.name} has submitted documents for lead ${lead.leadId || ''}. File ready for verification.`,
        data: {
          type: 'document',
          leadId: lead.leadId || lead._id.toString(),
          customerName: lead.name
        }
      });

      await notifyCustomer({
        phone: lead.mobile,
        email: lead.email,
        title: `Documents Received: ${lead.name}`,
        body: `Your application documents for lead ${lead.leadId || ''} have been received and are under verification.`,
        data: {
          type: 'document',
          leadId: lead.leadId || lead._id.toString()
        }
      });
    } catch (notifErr) {
      console.error('Notification error on customer submit:', notifErr);
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Application & documents submitted successfully! Your dedicated loan advisor will contact you shortly.',
      lead: savedLead 
    });
  } catch (error) {
    console.error('Error submitting customer form:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Public API for fetching assigned Employee, RM, and ARM for a lead
router.get('/lead-officers/:leadId', async (req, res) => {
  try {
    const rawLeadId = req.params.leadId || '';
    let lead = await Lead.findOne({
      $or: [
        { leadId: { $regex: new RegExp(`^${rawLeadId.trim()}$`, 'i') } },
        { lanId: { $regex: new RegExp(`^${rawLeadId.trim()}$`, 'i') } },
        ...(rawLeadId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: rawLeadId }] : [])
      ]
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    let sourcingEmp = null;
    if (lead.createdByEmpId || lead.createdById) {
      const empId = lead.createdByEmpId || lead.createdById;
      sourcingEmp = await Employee.findOne({
        $or: [
          ...(empId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: empId }] : []),
          { empId: empId }
        ]
      });
    }

    const employeeName = lead.createdByName || sourcingEmp?.name || 'ro wallah';
    const employeeRole = lead.createdByDesignation || lead.createdByRole || sourcingEmp?.designation || sourcingEmp?.zonalRole || 'Relationship Officer (RO)';
    const employeeEmpId = lead.createdByEmpId || sourcingEmp?.empId || '';
    const employeePhone = sourcingEmp?.mobile || sourcingEmp?.phone || '';

    let rmName = lead.rmName || sourcingEmp?.rmName || '';
    let rmRole = 'Reporting Manager (RM)';
    let armName = lead.armName || sourcingEmp?.armName || '';
    let armRole = 'Assistant Regional Manager (ARM)';

    let rmEmp = null;
    if (sourcingEmp?.rmId) {
      rmEmp = await Employee.findById(sourcingEmp.rmId);
    }
    if (!rmEmp && rmName) {
      rmEmp = await Employee.findOne({ name: rmName });
    }
    if (!rmEmp && lead.zone) {
      rmEmp = await Employee.findOne({ zone: lead.zone, zonalRole: 'RM' });
    }
    if (rmEmp) {
      rmName = rmEmp.name;
      rmRole = rmEmp.designation || rmEmp.zonalRole || rmEmp.role || 'Reporting Manager (RM)';
    }

    let armEmp = null;
    if (sourcingEmp?.armId) {
      armEmp = await Employee.findById(sourcingEmp.armId);
    }
    if (!armEmp && armName) {
      armEmp = await Employee.findOne({ name: armName });
    }
    if (!armEmp && lead.zone) {
      armEmp = await Employee.findOne({ zone: lead.zone, zonalRole: 'ARM' });
    }
    if (armEmp) {
      armName = armEmp.name;
      armRole = armEmp.designation || armEmp.zonalRole || armEmp.role || 'Assistant Regional Manager (ARM)';
    }

    if (!rmName) rmName = 'New RM Wallah';
    if (!armName) armName = 'arm wallah';

    return res.status(200).json({
      success: true,
      leadId: lead.leadId || rawLeadId,
      customerName: lead.name,
      employee: {
        name: employeeName,
        role: employeeRole,
        empId: employeeEmpId,
        phone: employeePhone
      },
      rm: {
        name: rmName,
        role: rmRole
      },
      arm: {
        name: armName,
        role: armRole
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

const handleApplyPage = async (req, res) => {
  const rawLeadId = req.params.leadId || req.query.leadId || '';
  let lead = null;

  if (rawLeadId) {
    try {
      lead = await Lead.findOne({
        $or: [
          { leadId: { $regex: new RegExp(`^${rawLeadId.trim()}$`, 'i') } },
          { lanId: { $regex: new RegExp(`^${rawLeadId.trim()}$`, 'i') } },
          ...(rawLeadId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: rawLeadId }] : [])
        ]
      });
    } catch (e) {
      console.error('Error fetching lead in /apply route:', e);
    }
  }

  if (!lead && !rawLeadId) {
    lead = await Lead.findOne().sort({ createdAt: -1 });
  }

  // Resolve Sourcing Officer (RO/RE) and Reporting Manager (RM) details
  let sourcingEmp = null;
  if (lead && (lead.createdByEmpId || lead.createdById)) {
    const empId = lead.createdByEmpId || lead.createdById;
    try {
      sourcingEmp = await Employee.findOne({
        $or: [
          ...(empId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: empId }] : []),
          { empId: empId }
        ]
      });
    } catch (_) {}
  }

  const roName = lead?.createdByName || sourcingEmp?.name || 'Authorized Relationship Officer';
  const roRole = lead?.createdByDesignation || lead?.createdByRole || sourcingEmp?.designation || sourcingEmp?.zonalRole || 'Relationship Officer (RO)';
  const roEmpId = lead?.createdByEmpId || sourcingEmp?.empId || 'NGM-EMP-RO-001';
  const roPhone = sourcingEmp?.phone || sourcingEmp?.mobile || '9942402055';
  const roEmail = sourcingEmp?.email || 'ro@nuogpay.com';
  const roDept = sourcingEmp?.department || 'Financial & Properties';
  const roLocation = sourcingEmp?.city ? `${sourcingEmp.city}, ${sourcingEmp.state || 'IN'}` : (sourcingEmp?.location || 'Bengaluru, KR');
  const roJoining = sourcingEmp?.joiningDate ? new Date(sourcingEmp.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '23 Aug 2025';

  let rmName = lead?.rmName || sourcingEmp?.rmName || '';
  let rmRole = 'Reporting Manager (RM)';
  let rmPhone = '9174342055';
  let rmEmail = 'rm@nuogpay.com';

  try {
    let rmEmp = null;
    if (sourcingEmp?.rmId) {
      rmEmp = await Employee.findById(sourcingEmp.rmId);
    }
    if (!rmEmp && rmName) {
      rmEmp = await Employee.findOne({ name: rmName });
    }
    if (!rmEmp && lead?.zone) {
      rmEmp = await Employee.findOne({ zone: lead.zone, zonalRole: 'RM' });
    }
    if (rmEmp) {
      rmName = rmEmp.name;
      rmRole = rmEmp.designation || rmEmp.zonalRole || rmEmp.role || 'Reporting Manager (RM)';
      if (rmEmp.phone || rmEmp.mobile) rmPhone = rmEmp.phone || rmEmp.mobile;
      if (rmEmp.email) rmEmail = rmEmp.email;
    }
  } catch (_) {}

  if (!rmName) rmName = 'Designated Regional Manager';

  const customerName = lead?.name || 'Customer';
  const entityName = lead?.entityName || '';
  const mobile = lead?.mobile || '';
  const email = lead?.email || '';
  const productCategory = lead?.productCategory || 'Home Loan';
  const productSubtype = lead?.productSubtype || 'Fresh Loan';
  const programType = lead?.programType || 'FRESH';
  const facilityType = lead?.facilityType || 'Term Loan';
  const financialProgram = lead?.financialProgram || 'ABB';
  const constitutionType = lead?.constitutionType || 'Individual';
  const expectedAmount = lead?.expectedAmount ? Number(lead.expectedAmount).toLocaleString('en-IN') : '0';
  const tenure = lead?.tenure ? `${lead.tenure} Years` : 'Not specified';
  const comfortEmi = lead?.comfortEmi ? `₹${Number(lead.comfortEmi).toLocaleString('en-IN')}` : 'Auto-Calculated';
  const displayLeadId = lead?.leadId || rawLeadId || 'NuoGM-LD-2026-Pending';
  const cityState = [lead?.city || lead?.gstDistrict || lead?.district, lead?.state || lead?.gstState].filter(Boolean).join(', ') || 'India';
  const pincode = lead?.pincode || lead?.aadhaarPincode || lead?.gstPincode || '';
  const isCompleted = lead?.customerFormStatus === 'Completed';

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Loan Application #${displayLeadId} | NuoGM Finance</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #0B1120; }
        .glass-card { background: rgba(15, 23, 42, 0.90); backdrop-filter: blur(16px); border: 1px solid rgba(51, 65, 85, 0.7); }
        .gradient-btn { background: linear-gradient(135deg, #059669 0%, #0d9488 100%); }
        .gradient-btn:hover { background: linear-gradient(135deg, #047857 0%, #0f766e 100%); }
      </style>
    </head>
    <body class="min-h-screen text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-x-hidden">
      <!-- Background Glows -->
      <div class="fixed top-1/4 -left-20 w-80 h-80 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div class="fixed bottom-1/4 -right-20 w-80 h-80 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div class="max-w-2xl w-full glass-card rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 my-8">
        
        <!-- Header / Status Badge -->
        <div class="flex items-center justify-between gap-2 border-b border-slate-800 pb-5 mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-lg shadow-inner">
              ₦
            </div>
            <div>
              <h1 class="text-lg font-bold text-white tracking-tight">NuoGM Finance</h1>
              <p class="text-xs text-slate-400">Digital Loan Application & Verification Portal</p>
            </div>
          </div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${isCompleted ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-amber-500/10 border-amber-500/25 text-amber-400'} border text-xs font-bold uppercase tracking-wider">
            <span class="w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse"></span>
            ${isCompleted ? 'Form Submitted' : 'Action Required'}
          </span>
        </div>

        <!-- Lead ID & Welcome Title -->
        <div class="mb-6">
          <div class="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Application Reference No</div>
          <div class="text-xl sm:text-2xl font-black text-white font-mono flex items-center gap-2">
            ${displayLeadId}
            <span class="text-xs font-sans font-medium px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300">
              ${programType}
            </span>
          </div>
          <p class="text-sm text-slate-300 mt-2">
            Welcome <span class="text-emerald-400 font-bold text-base">${customerName}</span>${entityName ? ` (<span class="text-slate-200">${entityName}</span>)` : ''}, your loan request is pre-initiated. Please confirm your details & submit documents below.
          </p>
        </div>

        <!-- SOURCING EMPLOYEE (RO/RE) PROFILE, ID CARD, VISITING CARD & CERTIFICATE + RM SECTION -->
        <div class="mb-6 space-y-4">
          <!-- 1. Top Section: Sourcing Officer (RO/RE) Overview -->
          <div class="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl p-4 shadow-xl">
            <div class="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xl shadow-inner">
                  👤
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Sourcing Officer
                    </span>
                    <span class="text-[10px] font-mono text-slate-400 font-bold">${roEmpId}</span>
                  </div>
                  <h3 class="text-base font-extrabold text-white mt-0.5">${roName}</h3>
                  <p class="text-xs text-emerald-400 font-semibold">${roRole} • ${roDept}</p>
                </div>
              </div>
              <div class="text-right">
                <span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/25">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Verified Officer
                </span>
                <div class="text-[10px] text-slate-400 mt-1">${roLocation}</div>
              </div>
            </div>

            <!-- Direct Officer Contact -->
            <div class="grid grid-cols-2 gap-2 pt-3 text-xs">
              <div class="flex items-center gap-2 text-slate-300">
                <span class="text-slate-400">Official Mobile:</span>
                <span class="font-mono font-bold text-white">+91 ${roPhone}</span>
              </div>
              <div class="flex items-center gap-2 text-slate-300 truncate">
                <span class="text-slate-400">Email:</span>
                <span class="text-white truncate font-medium">${roEmail}</span>
              </div>
            </div>
          </div>

          <!-- 2. Interactive Official Credentials: ID Card, Visiting Card, Certificate -->
          <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div class="flex items-center gap-2">
                <span class="text-emerald-400 text-sm">🪪</span>
                <span class="text-xs font-bold text-white uppercase tracking-wider">Officer's Official Credentials</span>
              </div>
              <div class="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
                <button type="button" onclick="switchCredTab('idcard')" id="tab-btn-idcard" class="px-2.5 py-1 rounded-lg transition-all bg-emerald-500 text-white">ID Card</button>
                <button type="button" onclick="switchCredTab('visiting')" id="tab-btn-visiting" class="px-2.5 py-1 rounded-lg transition-all text-slate-400 hover:text-white">Visiting Card</button>
                <button type="button" onclick="switchCredTab('cert')" id="tab-btn-cert" class="px-2.5 py-1 rounded-lg transition-all text-slate-400 hover:text-white">Certificate</button>
              </div>
            </div>

            <!-- Tab 1: Employee ID Card View (Exact Theme Match) -->
            <div id="cred-tab-idcard" class="space-y-3">
              <div class="bg-white text-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
                <!-- ID Card Header -->
                <div class="bg-[#33373B] text-white p-3 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">NGM</div>
                    <div>
                      <div class="text-[8px] font-extrabold tracking-wide">NUO-G MONEY & HAUS RENT-Z</div>
                      <div class="text-[6.5px] text-[#84CC16] font-bold tracking-wider">HAMARI UMMEED-AAPKA BISWAS</div>
                    </div>
                  </div>
                  <div class="text-xs font-black tracking-wider text-white">NUO-G MONEY</div>
                </div>

                <!-- ID Card Front Body -->
                <div class="p-4 text-center">
                  <div class="w-24 h-28 mx-auto rounded-xl border-4 border-[#22C55E] overflow-hidden bg-slate-100 flex items-center justify-center mb-2 shadow-md">
                    <span class="text-3xl">👤</span>
                  </div>
                  <div class="text-base font-black text-[#16A34A] uppercase tracking-wide">${roName}</div>
                  <div class="text-xs font-bold text-slate-700">${roRole}</div>

                  <!-- ID Strip -->
                  <div class="my-2.5 bg-[#374151] text-white py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-mono font-black">
                    <span class="bg-[#22C55E] text-white text-[9px] px-2 py-0.5 rounded-full uppercase">EMP. ID NO:</span>
                    <span>${roEmpId}</span>
                  </div>

                  <div class="flex justify-between text-[11px] text-slate-600 font-bold px-2 mb-2">
                    <div>Joining: <span class="text-slate-900 font-black">${roJoining}</span></div>
                    <div>Expiry: <span class="text-slate-900 font-black">22 Aug 2030</span></div>
                  </div>

                  <!-- Barcode -->
                  <div class="h-6 flex items-center justify-center gap-0.5 text-slate-900">
                    <span class="w-1 h-full bg-slate-900"></span><span class="w-0.5 h-full bg-slate-900"></span><span class="w-1.5 h-full bg-slate-900"></span>
                    <span class="w-0.5 h-full bg-slate-900"></span><span class="w-1 h-full bg-slate-900"></span><span class="w-0.5 h-full bg-slate-900"></span>
                    <span class="w-2 h-full bg-slate-900"></span><span class="w-0.5 h-full bg-slate-900"></span><span class="w-1 h-full bg-slate-900"></span>
                    <span class="w-1.5 h-full bg-slate-900"></span><span class="w-0.5 h-full bg-slate-900"></span><span class="w-1 h-full bg-slate-900"></span>
                  </div>
                </div>

                <!-- ID Card Back Summary Footer -->
                <div class="bg-[#33373B] text-white px-3 py-2 flex items-center justify-between text-[8px] font-bold">
                  <span>COI: U70200TS2025PLC202763</span>
                  <span class="text-[#84CC16]">GST: 22AAKCN7622G1ZJ</span>
                </div>
              </div>
            </div>

            <!-- Tab 2: Visiting Card View -->
            <div id="cred-tab-visiting" class="hidden space-y-3">
              <div class="bg-[#33373B] text-white rounded-2xl overflow-hidden p-4 shadow-2xl border border-slate-700">
                <div class="flex items-center justify-between pb-3 border-b border-slate-700">
                  <div>
                    <div class="text-[9px] font-black text-white">NUOG HOUSING PAYMENT'S LIMITED</div>
                    <div class="text-[7.5px] text-[#84CC16] font-bold">DIGITALLY POWERED BY NUO-G MONEY</div>
                  </div>
                  <span class="bg-[#22C55E] text-white text-[9px] font-black px-2 py-0.5 rounded-full">${roEmpId}</span>
                </div>
                <div class="py-3">
                  <div class="text-lg font-black text-[#22C55E] tracking-wide uppercase">${roName}</div>
                  <div class="text-xs font-bold text-slate-200">${roRole}</div>
                  <div class="text-[11px] text-slate-400 mt-1">${roDept} • ${roLocation}</div>
                </div>
                <div class="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-700 font-mono">
                  <div>📞 +91 ${roPhone}</div>
                  <div>✉️ ${roEmail}</div>
                  <div class="text-[10px] font-sans text-slate-400">📍 Raza's Capital Plaza, Pachpedi Naka, Raipur (C.G.)</div>
                </div>
              </div>
            </div>

            <!-- Tab 3: Employee Certificate View -->
            <div id="cred-tab-cert" class="hidden space-y-3">
              <div class="bg-white text-slate-900 rounded-2xl overflow-hidden p-5 shadow-2xl border-2 border-[#22C55E]">
                <div class="text-center">
                  <div class="w-10 h-10 mx-auto rounded-full bg-emerald-100 border border-[#22C55E] flex items-center justify-center text-[#16A34A] text-lg mb-2">🏅</div>
                  <div class="text-[9px] font-black text-slate-700 tracking-wider">NUOG HOUSING PAYMENT'S LIMITED</div>
                  <div class="text-[11px] font-black text-[#16A34A] uppercase tracking-wide mt-1">CERTIFICATE OF OFFICIAL AUTHORIZATION</div>
                  <div class="text-xs italic text-slate-500 mt-2">This is to officially certify that</div>
                  <div class="text-base font-black text-slate-900 mt-1 uppercase">${roName}</div>
                  <div class="text-xs font-bold text-[#16A34A]">${roRole} • Emp ID: ${roEmpId}</div>
                  <p class="text-[10px] text-slate-600 mt-2 leading-relaxed">
                    is an authorized officer certified to facilitate customer onboarding and loan documentation across India under corporate governance norms.
                  </p>
                  <div class="flex justify-between items-end mt-4 pt-3 border-t border-slate-200 text-[9px] text-slate-500 font-bold">
                    <div class="text-left">
                      <div>Ref: CERT-NGM-${roEmpId}</div>
                      <div>Valid Upto: 22 Aug 2030</div>
                    </div>
                    <div class="text-right text-[#16A34A] font-black">
                      ✓ Authorized Signatory<br>NUOG HOUSING LTD.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Just Beneath Credentials: Employee's RM with Name, Designation & ONLY Action Logos (No Text Numbers/Emails) -->
          <div class="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-blue-500/30 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xl shadow-inner">
                👔
              </div>
              <div>
                <div class="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Officer's Reporting Manager (RM)</div>
                <div class="text-sm font-extrabold text-white leading-tight mt-0.5">${rmName}</div>
                <div class="text-xs font-semibold text-slate-300">${rmRole}</div>
              </div>
            </div>

            <!-- ONLY Action Logos (Call, WhatsApp, Email) - No Text Numbers Displayed -->
            <div class="flex items-center gap-2">
              <a href="tel:+91${rmPhone}" title="Call RM" class="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/30 transition-all shadow-sm">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
              </a>
              <a href="https://wa.me/91${rmPhone}" target="_blank" title="WhatsApp RM" class="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 hover:bg-green-500/30 transition-all shadow-sm">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.585 1.961.895 3.023.895 3.18 0 5.766-2.587 5.768-5.766 0-3.18-2.588-5.766-5.768-5.766zm9.969 5.766c0 5.514-4.486 10-10 10-1.748 0-3.385-.45-4.819-1.238l-5.181 1.356 1.38-5.042c-.854-1.488-1.348-3.218-1.348-5.076 0-5.514 4.486-10 10-10 5.514 0 10 4.486 10 10z"/></svg>
              </a>
              <a href="mailto:${rmEmail}" title="Email RM" class="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 hover:bg-orange-500/30 transition-all shadow-sm">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              </a>
            </div>
          </div>
        </div>

        <script>
          function switchCredTab(tab) {
            ['idcard', 'visiting', 'cert'].forEach(function(t) {
              var el = document.getElementById('cred-tab-' + t);
              var btn = document.getElementById('tab-btn-' + t);
              if (el && btn) {
                if (t === tab) {
                  el.classList.remove('hidden');
                  btn.classList.add('bg-emerald-500', 'text-white');
                  btn.classList.remove('text-slate-400');
                } else {
                  el.classList.add('hidden');
                  btn.classList.remove('bg-emerald-500', 'text-white');
                  btn.classList.add('text-slate-400');
                }
              }
            });
          }
        </script>

        <!-- Comprehensive Details Card -->
        <div class="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 mb-6 space-y-3.5">
          <div class="grid grid-cols-2 gap-3 pb-3 border-b border-slate-800/80">
            <div>
              <div class="text-[11px] text-slate-400 font-medium">Product Category</div>
              <div class="text-xs font-bold text-white mt-0.5">${productCategory}</div>
            </div>
            <div>
              <div class="text-[11px] text-slate-400 font-medium">Loan Sub-Type</div>
              <div class="text-xs font-bold text-emerald-400 mt-0.5">${productSubtype}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 pb-3 border-b border-slate-800/80">
            <div>
              <div class="text-[11px] text-slate-400 font-medium">Requested Loan Volume</div>
              <div class="text-base font-extrabold text-white mt-0.5">₹${expectedAmount}</div>
            </div>
            <div>
              <div class="text-[11px] text-slate-400 font-medium">Tenure / Comfort EMI</div>
              <div class="text-xs font-bold text-slate-200 mt-0.5">${tenure} / ${comfortEmi}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 pb-3 border-b border-slate-800/80">
            <div>
              <div class="text-[11px] text-slate-400 font-medium">Customer Mobile</div>
              <div class="text-xs font-mono font-bold text-slate-200 mt-0.5">${mobile ? `+91 ${mobile}` : 'Not provided'}</div>
            </div>
            <div>
              <div class="text-[11px] text-slate-400 font-medium">Email / Constitution</div>
              <div class="text-xs font-semibold text-slate-200 mt-0.5 truncate">${email || constitutionType}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="text-[11px] text-slate-400 font-medium">Facility / Program</div>
              <div class="text-xs font-semibold text-slate-300 mt-0.5">${facilityType} (${financialProgram})</div>
            </div>
            <div>
              <div class="text-[11px] text-slate-400 font-medium">Location / Pincode</div>
              <div class="text-xs font-semibold text-slate-300 mt-0.5">${cityState} ${pincode ? `(${pincode})` : ''}</div>
            </div>
          </div>
        </div>

        ${isCompleted ? `
          <div class="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2 mb-6">
            <div class="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h3 class="text-base font-bold text-white">Your Documents & Form Have Been Submitted!</h3>
            <p class="text-xs text-slate-300">Our telecaller & loan underwriting team are currently reviewing your file. You will receive a verification call shortly.</p>
          </div>
        ` : `
          <!-- Customer Document Upload & Form Section -->
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 mb-6 space-y-4">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              Upload Mandatory KYC & Income Documents
            </h3>
            <p class="text-xs text-slate-400">Please provide your KYC details to fast-track your loan approval process.</p>

            <form id="customerUploadForm" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1">PAN Number *</label>
                  <input type="text" id="panNumber" required placeholder="ABCDE1234F" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs uppercase font-mono text-white focus:outline-none focus:border-emerald-500" value="${lead?.panNumber || ''}">
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-300 mb-1">Aadhaar Number *</label>
                  <input type="text" id="aadhaarNumber" required placeholder="1234 5678 9012" class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500" value="${lead?.aadhaarApc || ''}">
                </div>
              </div>

              <!-- Aadhaar Front & Back Upload -->
              <div class="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                <div class="text-xs font-bold text-slate-200">1. Aadhaar Card (Front & Back) *</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label class="text-[11px] text-slate-400 block mb-1">Aadhaar Front Photo</label>
                    <input type="file" id="aadhaarFrontFile" accept="image/*,.pdf" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700">
                  </div>
                  <div>
                    <label class="text-[11px] text-slate-400 block mb-1">Aadhaar Back Photo (Address)</label>
                    <input type="file" id="aadhaarBackFile" accept="image/*,.pdf" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700">
                  </div>
                </div>
              </div>

              <!-- PAN & Bank Statement Upload -->
              <div class="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                <div class="text-xs font-bold text-slate-200">2. PAN Card & 6-Month Bank Statement *</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label class="text-[11px] text-slate-400 block mb-1">PAN Card Photo</label>
                    <input type="file" id="panFile" accept="image/*,.pdf" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700">
                  </div>
                  <div>
                    <label class="text-[11px] text-slate-400 block mb-1">Bank Statement (PDF / Image)</label>
                    <input type="file" id="bankStatementFile" accept="image/*,.pdf" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700">
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-300 mb-1">Notes / Additional Remarks</label>
                <textarea id="customerRemarks" rows="2" placeholder="Any specific requirements or preferred contact time..." class="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"></textarea>
              </div>

              <button type="submit" id="submitBtn" class="w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white gradient-btn shadow-lg transition duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2">
                Submit Online Application & Documents
              </button>
            </form>
          </div>

          <script>
            document.getElementById('customerUploadForm')?.addEventListener('submit', async function(e) {
              e.preventDefault();
              const btn = document.getElementById('submitBtn');
              btn.disabled = true;
              btn.innerText = 'Uploading and Submitting...';

              const docs = [];
              const aadhaarFront = document.getElementById('aadhaarFrontFile').files[0];
              const aadhaarBack = document.getElementById('aadhaarBackFile').files[0];
              const panFile = document.getElementById('panFile').files[0];
              const bankFile = document.getElementById('bankStatementFile').files[0];

              async function uploadFileDirect(file, field) {
                if (!file) return null;
                const fd = new FormData();
                fd.append('file', file);
                fd.append('field', field);
                try {
                  let upRes = await fetch('/api/apply/upload', { method: 'POST', body: fd });
                  if (!upRes.ok) {
                    upRes = await fetch('/apply/upload', { method: 'POST', body: fd });
                  }
                  const upData = await upRes.json();
                  return upData.success ? upData.fileUrl : null;
                } catch (e) {
                  console.error('File upload failed:', e);
                  return null;
                }
              }

              btn.innerText = 'Uploading documents...';

              let aadhaarFrontUrl = '';
              let aadhaarBackUrl = '';
              let panUrl = '';
              let bankUrl = '';

              if (aadhaarFront) {
                aadhaarFrontUrl = (await uploadFileDirect(aadhaarFront, 'aadhaar')) || '';
              }
              if (aadhaarBack) {
                aadhaarBackUrl = (await uploadFileDirect(aadhaarBack, 'aadhaar')) || '';
              }
              if (panFile) {
                panUrl = (await uploadFileDirect(panFile, 'pan')) || '';
              }
              if (bankFile) {
                bankUrl = (await uploadFileDirect(bankFile, 'bankStatement')) || '';
              }

              if (aadhaarFront) {
                docs.push({
                  type: 'Aadhaar Card',
                  fileName: aadhaarFront.name,
                  fileUrl: aadhaarFrontUrl,
                  fileNameBack: aadhaarBack ? aadhaarBack.name : '',
                  fileUrlBack: aadhaarBackUrl,
                  hasBothSides: Boolean(aadhaarBack),
                  remark: 'Uploaded by customer online'
                });
              }

              if (panFile) {
                docs.push({
                  type: 'PAN Card',
                  fileName: panFile.name,
                  fileUrl: panUrl,
                  remark: 'Uploaded by customer online'
                });
              }

              if (bankFile) {
                docs.push({
                  type: 'Bank Statement',
                  fileName: bankFile.name,
                  fileUrl: bankUrl,
                  remark: 'Uploaded by customer online'
                });
              }

              const payload = {
                panNumber: document.getElementById('panNumber').value,
                aadhaarNumber: document.getElementById('aadhaarNumber').value,
                customerRemarks: document.getElementById('customerRemarks').value,
                documents: docs
              };

              try {
                const res = await fetch('/apply/submit/' + encodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop()), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                const result = await res.json();
                if (result.success) {
                  alert('Thank you! Your documents and application details were received successfully.');
                  window.location.reload();
                } else {
                  alert(result.message || 'Error submitting form. Please try again.');
                  btn.disabled = false;
                  btn.innerText = 'Submit Online Application & Documents';
                }
              } catch (err) {
                alert('Network error submitting application');
                btn.disabled = false;
                btn.innerText = 'Submit Online Application & Documents';
              }
            });
          </script>
        `}

        <!-- Trust / Security Footer -->
        <div class="mt-6 pt-4 border-t border-slate-800 text-center flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <svg class="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
          256-Bit SSL Encrypted & Bank-Grade Protected by HAUS NuoGM
        </div>

      </div>
    </body>
    </html>
  `);
};

router.get('/', handleApplyPage);
router.get('/:leadId', handleApplyPage);

module.exports = router;
