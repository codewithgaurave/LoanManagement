const Visit = require('../models/Visit');
const Lead = require('../models/Lead');

// @desc    Get all visits with filters
// @route   GET /api/visits
// @access  Private
const getVisits = async (req, res) => {
  try {
    const { status, purpose, agentId, search } = req.query;
    let query = {};

    if (status && status !== 'all') query.status = status;
    if (purpose && purpose !== 'all') query.purpose = purpose;
    if (agentId) query.agentId = agentId;

    if (search) {
      query.$or = [
        { visitId: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }

    const visits = await Visit.find(query).sort({ scheduledDate: -1, createdAt: -1 });
    res.status(200).json(visits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single visit
// @route   GET /api/visits/:id
// @access  Private
const getVisitById = async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id) || 
      await Visit.findOne({ visitId: req.params.id });

    if (!visit) {
      return res.status(404).json({ message: 'Visit not found' });
    }
    res.status(200).json(visit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Schedule a new visit
// @route   POST /api/visits
// @access  Private
const createVisit = async (req, res) => {
  try {
    const {
      leadId,
      loanId,
      customerName,
      mobile,
      address,
      city,
      pincode,
      purpose,
      scheduledDate,
      scheduledTime,
      agentId,
      agentName,
      remarks
    } = req.body;

    const count = await Visit.countDocuments();
    const visitId = `VST-${(count + 101).toString()}`;

    const newVisit = await Visit.create({
      visitId,
      leadId,
      loanId,
      customerName,
      mobile,
      address,
      city: city || 'Lucknow',
      pincode: pincode || '226010',
      purpose: purpose || 'Address Verification',
      scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
      scheduledTime: scheduledTime || '11:00 AM',
      agentId: agentId || (req.admin ? req.admin._id.toString() : ''),
      agentName: agentName || (req.admin ? (req.admin.name || 'Field Agent') : 'Field Agent'),
      status: 'Scheduled',
      remarks: remarks || ''
    });

    res.status(201).json(newVisit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update visit status / outcome
// @route   PUT /api/visits/:id
// @access  Private
const updateVisit = async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id) || 
      await Visit.findOne({ visitId: req.params.id });

    if (!visit) {
      return res.status(404).json({ message: 'Visit not found' });
    }

    if (req.body.status) visit.status = req.body.status;
    if (req.body.outcome) visit.outcome = req.body.outcome;
    if (req.body.remarks) visit.remarks = req.body.remarks;
    if (req.body.scheduledDate) visit.scheduledDate = req.body.scheduledDate;
    if (req.body.scheduledTime) visit.scheduledTime = req.body.scheduledTime;
    if (req.body.documentsCollected) visit.documentsCollected = req.body.documentsCollected;

    await visit.save();
    res.status(200).json(visit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Agent Visit stats
// @route   GET /api/visits/stats
// @access  Private
const getVisitStats = async (req, res) => {
  try {
    const total = await Visit.countDocuments();
    const scheduled = await Visit.countDocuments({ status: 'Scheduled' });
    const inProgress = await Visit.countDocuments({ status: 'In Progress' });
    const completed = await Visit.countDocuments({ status: 'Completed' });
    const cancelled = await Visit.countDocuments({ status: 'Cancelled' });

    res.status(200).json({
      total,
      scheduled,
      inProgress,
      completed,
      cancelled
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getVisits,
  getVisitById,
  createVisit,
  updateVisit,
  getVisitStats
};
