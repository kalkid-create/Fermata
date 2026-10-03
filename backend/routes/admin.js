const express = require('express');
const {
  listStations,
  createStation,
  updateStation,
  deleteStation,
  listRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  listTransportTypes,
  assignStationTransportTypes,
  assignStationRoutes,
} = require('../controllers/adminController');
const { adminLogin, requireAdmin } = require('../middleware/adminAuth');

const router = express.Router();

router.post('/login', adminLogin);
router.use(requireAdmin);

router.get('/stations', listStations);
router.post('/stations', createStation);
router.put('/stations/:id', updateStation);
router.delete('/stations/:id', deleteStation);

router.get('/routes', listRoutes);
router.post('/routes', createRoute);
router.put('/routes/:id', updateRoute);
router.delete('/routes/:id', deleteRoute);

router.get('/transport-types', listTransportTypes);
router.put('/stations/:id/transport-types', assignStationTransportTypes);
router.put('/stations/:id/routes', assignStationRoutes);

module.exports = router;
