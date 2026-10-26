const express = require('express');
const router = express.Router();
const { getDetailsByPincode, reverseGeocode } = require('../controllers/locationController');

// Public endpoints for Pincode lookup and reverse geocoding
router.get('/pincode/:pincode', getDetailsByPincode);
router.post('/reverse-geocode', reverseGeocode);

module.exports = router;
