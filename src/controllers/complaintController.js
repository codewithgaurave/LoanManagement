const Complaint = require('../models/Complaint');

// @desc    Get all complaints (Admin)
// @route   GET /api/complaints
// @access  Private (Admin)
const getComplaints = async (req, res) => {
  try {
    const { unassigned, assignedToId, status, category } = req.query;
    let query = {};

    const roleLower = (req.admin?.role || '').toLowerCase();
    const isMasterAdmin = ['super admin', 'superadmin', 'admin'].includes(roleLower);

    if (isMasterAdmin) {
      if (unassigned === 'true') {
        query.assignedToId = null;
      } else if (assignedToId) {
        query.assignedToId = assignedToId;
      }
    } else if (req.admin) {
      // Regular staff only sees assigned complaints
      query.assignedToId = req.admin._id.toString();
    }

    if (status && status !== 'all') query.status = status;
    if (category && category !== 'all') query.category = category;

    const complaints = await Complaint.find(query).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get customer's enquiries/tickets
// @route   GET /api/complaints/my-enquiries
// @access  Public or Protected
const getCustomerEnquiries = async (req, res) => {
  try {
    const { phone, userId } = req.query;
    let query = {};
    if (userId && userId !== 'null' && userId !== 'undefined') {
      query.$or = [{ userId: userId }];
      if (phone) query.$or.push({ phone: phone });
    } else if (phone) {
      query.phone = phone;
    } else {
      return res.json([]);
    }

    const enquiries = await Complaint.find(query).sort({ createdAt: -1 });
    res.json(enquiries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new complaint / enquiry (Admin or Customer)
// @route   POST /api/complaints or POST /api/complaints/enquiry
// @access  Public / Private
const createComplaint = async (req, res) => {
  try {
    const { customer, phone, email, userId, subject, category, description, priority } = req.body;
    
    if (!customer || !subject || !phone) {
      return res.status(400).json({ message: 'Please provide customer name, phone number, and subject.' });
    }

    const complaint = new Complaint({
      customer,
      phone,
      email: email || '',
      userId: userId || '',
      subject,
      category: category || 'General Support',
      description: description || '',
      priority: priority || 'Medium'
    });

    const createdComplaint = await complaint.save();
    res.status(201).json(createdComplaint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update complaint status & admin reply
// @route   PUT /api/complaints/:id/status
// @access  Private (Admin)
const updateComplaintStatus = async (req, res) => {
  try {
    const { status, adminReply, adminRemark, assignedTo, assignedToId } = req.body;
    const complaint = await Complaint.findById(req.params.id);

    if (complaint) {
      if (status) complaint.status = status;
      if (adminReply !== undefined) complaint.adminReply = adminReply;
      if (adminRemark !== undefined) complaint.adminRemark = adminRemark;
      if (assignedTo !== undefined) {
        complaint.assignedTo = assignedTo;
        complaint.assignedToId = assignedToId || null;
        complaint.assignedBy = req.admin ? `${req.admin.name || req.admin.email} (${req.admin.role})` : 'Admin';
        complaint.assignedAt = new Date();
      }
      if (status === 'Resolved') {
        complaint.resolvedAt = new Date();
      }
      const updatedComplaint = await complaint.save();

      // Trigger targeted notification to customer regarding their enquiry
      if (adminReply || status) {
        try {
          const { notifyCustomer } = require('../services/firebaseService');
          await notifyCustomer({
            userId: complaint.userId,
            phone: complaint.phone,
            email: complaint.email,
            title: `Support Update [${complaint.complaintId}]: ${complaint.subject}`,
            body: adminReply 
              ? `Agent Reply: "${adminReply}"` 
              : `Your ticket status has been changed to [${status}].`,
            data: {
              type: 'info',
              enquiryId: complaint.complaintId,
              actionScreen: 'CustomerSupportScreen'
            }
          });
        } catch (notifErr) {
          console.error('Customer enquiry notification error:', notifErr.message);
        }
      }

      res.json(updatedComplaint);
    } else {
      res.status(404).json({ message: 'Complaint not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign single complaint/enquiry to employee
// @route   PUT /api/complaints/:id/assign
// @access  Private (Admin)
const assignComplaint = async (req, res) => {
  try {
    const { assignedTo, assignedToId } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint/Enquiry not found' });

    const previousAssignee = complaint.assignedTo || 'Unassigned';
    complaint.assignedTo = assignedTo;
    complaint.assignedToId = assignedToId || null;
    complaint.assignedBy = req.admin ? `${req.admin.name || req.admin.email} (${req.admin.role})` : 'Admin';
    complaint.assignedAt = new Date();

    if (!complaint.assignmentHistory) complaint.assignmentHistory = [];
    complaint.assignmentHistory.push({
      assignedTo,
      assignedToId: complaint.assignedToId,
      assignedBy: complaint.assignedBy,
      assignedAt: complaint.assignedAt,
      previousAssignee
    });

    await complaint.save();
    res.json({ message: 'Enquiry assigned successfully', complaint });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk assign complaints/enquiries
// @route   PUT /api/complaints/bulk-assign
// @access  Private (Admin)
const bulkAssignComplaints = async (req, res) => {
  try {
    const { complaintIds, assignedTo, assignedToId } = req.body;
    if (!complaintIds || !complaintIds.length) {
      return res.status(400).json({ message: 'No enquiries selected' });
    }

    const assignedBy = req.admin ? `${req.admin.name || req.admin.email} (${req.admin.role})` : 'Admin';
    const assignedAt = new Date();

    for (const id of complaintIds) {
      const complaint = await Complaint.findById(id);
      if (complaint) {
        const previousAssignee = complaint.assignedTo || 'Unassigned';
        complaint.assignedTo = assignedTo;
        complaint.assignedToId = assignedToId || null;
        complaint.assignedBy = assignedBy;
        complaint.assignedAt = assignedAt;
        if (!complaint.assignmentHistory) complaint.assignmentHistory = [];
        complaint.assignmentHistory.push({
          assignedTo,
          assignedToId: complaint.assignedToId,
          assignedBy,
          assignedAt,
          previousAssignee
        });
        await complaint.save();
      }
    }

    res.json({ message: `${complaintIds.length} enquiries assigned successfully to ${assignedTo}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete complaint
// @route   DELETE /api/complaints/:id
// @access  Private (Admin)
const deleteComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);

    if (complaint) {
      await complaint.deleteOne();
      res.json({ message: 'Complaint removed' });
    } else {
      res.status(404).json({ message: 'Complaint not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getComplaints,
  getCustomerEnquiries,
  createComplaint,
  updateComplaintStatus,
  assignComplaint,
  bulkAssignComplaints,
  deleteComplaint
};

