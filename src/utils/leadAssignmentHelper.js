const Employee = require('../models/Employee');

/**
 * Auto-assigns a newly generated Lead to:
 * 1. The specific Zone's RM (North, South, East, West, Central)
 * 2. An All-India Telecaller in persistent Round-Robin / Alternate order (Telecaller A <-> Telecaller B)
 *    Uses least-recently-assigned timestamp on Employee model (persists across days & server restarts without extra collections)
 * 
 * @param {string} zone - Target zone ('NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL')
 * @returns {Promise<{ rm: Object|null, telecaller: Object|null }>}
 */
async function getAutoAssignedRMAndTelecaller(zone = 'NORTH') {
  const normalizedZone = (zone || 'NORTH').toUpperCase();

  // 1. ── FIND ZONE-SPECIFIC RM ───────────────────────────────────────
  let rm = await Employee.findOne({
    zone: normalizedZone,
    status: 'Active',
    $or: [
      { zonalRole: 'RM' },
      { role: { $regex: '^rm$', $options: 'i' } },
      { designation: { $regex: 'reporting manager|rm', $options: 'i' } }
    ]
  }).sort({ createdAt: 1 });

  // Fallback if needed
  if (!rm) {
    rm = await Employee.findOne({
      zone: normalizedZone,
      status: 'Active',
      role: { $regex: 'rm', $options: 'i' }
    });
  }

  // 2. ── FIND ALL-INDIA ACTIVE TELECALLERS & PERFORM ROUND-ROBIN ────
  // Sort by lastAssignedLeadAt ascending (nulls first), so least recently assigned telecaller gets the lead
  const telecallers = await Employee.find({
    status: 'Active',
    $or: [
      { zonalRole: 'Telecaller' },
      { role: { $regex: 'tele', $options: 'i' } },
      { designation: { $regex: 'tele', $options: 'i' } }
    ]
  }).sort({ lastAssignedLeadAt: 1, empId: 1 });

  let assignedTelecaller = null;

  if (telecallers && telecallers.length > 0) {
    // Pick the telecaller whose turn it is
    assignedTelecaller = telecallers[0];

    // Atomically update their lastAssignedLeadAt and total count
    await Employee.findByIdAndUpdate(assignedTelecaller._id, {
      $set: { lastAssignedLeadAt: new Date() },
      $inc: { totalAssignedLeads: 1 }
    });
  }

  return {
    rm: rm ? {
      _id: rm._id,
      name: rm.name,
      empId: rm.empId,
      zone: rm.zone
    } : null,
    telecaller: assignedTelecaller ? {
      _id: assignedTelecaller._id,
      name: assignedTelecaller.name,
      empId: assignedTelecaller.empId,
      zone: assignedTelecaller.zone
    } : null
  };
}

module.exports = {
  getAutoAssignedRMAndTelecaller
};
