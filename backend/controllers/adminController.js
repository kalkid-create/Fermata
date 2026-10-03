const demoData = require('../utils/demoData');
const { normalizeText } = require('../utils/helpers');

function serializeRoute(route) {
  return {
    id: route.id,
    name: route.name,
    origin: route.origin,
    destination: route.destination,
    description: route.description,
  };
}

function serializeStation(station) {
  return {
    id: station.id,
    name: station.name,
    description: station.description,
    latitude: Number(station.latitude),
    longitude: Number(station.longitude),
    address: station.address,
    transport_type_ids: station.transport_type_ids || [],
    route_ids: station.route_ids || [],
    destinations: station.destinations || [],
    operating_hours: station.operating_hours || 'Unknown',
  };
}

function validateStationPayload(payload) {
  if (!payload.name || !payload.address || payload.latitude === undefined || payload.longitude === undefined) {
    return 'Name, address, latitude, and longitude are required.';
  }

  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);

  if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
    return 'Latitude must be between -90 and 90.';
  }

  if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
    return 'Longitude must be between -180 and 180.';
  }

  return null;
}

function listStations(req, res) {
  res.json({ success: true, data: demoData.stations.map(serializeStation), total: demoData.stations.length });
}

function createStation(req, res) {
  const validationError = validateStationPayload(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const newId = Math.max(...demoData.stations.map((station) => station.id), 0) + 1;
  const station = {
    id: newId,
    name: req.body.name,
    description: req.body.description || 'DEMO DATA: added from admin dashboard.',
    latitude: Number(req.body.latitude),
    longitude: Number(req.body.longitude),
    address: req.body.address,
    transport_type_ids: Array.isArray(req.body.transport_type_ids) ? req.body.transport_type_ids : [],
    route_ids: Array.isArray(req.body.route_ids) ? req.body.route_ids : [],
    destinations: Array.isArray(req.body.destinations) ? req.body.destinations : [],
    operating_hours: req.body.operating_hours || 'Unknown',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  demoData.stations.push(station);
  return res.status(201).json({ success: true, data: serializeStation(station) });
}

function updateStation(req, res) {
  const stationId = Number(req.params.id);
  const index = demoData.stations.findIndex((station) => station.id === stationId);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Station not found.' });
  }

  const validationError = validateStationPayload(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const station = demoData.stations[index];
  demoData.stations[index] = {
    ...station,
    name: req.body.name || station.name,
    description: req.body.description || station.description,
    latitude: Number(req.body.latitude ?? station.latitude),
    longitude: Number(req.body.longitude ?? station.longitude),
    address: req.body.address || station.address,
    transport_type_ids: Array.isArray(req.body.transport_type_ids) ? req.body.transport_type_ids : station.transport_type_ids,
    route_ids: Array.isArray(req.body.route_ids) ? req.body.route_ids : station.route_ids,
    destinations: Array.isArray(req.body.destinations) ? req.body.destinations : station.destinations,
    operating_hours: req.body.operating_hours || station.operating_hours,
    updated_at: new Date().toISOString(),
  };

  return res.json({ success: true, data: serializeStation(demoData.stations[index]) });
}

function deleteStation(req, res) {
  const stationId = Number(req.params.id);
  const startLength = demoData.stations.length;
  demoData.stations = demoData.stations.filter((station) => station.id !== stationId);

  if (demoData.stations.length === startLength) {
    return res.status(404).json({ success: false, message: 'Station not found.' });
  }

  return res.json({ success: true, message: `Station ${stationId} deleted.` });
}

function listRoutes(req, res) {
  res.json({ success: true, data: demoData.routes.map(serializeRoute), total: demoData.routes.length });
}

function createRoute(req, res) {
  const { name, origin, destination, description } = req.body || {};

  if (!name || !origin || !destination) {
    return res.status(400).json({ success: false, message: 'Route name, origin, and destination are required.' });
  }

  const newId = Math.max(...demoData.routes.map((route) => route.id), 0) + 1;
  const route = {
    id: newId,
    name,
    origin,
    destination,
    description: description || 'DEMO DATA route.',
  };

  demoData.routes.push(route);
  return res.status(201).json({ success: true, data: serializeRoute(route) });
}

function updateRoute(req, res) {
  const routeId = Number(req.params.id);
  const index = demoData.routes.findIndex((route) => route.id === routeId);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Route not found.' });
  }

  const { name, origin, destination, description } = req.body || {};
  if (!name || !origin || !destination) {
    return res.status(400).json({ success: false, message: 'Route name, origin, and destination are required.' });
  }

  demoData.routes[index] = {
    ...demoData.routes[index],
    name,
    origin,
    destination,
    description: description || demoData.routes[index].description,
  };

  return res.json({ success: true, data: serializeRoute(demoData.routes[index]) });
}

function deleteRoute(req, res) {
  const routeId = Number(req.params.id);
  const startLength = demoData.routes.length;
  demoData.routes = demoData.routes.filter((route) => route.id !== routeId);

  if (demoData.routes.length === startLength) {
    return res.status(404).json({ success: false, message: 'Route not found.' });
  }

  demoData.stations = demoData.stations.map((station) => ({
    ...station,
    route_ids: (station.route_ids || []).filter((id) => id !== routeId),
  }));

  return res.json({ success: true, message: `Route ${routeId} deleted.` });
}

function listTransportTypes(req, res) {
  res.json({ success: true, data: demoData.transportTypes, total: demoData.transportTypes.length });
}

function assignStationTransportTypes(req, res) {
  const stationId = Number(req.params.id);
  const station = demoData.stations.find((item) => item.id === stationId);

  if (!station) {
    return res.status(404).json({ success: false, message: 'Station not found.' });
  }

  const typeIds = Array.isArray(req.body.transport_type_ids) ? req.body.transport_type_ids.map(Number) : [];
  station.transport_type_ids = [...new Set(typeIds)];

  return res.json({ success: true, data: serializeStation(station) });
}

function assignStationRoutes(req, res) {
  const stationId = Number(req.params.id);
  const station = demoData.stations.find((item) => item.id === stationId);

  if (!station) {
    return res.status(404).json({ success: false, message: 'Station not found.' });
  }

  const routeIds = Array.isArray(req.body.route_ids) ? req.body.route_ids.map(Number) : [];
  station.route_ids = [...new Set(routeIds)];

  return res.json({ success: true, data: serializeStation(station) });
}

module.exports = {
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
};
