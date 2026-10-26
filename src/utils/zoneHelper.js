/**
 * NUOG HOUSING & PAYMENTS - ZONAL MASTER MAPPING
 * 
 * North Zone: Haryana, Punjab, Jammu, Himachal Pradesh, Uttarakhand & Uttar Pradesh
 * South Zone: Andhra Pradesh, Karnataka, Kerala, Tamil Nadu, Telangana & Puducherry
 * East Zone:  Bihar, Jharkhand, Orissa, Chhattisgarh, West Bengal, Sikkim & Assam
 * West Zone:  Maharashtra, Gujarat, Madhya Pradesh, Rajasthan & Goa
 * Central Zone: Chandigarh & Delhi
 */

const ZONES = {
  NORTH: 'NORTH',
  SOUTH: 'SOUTH',
  EAST: 'EAST',
  WEST: 'WEST',
  CENTRAL: 'CENTRAL'
};

const ZONE_STATES_MAP = {
  [ZONES.NORTH]: [
    'Haryana', 
    'Punjab', 
    'Jammu', 
    'Jammu and Kashmir', 
    'Jammu & Kashmir', 
    'Himachal Pradesh', 
    'Uttarakhand', 
    'Uttar Pradesh',
    'UP'
  ],
  [ZONES.SOUTH]: [
    'Andhra Pradesh', 
    'Karnataka', 
    'Kerala', 
    'Tamil Nadu', 
    'Telangana', 
    'Puducherry', 
    'Pondicherry'
  ],
  [ZONES.EAST]: [
    'Bihar', 
    'Jharkhand', 
    'Orissa', 
    'Odisha', 
    'Chhattisgarh', 
    'West Bengal', 
    'WB', 
    'Sikkim', 
    'Assam'
  ],
  [ZONES.WEST]: [
    'Maharashtra', 
    'Gujarat', 
    'Madhya Pradesh', 
    'MP', 
    'Rajasthan', 
    'Goa'
  ],
  [ZONES.CENTRAL]: [
    'Chandigarh', 
    'Delhi', 
    'New Delhi',
    'NCT of Delhi'
  ]
};

/**
 * Get Zone automatically from state name
 * @param {string} stateName 
 * @returns {string} NORTH | SOUTH | EAST | WEST | CENTRAL
 */
const getZoneFromState = (stateName) => {
  if (!stateName || typeof stateName !== 'string') return ZONES.NORTH;
  const clean = stateName.trim().toLowerCase();

  for (const [zoneKey, stateList] of Object.entries(ZONE_STATES_MAP)) {
    if (stateList.some(s => s.toLowerCase() === clean || clean.includes(s.toLowerCase()))) {
      return zoneKey;
    }
  }

  return ZONES.NORTH; // Default fallback
};

/**
 * Get all states under a specific zone
 * @param {string} zone 
 * @returns {Array<string>}
 */
const getStatesByZone = (zone) => {
  const upperZone = (zone || '').toUpperCase();
  return ZONE_STATES_MAP[upperZone] || [];
};

module.exports = {
  ZONES,
  ZONE_STATES_MAP,
  getZoneFromState,
  getStatesByZone
};
