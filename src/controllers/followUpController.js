const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const EmployeeFollowUp = require('../models/EmployeeFollowUp');

const privilegedRoles = ['admin', 'super admin', 'superadmin'];

const isPrivilegedAdmin = (req) => privilegedRoles.includes((req.admin?.role || '').toLowerCase());

const getIdentity = (req) => ({
  id: req.admin?._id?.toString() || '',
  name: req.admin?.name || 'Employee',
  role: req.admin?.role || ''
});

const getFollowUps = async (req, res) => {
  try {
    const query = {};
    if (!isPrivilegedAdmin(req)) {
      query.assignedToId = getIdentity(req).id;
    } else if (req.query.assignedToId && req.query.assignedToId !== 'all') {
      query.assignedToId = req.query.assignedToId;
    }

    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }

    const followUps = await EmployeeFollowUp.find(query).sort({ scheduledAt: 1, createdAt: -1 });
    res.status(200).json({ success: true, followUps, canAssign: isPrivilegedAdmin(req) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createFollowUp = async (req, res) => {
  try {
    const identity = getIdentity(req);
    if (!identity.id) {
      return res.status(401).json({ success: false, message: 'Employee identity is required' });
    }

    const { leadName, leadId, mobile, type, purpose, scheduledAt, reminder, notes } = req.body;
    if (!leadName || !type || !scheduledAt || !notes) {
      return res.status(400).json({ success: false, message: 'Lead name, type, date, and notes are required' });
    }

    const followUp = await EmployeeFollowUp.create({
      leadName,
      leadId,
      mobile,
      type,
      purpose,
      scheduledAt,
      reminder,
      notes,
      assignedToId: identity.id,
      assignedToName: identity.name,
      createdById: identity.id,
      createdByName: identity.name,
      createdByRole: identity.role
    });

    res.status(201).json({ success: true, followUp });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateFollowUpStatus = async (req, res) => {
  try {
    const followUp = await EmployeeFollowUp.findById(req.params.id);
    if (!followUp) return res.status(404).json({ success: false, message: 'Follow-up not found' });

    const identity = getIdentity(req);
    if (!isPrivilegedAdmin(req) && followUp.assignedToId !== identity.id) {
      return res.status(403).json({ success: false, message: 'You can update only your own follow-ups' });
    }

    followUp.status = req.body.status;
    await followUp.save();
    res.status(200).json({ success: true, followUp });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const assignFollowUp = async (req, res) => {
  try {
    if (!isPrivilegedAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Only Admin or Super Admin can assign follow-ups' });
    }

    const { assignedToId } = req.body;
    if (!assignedToId || !mongoose.Types.ObjectId.isValid(assignedToId)) {
      return res.status(400).json({ success: false, message: 'A valid employee is required' });
    }

    const employee = await Employee.findById(assignedToId).select('name empId');
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const followUp = await EmployeeFollowUp.findByIdAndUpdate(
      req.params.id,
      { assignedToId: employee._id.toString(), assignedToName: employee.name },
      { new: true, runValidators: true }
    );
    if (!followUp) return res.status(404).json({ success: false, message: 'Follow-up not found' });

    res.status(200).json({ success: true, followUp });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = { getFollowUps, createFollowUp, updateFollowUpStatus, assignFollowUp };
