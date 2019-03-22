require('dotenv').config();
const request = require('request-promise');

module.exports.geocode = async (address) => {
  const geocoded = await request.get(`https://api.tomtom.com/search/2/geocode/${address.replace(' ', '%20')}.json?key=${process.env.TOMTOM_API_KEY}&limit=1`);
  return JSON.parse(geocoded).results[0].position;
};

module.exports.reverseGeocode = async (lat, long) => {
  const reverseGeocoded = await request.get(`https://api.tomtom.com/search/2/reverseGeocode/${lat},${long}.json?key=${process.env.TOMTOM_API_KEY}&limit=1`);
  return JSON.parse(reverseGeocoded).addresses[0].address.freeformAddress;
};
