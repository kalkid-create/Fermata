const express = require('express');
const {
  getStations,
  getStationById,
  searchStations,
  searchRoute,
  getRoutes,
  getTransportTypes,
  getNearbyStations,
} = require('../controllers/stationController');

const router = express.Router();

router.get('/search-route', searchRoute);
router.get('/stations', getStations);
router.get('/stations/search', searchStations);
router.get('/stations/nearby', getNearbyStations);
router.get('/stations/:id', getStationById);
router.get('/routes', getRoutes);
router.get('/transport-types', getTransportTypes);

module.exports = router;
