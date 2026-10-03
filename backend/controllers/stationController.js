const demoData = require('../utils/demoData');
const { normalizeText, haversineDistanceKm } = require('../utils/helpers');

function getDbClient(req) {
  const app = req && req.app;
  if (app && app.locals && app.locals.db) return app.locals.db;
  if (global.__FERMATA_DB_CLIENT__) return global.__FERMATA_DB_CLIENT__;
  return null;
}

function getStationTransportTypes(station) {
  if (Array.isArray(station.transport_types) && station.transport_types.length) {
    return station.transport_types;
  }

  return (station.transport_type_ids || [])
    .map((typeId) => (demoData.transportTypes.find((type) => type.id === typeId) || null))
    .filter(Boolean)
    .map((type) => type.name);
}

function getStationRoutes(station) {
  if (Array.isArray(station.routes) && station.routes.length) {
    return station.routes.map((route) => ({
      id: route.id,
      name: route.name,
      origin: route.origin,
      destination: route.destination,
      description: route.description,
    }));
  }

  return (station.route_ids || [])
    .map((routeId) => (demoData.routes.find((route) => route.id === routeId) || null))
    .filter(Boolean)
    .map((route) => ({
      id: route.id,
      name: route.name,
      origin: route.origin,
      destination: route.destination,
      description: route.description,
    }));
}

function serializeStation(station) {
  const routes = getStationRoutes(station);
  const transportTypes = getStationTransportTypes(station);

  return {
    id: station.id,
    name: station.name,
    description: station.description,
    latitude: Number(station.latitude),
    longitude: Number(station.longitude),
    address: station.address,
    transport_types: transportTypes,
    routes,
    destinations: station.destinations || Array.from(new Set(routes.flatMap((route) => [route.origin, route.destination]).filter(Boolean))),
    operating_hours: station.operating_hours || 'Unknown',
    created_at: station.created_at || new Date().toISOString(),
    updated_at: station.updated_at || new Date().toISOString(),
  };
}

async function fetchDatabaseStations(client) {
  const [stationsResult, transportResult, routeResult] = await Promise.all([
    client.query('SELECT * FROM stations ORDER BY id'),
    client.query(`
      SELECT st.station_id, tt.name
      FROM station_transport_types st
      JOIN transport_types tt ON tt.id = st.transport_type_id
      ORDER BY st.station_id, tt.name
    `),
    client.query(`
      SELECT sr.station_id, r.id, r.name, r.origin, r.destination, r.description
      FROM station_routes sr
      JOIN routes r ON r.id = sr.route_id
      ORDER BY sr.station_id, r.id
    `),
  ]);

  const stationsById = new Map();

  stationsResult.rows.forEach((row) => {
    stationsById.set(row.id, {
      id: row.id,
      name: row.name,
      description: row.description,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      address: row.address,
      destinations: [],
      transport_types: [],
      routes: [],
      operating_hours: 'Unknown',
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  });

  transportResult.rows.forEach((row) => {
    const station = stationsById.get(row.station_id);
    if (!station) return;
    if (!station.transport_types.includes(row.name)) station.transport_types.push(row.name);
  });

  routeResult.rows.forEach((row) => {
    const station = stationsById.get(row.station_id);
    if (!station) return;

    station.routes.push({
      id: row.id,
      name: row.name,
      origin: row.origin,
      destination: row.destination,
      description: row.description,
    });

    station.destinations = Array.from(new Set([
      ...station.destinations,
      row.origin,
      row.destination,
    ].filter(Boolean)));
  });

  return Array.from(stationsById.values()).map((station) => serializeStation(station));
}

async function buildStationsList(req) {
  const client = getDbClient(req);

  if (client) {
    try {
      const rows = await fetchDatabaseStations(client);
      return rows;
    } catch (error) {
      console.warn('Failed to load stations from PostgreSQL. Falling back to DEMO DATA.');
      console.warn(error.message);
    }
  }

  return demoData.stations.map((station) => serializeStation(station));
}

function calculateLocationScore(station, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;

  const tokens = [
    station.name,
    station.address,
    ...(station.destinations || []),
    ...(station.routes || []).flatMap((route) => [route.name, route.origin, route.destination]),
  ]
    .filter(Boolean)
    .map((value) => normalizeText(value));

  let score = 0;
  tokens.forEach((text) => {
    if (text.includes(normalizedQuery)) score += 25;
    if (normalizeText(station.name).includes(normalizedQuery)) score += 15;
    if (normalizeText(station.address).includes(normalizedQuery)) score += 10;
  });

  return score;
}

function resolveBestStation(query, stations) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return null;

  const scored = stations
    .map((station) => ({
      station,
      score: calculateLocationScore(station, normalizedQuery),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.station || null;
}

function buildRouteStationList(route) {
  return demoData.stations
    .filter((station) => (station.route_ids || []).includes(route.id))
    .map((station) => ({
      id: station.id,
      name: station.name,
      latitude: Number(station.latitude),
      longitude: Number(station.longitude),
      address: station.address,
      transport_types: getStationTransportTypes(station),
    }));
}

function findRouteOptions(fromQuery, toQuery) {
  const fromText = normalizeText(fromQuery);
  const toText = normalizeText(toQuery);

  if (!fromText || !toText) return [];

  const directMatches = demoData.routes.filter((route) => {
    const routeText = normalizeText(`${route.name} ${route.origin} ${route.destination}`);
    const matchesFrom = routeText.includes(fromText) || normalizeText(route.origin).includes(fromText) || normalizeText(route.destination).includes(fromText);
    const matchesTo = routeText.includes(toText) || normalizeText(route.origin).includes(toText) || normalizeText(route.destination).includes(toText);
    return matchesFrom && matchesTo;
  });

  if (directMatches.length) return directMatches;

  return demoData.routes.filter((route) => {
    const routeText = normalizeText(`${route.name} ${route.origin} ${route.destination}`);
    return routeText.includes(fromText) || routeText.includes(toText);
  });
}

async function getStations(req, res) {
  try {
    const stations = await buildStationsList(req);
    const source = getDbClient(req) ? 'database' : 'demo';
    res.json({
      success: true,
      source,
      data: stations,
      total: stations.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to load stations.', error: error.message });
  }
}

async function getStationById(req, res) {
  const id = Number(req.params.id);
  const stations = await buildStationsList(req);
  const station = stations.find((item) => item.id === id);

  if (!station) {
    return res.status(404).json({ success: false, message: 'Station not found.' });
  }

  return res.json({ success: true, data: station });
}

async function searchStations(req, res) {
  const query = String(req.query.q || '').trim();
  const filterList = (req.query.filters || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const stations = await buildStationsList(req);
  const normalizedQuery = normalizeText(query);

  const result = stations.filter((station) => {
    const stationText = [
      station.name,
      station.address,
      station.description,
      ...station.transport_types,
      ...station.destinations,
      ...station.routes.map((route) => route.name),
      ...station.routes.map((route) => route.origin),
      ...station.routes.map((route) => route.destination),
    ]
      .join(' ')
      .toLowerCase();

    const matchedQuery = !normalizedQuery || stationText.includes(normalizedQuery);
    const matchedFilters =
      filterList.length === 0 ||
      filterList.every((filter) => station.transport_types.some((type) => normalizeText(type).includes(filter)));

    return matchedQuery && matchedFilters;
  });

  res.json({ success: true, data: result, total: result.length });
}

async function searchRoute(req, res) {
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();

  if (!from || !to) {
    return res.status(400).json({
      success: false,
      message: 'Both starting point and destination are required.',
    });
  }

  const stations = await buildStationsList(req);
  const fromStation = resolveBestStation(from, stations) || {
    name: from,
    latitude: null,
    longitude: null,
    address: 'Current location or area',
  };
  const toStation = resolveBestStation(to, stations) || {
    name: to,
    latitude: null,
    longitude: null,
    address: 'Destination area',
  };

  const routeMatches = findRouteOptions(from, to);

  if (!routeMatches.length) {
    return res.json({
      success: true,
      from: {
        label: fromStation.name,
        latitude: fromStation.latitude ?? null,
        longitude: fromStation.longitude ?? null,
        kind: fromStation.latitude ? 'station' : 'area',
      },
      to: {
        label: toStation.name,
        latitude: toStation.latitude ?? null,
        longitude: toStation.longitude ?? null,
        kind: toStation.latitude ? 'station' : 'area',
      },
      routes: [],
      message: "We don't have enough route information for this journey yet.",
    });
  }

  const routes = routeMatches.map((route, index) => {
    const routeStations = buildRouteStationList(route);
    const transportType = routeStations.flatMap((station) => station.transport_types).find(Boolean) || 'Minibus';
    const criteria = index === 0 ? 'More direct' : index === 1 ? 'Fewer transfers' : 'Shorter distance';

    return {
      routeName: route.name,
      transportType,
      criteria,
      stations: routeStations,
      summary: `${route.origin} → ${route.destination}`,
    };
  });

  return res.json({
    success: true,
    from: {
      label: fromStation.name,
      latitude: fromStation.latitude ?? null,
      longitude: fromStation.longitude ?? null,
      kind: fromStation.latitude ? 'station' : 'area',
    },
    to: {
      label: toStation.name,
      latitude: toStation.latitude ?? null,
      longitude: toStation.longitude ?? null,
      kind: toStation.latitude ? 'station' : 'area',
    },
    routes,
    message: null,
  });
}

async function getRoutes(req, res) {
  const client = getDbClient(req);
  if (client) {
    try {
      const result = await client.query('SELECT * FROM routes ORDER BY id');
      return res.json({ success: true, source: 'database', data: result.rows, total: result.rows.length });
    } catch (error) {
      console.warn('Failed to load routes from PostgreSQL. Falling back to DEMO DATA.');
      console.warn(error.message);
    }
  }

  res.json({ success: true, source: 'demo', data: demoData.routes, total: demoData.routes.length });
}

async function getTransportTypes(req, res) {
  const client = getDbClient(req);
  if (client) {
    try {
      const result = await client.query('SELECT * FROM transport_types ORDER BY id');
      return res.json({ success: true, source: 'database', data: result.rows, total: result.rows.length });
    } catch (error) {
      console.warn('Failed to load transport types from PostgreSQL. Falling back to DEMO DATA.');
      console.warn(error.message);
    }
  }

  res.json({ success: true, source: 'demo', data: demoData.transportTypes, total: demoData.transportTypes.length });
}

async function getNearbyStations(req, res) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!lat || !lng || Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });
  }

  const stations = (await buildStationsList(req)).map((station) => ({
    ...station,
    distance_km: haversineDistanceKm(lat, lng, station.latitude, station.longitude),
  }));

  stations.sort((a, b) => a.distance_km - b.distance_km);

  return res.json({ success: true, data: stations, total: stations.length });
}

module.exports = {
  getStations,
  getStationById,
  searchStations,
  searchRoute,
  getRoutes,
  getTransportTypes,
  getNearbyStations,
};
