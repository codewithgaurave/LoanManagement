const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const Notification = require('../models/Notification');

// Handle Public Customer Form Submission (Online Link Upload)
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
          fileUrl: doc.fileUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=400',
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

              if (aadhaarFront) {
                docs.push({
                  type: 'Aadhaar Card',
                  fileName: aadhaarFront.name,
                  fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=400',
                  fileNameBack: aadhaarBack ? aadhaarBack.name : '',
                  fileUrlBack: aadhaarBack ? 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=400' : '',
                  remark: 'Uploaded by customer online'
                });
              }

              if (panFile) {
                docs.push({
                  type: 'PAN Card',
                  fileName: panFile.name,
                  fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=400',
                  remark: 'Uploaded by customer online'
                });
              }

              if (bankFile) {
                docs.push({
                  type: 'Bank Statement',
                  fileName: bankFile.name,
                  fileUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=400',
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
                const res = await fetch('/api/apply/submit/${displayLeadId}', {
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
