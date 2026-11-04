const https = require('https');

// Helper to fetch from India Post Postal Pincode API
const fetchPincodeDetails = (pincode) => {
  return new Promise((resolve) => {
    const url = `https://api.postalpincode.in/pincode/${pincode}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed[0]?.Status === 'Success') {
            const postOffices = parsed[0].PostOffice || [];
            const primary = postOffices[0] || {};
            
            const areas = postOffices.map(po => po.Name).filter(Boolean);
            
            resolve({
              success: true,
              pincode,
              city: primary.District || primary.Division || primary.Block || '',
              district: primary.District || '',
              state: primary.State || '',
              country: primary.Country || 'India',
              areas: Array.from(new Set(areas)),
            });
          } else {
            resolve({ success: false, message: 'Pincode not found' });
          }
        } catch (e) {
          resolve({ success: false, message: 'Failed to parse pincode data' });
        }
      });
    }).on('error', (err) => {
      resolve({ success: false, message: err.message });
    });
  });
};

// @desc    Get location details by Indian Pincode
// @route   GET /api/location/pincode/:pincode
// @access  Public
const getDetailsByPincode = async (req, res) => {
  try {
    const { pincode } = req.params;
    if (!pincode || !/^\d{6}$/.test(pincode.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 6-digit Indian PIN code' });
    }

    const result = await fetchPincodeDetails(pincode.trim());
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reverse geocode coordinates to address
// @route   POST /api/location/reverse-geocode
// @access  Public
const reverseGeocode = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Latitude and Longitude are required' });
    }

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyBEss4wpsQ0o9WPBjDgHsSByUzFuo2oSNE';

    // 1. First priority: Google Maps Geocoding API if key is present
    if (googleApiKey) {
      try {
        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleApiKey}`;
        const gRes = await new Promise((resolve, reject) => {
          https.get(googleUrl, (resp) => {
            let data = '';
            resp.on('data', chunk => data += chunk);
            resp.on('end', () => resolve(data));
          }).on('error', reject);
        });

        const parsedG = JSON.parse(gRes);
        if (parsedG.status === 'OK' && parsedG.results && parsedG.results.length > 0) {
          const firstResult = parsedG.results[0];
          const components = firstResult.address_components || [];

          let houseNo = '';
          let street = '';
          let landmark = '';
          let area = '';
          let city = '';
          let district = '';
          let state = '';
          let rawPincode = '';
          let country = 'India';

          for (const c of components) {
            const types = c.types || [];
            if (types.includes('street_number') || types.includes('premise') || types.includes('subpremise')) {
              houseNo = c.long_name;
            } else if (types.includes('route')) {
              street = c.long_name;
            } else if (types.includes('point_of_interest') || types.includes('establishment')) {
              landmark = c.long_name;
            } else if (types.includes('sublocality_level_2') || types.includes('sublocality_level_3')) {
              if (!landmark) landmark = c.long_name;
            } else if (types.includes('sublocality') || types.includes('sublocality_level_1') || types.includes('neighborhood')) {
              area = c.long_name;
            } else if (types.includes('locality')) {
              city = c.long_name;
            } else if (types.includes('administrative_area_level_2') || types.includes('administrative_area_level_3')) {
              district = c.long_name;
            } else if (types.includes('administrative_area_level_1')) {
              state = c.long_name;
            } else if (types.includes('postal_code')) {
              rawPincode = c.long_name.replace(/\D/g, '').slice(0, 6);
            } else if (types.includes('country')) {
              country = c.long_name;
            }
          }

          if (!city && district) city = district;
          if (!district && city) district = city;

          return res.status(200).json({
            success: true,
            formattedAddress: firstResult.formatted_address || '',
            houseNo,
            street,
            landmark,
            area,
            city,
            district,
            state,
            pincode: rawPincode,
            country,
            coordinates: {
              latitude: Number(latitude),
              longitude: Number(longitude)
            }
          });
        }
      } catch (gErr) {
        console.error('Google Maps Geocoding failed, falling back to OSM:', gErr.message);
      }
    }

    // 2. Fallback to OpenStreetMap Nominatim reverse geocoder
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`;

    const options = {
      headers: {
        'User-Agent': 'LoanManagementSystem/1.0 (digicoders.projects@gmail.com)'
      }
    };

    https.get(url, options, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', async () => {
        try {
          const parsed = JSON.parse(data);
          const addr = parsed.address || {};
          
          // Enhanced extraction for Indian addresses
          const houseNo = addr.house_number || addr.building || addr.amenity || addr.shop || addr.office || '';
          const street = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || '';
          const landmark = addr.neighbourhood || addr.suburb || addr.amenity || addr.commercial || addr.landmark || '';
          const area = addr.suburb || addr.neighbourhood || addr.residential || addr.subdistrict || addr.village || addr.hamlet || '';
          let city = addr.city || addr.town || addr.municipality || addr.city_district || addr.county || '';
          let district = addr.state_district || addr.district || addr.county || city;
          let state = addr.state || '';
          const rawPincode = (addr.postcode || '').replace(/\D/g, '').slice(0, 6);

          // If 6-digit pincode is found, cross-verify with India Post to get official district/state/areas if missing
          let areasList = [];
          if (rawPincode.length === 6 && (!city || !state || !district)) {
            const pinDetails = await fetchPincodeDetails(rawPincode);
            if (pinDetails && pinDetails.success) {
              if (!city) city = pinDetails.city;
              if (!district) district = pinDetails.district;
              if (!state) state = pinDetails.state;
              areasList = pinDetails.areas || [];
            }
          }

          res.status(200).json({
            success: true,
            formattedAddress: parsed.display_name || '',
            houseNo,
            street,
            landmark,
            area,
            city,
            district,
            state,
            pincode: rawPincode,
            areas: areasList,
            country: addr.country || 'India',
            coordinates: {
              latitude: Number(latitude),
              longitude: Number(longitude)
            }
          });
        } catch (err) {
          res.status(200).json({
            success: true,
            formattedAddress: `Lat: ${latitude}, Lng: ${longitude}`,
            coordinates: { latitude: Number(latitude), longitude: Number(longitude) }
          });
        }
      });
    }).on('error', (err) => {
      res.status(200).json({
        success: true,
        formattedAddress: `Lat: ${latitude}, Lng: ${longitude}`,
        coordinates: { latitude: Number(latitude), longitude: Number(longitude) }
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDetailsByPincode,
  reverseGeocode,
};
