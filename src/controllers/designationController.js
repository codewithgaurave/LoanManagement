const Department = require('../models/Department');

// @desc    Get all designations (optionally filter by department, status)
// @route   GET /api/designations
// @access  Public / Protected
const getDesignations = async (req, res) => {
  try {
    const { department, status } = req.query;
    const query = {};
    if (department && department !== 'all') {
      query.name = { $regex: new RegExp(`^${department}$`, 'i') };
    }

    const departments = await Department.find(query);
    const allDesignations = [];

    for (const dept of departments) {
      if (Array.isArray(dept.designations)) {
        for (const des of dept.designations) {
          if (status && status !== 'all' && des.status !== status) {
            continue;
          }
          allDesignations.push({
            _id: des._id,
            name: des.name,
            department: dept.name,
            departmentId: dept._id,
            description: des.description || '',
            status: des.status || 'Active',
            createdAt: des.createdAt
          });
        }
      }
    }

    // Sort by department and name
    allDesignations.sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
    res.status(200).json(allDesignations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new designation
// @route   POST /api/designations
// @access  Private (Admin)
const createDesignation = async (req, res) => {
  try {
    const { name, department, description, status } = req.body;
    if (!name || !department) {
      return res.status(400).json({ message: 'Designation name and department are required' });
    }

    const trimmedName = name.trim();
    const formattedDept = department.toUpperCase();

    let deptDoc = await Department.findOne({
      name: { $regex: new RegExp(`^${formattedDept}$`, 'i') }
    });

    if (!deptDoc) {
      deptDoc = await Department.create({
        departmentId: `DEP-${Date.now().toString().slice(-4)}`,
        name: formattedDept,
        description: `${formattedDept} Department`,
        status: 'Active',
        designations: []
      });
    }

    // Check if designation already exists in this department
    const exists = (deptDoc.designations || []).some(
      d => d.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (exists) {
      return res.status(400).json({ message: 'Designation already exists in this department' });
    }

    const newDesig = {
      name: trimmedName,
      description: description || '',
      status: status || 'Active',
      createdAt: new Date()
    };

    deptDoc.designations.push(newDesig);
    await deptDoc.save();

    const created = deptDoc.designations[deptDoc.designations.length - 1];

    res.status(201).json({
      _id: created._id,
      name: created.name,
      department: deptDoc.name,
      departmentId: deptDoc._id,
      description: created.description,
      status: created.status,
      createdAt: created.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a designation
// @route   PUT /api/designations/:id
// @access  Private (Admin)
const updateDesignation = async (req, res) => {
  try {
    const { name, department, description, status } = req.body;
    const desigId = req.params.id;

    // Find the department containing this designation
    const deptDoc = await Department.findOne({ 'designations._id': desigId });

    if (!deptDoc) {
      return res.status(404).json({ message: 'Designation not found' });
    }

    const desig = deptDoc.designations.id(desigId);
    if (!desig) {
      return res.status(404).json({ message: 'Designation not found' });
    }

    if (name) desig.name = name.trim();
    if (description !== undefined) desig.description = description;
    if (status) desig.status = status;

    await deptDoc.save();

    res.status(200).json({
      _id: desig._id,
      name: desig.name,
      department: deptDoc.name,
      description: desig.description,
      status: desig.status,
      createdAt: desig.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a designation
// @route   DELETE /api/designations/:id
// @access  Private (Admin)
const deleteDesignation = async (req, res) => {
  try {
    const desigId = req.params.id;
    const deptDoc = await Department.findOne({ 'designations._id': desigId });

    if (!deptDoc) {
      return res.status(404).json({ message: 'Designation not found' });
    }

    deptDoc.designations.pull({ _id: desigId });
    await deptDoc.save();

    res.status(200).json({ message: 'Designation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation
};
