const demoData = require('../utils/demoData');
const {
  normalizeText,
  haversineDistanceKm
} = require('../utils/helpers');

/*
|--------------------------------------------------------------------------
| DATABASE HELPER
|--------------------------------------------------------------------------
*/

function getDbClient(req) {
  const app = req && req.app;

  if (app && app.locals && app.locals.db) {
    return app.locals.db;
  }

  if (global.__FERMATA_DB_CLIENT__) {
    return global.__FERMATA_DB_CLIENT__;
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| TEXT / LOCATION HELPERS
|--------------------------------------------------------------------------
*/

function normalizeLocationText(value) {
  let text = normalizeText(String(value || ''));

  text = text
    .replace(/\bpiazza\b/g, 'piassa')
    .replace(/\bpiassa\b/g, 'piassa');

  return text.trim();
}

function locationMatches(query, value) {
  const q = normalizeLocationText(query);
  const v = normalizeLocationText(value);

  if (!q || !v) return false;

  if (q === v) return true;
  if (v.includes(q)) return true;
  if (q.includes(v)) return true;

  return false;
}

/*
|--------------------------------------------------------------------------
| DATABASE STATION LOADING
|--------------------------------------------------------------------------
*/

async function fetchDatabaseStations(client) {
  const stationResult = await client.query(`
    SELECT *
    FROM stations
    ORDER BY id
  `);

  const transportResult = await client.query(`
    SELECT
      stt.station_id,
      tt.name
    FROM station_transport_types stt
    JOIN transport_types tt
      ON tt.id = stt.transport_type_id
    ORDER BY stt.station_id, tt.name
  `);

  const routeResult = await client.query(`
    SELECT
      sr.station_id,
      r.id,
      r.name,
      r.origin,
      r.destination,
      r.description
    FROM station_routes sr
    JOIN routes r
      ON r.id = sr.route_id
    ORDER BY sr.station_id, r.id
  `);

  const transportMap = new Map();
  const routeMap = new Map();

  for (const row of transportResult.rows) {
    if (!transportMap.has(row.station_id)) {
      transportMap.set(row.station_id, []);
    }

    transportMap.get(row.station_id).push(row.name);
  }

  for (const row of routeResult.rows) {
    if (!routeMap.has(row.station_id)) {
      routeMap.set(row.station_id, []);
    }

    routeMap.get(row.station_id).push({
      id: row.id,
      name: row.name,
      origin: row.origin,
      destination: row.destination,
      description: row.description
    });
  }

  return stationResult.rows.map((station) => ({
    ...station,

    latitude:
      station.latitude !== null
        ? Number(station.latitude)
        : null,

    longitude:
      station.longitude !== null
        ? Number(station.longitude)
        : null,

    transport_types:
      transportMap.get(station.id) || [],

    routes:
      routeMap.get(station.id) || [],

    destinations: [
      ...new Set(
        (routeMap.get(station.id) || [])
          .flatMap((route) => [
            route.origin,
            route.destination
          ])
          .filter(Boolean)
      )
    ]
  }));
}

/*
|--------------------------------------------------------------------------
| STATION LIST
|--------------------------------------------------------------------------
*/

async function buildStationsList(req) {
  const client = getDbClient(req);

  if (client) {
    try {
      return await fetchDatabaseStations(client);
    } catch (error) {
      console.warn(
        'Failed to load stations from PostgreSQL. Falling back to DEMO DATA.'
      );
      console.warn(error.message);
    }
  }

  return demoData.stations;
}

/*
|--------------------------------------------------------------------------
| TRANSPORT TYPE HELPER
|--------------------------------------------------------------------------
*/

function getStationTransportTypes(station) {
  if (Array.isArray(station.transport_types)) {
    return station.transport_types;
  }

  if (Array.isArray(station.transportTypes)) {
    return station.transportTypes;
  }

  return [];
}

/*
|--------------------------------------------------------------------------
| STATION SEARCH
|--------------------------------------------------------------------------
*/

function calculateLocationScore(station, query) {
  const normalizedQuery =
    normalizeLocationText(query);

  if (!normalizedQuery) {
    return 0;
  }

  const stationName =
    normalizeLocationText(station.name);

  const stationAddress =
    normalizeLocationText(station.address);

  let score = 0;

  if (stationName === normalizedQuery) {
    score += 1000;
  } else if (stationName.includes(normalizedQuery)) {
    score += 800;
  } else if (normalizedQuery.includes(stationName)) {
    score += 700;
  }

  if (stationAddress === normalizedQuery) {
    score += 500;
  } else if (stationAddress.includes(normalizedQuery)) {
    score += 350;
  } else if (
    normalizedQuery.includes(stationAddress)
  ) {
    score += 300;
  }

  const destinations =
    Array.isArray(station.destinations)
      ? station.destinations
      : [];

  for (const destination of destinations) {
    if (
      locationMatches(
        normalizedQuery,
        destination
      )
    ) {
      score += 50;
    }
  }

  const routes =
    Array.isArray(station.routes)
      ? station.routes
      : [];

  for (const route of routes) {
    if (
      locationMatches(
        normalizedQuery,
        route.origin
      )
    ) {
      score += 30;
    }

    if (
      locationMatches(
        normalizedQuery,
        route.destination
      )
    ) {
      score += 30;
    }

    if (
      locationMatches(
        normalizedQuery,
        route.name
      )
    ) {
      score += 20;
    }
  }

  return score;
}

function resolveBestStation(query, stations) {
  const normalizedQuery =
    normalizeLocationText(query);

  if (!normalizedQuery) {
    return null;
  }

  const scored = stations
    .map((station) => ({
      station,
      score:
        calculateLocationScore(
          station,
          normalizedQuery
        )
    }))
    .filter(
      (item) => item.score > 0
    )
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        Number(a.station.id || 0) -
        Number(b.station.id || 0)
      );
    });

  return scored.length
    ? scored[0].station
    : null;
}

/*
|--------------------------------------------------------------------------
| ROUTE LOADING
|--------------------------------------------------------------------------
*/

async function fetchDatabaseRoutes(client) {
  const result = await client.query(`
    SELECT *
    FROM routes
    ORDER BY id
  `);

  return result.rows;
}

async function buildRoutesList(req) {
  const client = getDbClient(req);

  if (client) {
    try {
      return await fetchDatabaseRoutes(client);
    } catch (error) {
      console.warn(
        'Failed to load routes from PostgreSQL. Falling back to DEMO DATA.'
      );
      console.warn(error.message);
    }
  }

  return demoData.routes;
}

/*
|--------------------------------------------------------------------------
| ROUTE / STATION MATCHING
|--------------------------------------------------------------------------
*/

function stationBelongsToRoute(station, route) {
  const stationRoutes =
    Array.isArray(station.routes)
      ? station.routes
      : [];

  return stationRoutes.some(
    (stationRoute) =>
      Number(stationRoute.id) ===
      Number(route.id)
  );
}

function buildRouteStationList(
  route,
  stations
) {
  return stations
    .filter((station) =>
      stationBelongsToRoute(
        station,
        route
      )
    )
    .map((station) => ({
      id: station.id,
      name: station.name,

      latitude:
        station.latitude !== null &&
        station.latitude !== undefined
          ? Number(station.latitude)
          : null,

      longitude:
        station.longitude !== null &&
        station.longitude !== undefined
          ? Number(station.longitude)
          : null,

      address: station.address,

      transport_types:
        getStationTransportTypes(station)
    }));
}

/*
|--------------------------------------------------------------------------
| FIND ROUTES
|--------------------------------------------------------------------------
*/

function findRouteOptions(
  fromQuery,
  toQuery,
  routes,
  stations
) {
  const fromText =
    normalizeLocationText(fromQuery);

  const toText =
    normalizeLocationText(toQuery);

  if (!fromText || !toText) {
    return [];
  }

  const matchingRoutes =
    routes.filter((route) => {
      const routeStations =
        stations.filter((station) =>
          stationBelongsToRoute(
            station,
            route
          )
        );

      const fromStationMatch =
        routeStations.some((station) =>
          locationMatches(
            fromText,
            station.name
          ) ||
          locationMatches(
            fromText,
            station.address
          )
        );

      const toStationMatch =
        routeStations.some((station) =>
          locationMatches(
            toText,
            station.name
          ) ||
          locationMatches(
            toText,
            station.address
          )
        );

      const fromRouteMatch =
        locationMatches(
          fromText,
          route.origin
        );

      const toRouteMatch =
        locationMatches(
          toText,
          route.destination
        );

      return (
        (fromStationMatch &&
          toStationMatch) ||

        (fromStationMatch &&
          toRouteMatch) ||

        (fromRouteMatch &&
          toStationMatch) ||

        (fromRouteMatch &&
          toRouteMatch)
      );
    });

  return matchingRoutes;
}

/*
|--------------------------------------------------------------------------
| GET ALL STATIONS
|--------------------------------------------------------------------------
*/

async function getStations(req, res) {
  const client = getDbClient(req);

  if (client) {
    try {
      const stations =
        await fetchDatabaseStations(client);

      return res.json({
        success: true,
        source: 'database',
        data: stations,
        total: stations.length
      });
    } catch (error) {
      console.warn(
        'Failed to load stations from PostgreSQL. Falling back to DEMO DATA.'
      );

      console.warn(error.message);
    }
  }

  return res.json({
    success: true,
    source: 'demo',
    data: demoData.stations,
    total: demoData.stations.length
  });
}

/*
|--------------------------------------------------------------------------
| GET SINGLE STATION
|--------------------------------------------------------------------------
*/

async function getStationById(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid station ID.'
    });
  }

  const stations =
    await buildStationsList(req);

  const station =
    stations.find(
      (item) =>
        Number(item.id) === id
    );

  if (!station) {
    return res.status(404).json({
      success: false,
      message: 'Station not found.'
    });
  }

  return res.json({
    success: true,
    data: station
  });
}

/*
|--------------------------------------------------------------------------
| SEARCH STATIONS
|--------------------------------------------------------------------------
*/

async function searchStations(req, res) {
  const query = String(
    req.query.q ||
    req.query.search ||
    req.query.query ||
    ''
  ).trim();

  if (!query) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required.'
    });
  }

  const stations =
    await buildStationsList(req);

  const normalizedQuery =
    normalizeLocationText(query);

  const results = stations
    .map((station) => ({
      station,

      score:
        calculateLocationScore(
          station,
          normalizedQuery
        )
    }))
    .filter(
      (item) =>
        item.score > 0
    )
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .map(
      (item) =>
        item.station
    );

  return res.json({
    success: true,
    data: results,
    total: results.length
  });
}

/*
|--------------------------------------------------------------------------
| SEARCH ROUTE
|--------------------------------------------------------------------------
*/

async function searchRoute(req, res) {
  const from =
    String(
      req.query.from || ''
    ).trim();

  const to =
    String(
      req.query.to || ''
    ).trim();

  if (!from || !to) {
    return res.status(400).json({
      success: false,
      message:
        'Both starting point and destination are required.'
    });
  }

  const stations =
    await buildStationsList(req);

  const routes =
    await buildRoutesList(req);

  const fromStation =
    resolveBestStation(
      from,
      stations
    ) || {
      name: from,
      latitude: null,
      longitude: null,
      address:
        'Current location or area',
      transport_types: [],
      routes: [],
      destinations: []
    };

  const toStation =
    resolveBestStation(
      to,
      stations
    ) || {
      name: to,
      latitude: null,
      longitude: null,
      address:
        'Destination area',
      transport_types: [],
      routes: [],
      destinations: []
    };

  const routeMatches =
    findRouteOptions(
      from,
      to,
      routes,
      stations
    );

  if (!routeMatches.length) {
    return res.json({
      success: true,

      from: {
        label: fromStation.name,
        latitude:
          fromStation.latitude ?? null,
        longitude:
          fromStation.longitude ?? null,
        kind:
          fromStation.latitude !== null &&
          fromStation.latitude !== undefined
            ? 'station'
            : 'area'
      },

      to: {
        label: toStation.name,
        latitude:
          toStation.latitude ?? null,
        longitude:
          toStation.longitude ?? null,
        kind:
          toStation.latitude !== null &&
          toStation.latitude !== undefined
            ? 'station'
            : 'area'
      },

      routes: [],

      message:
        "We don't have enough route information for this journey yet."
    });
  }

  const resultRoutes =
    routeMatches.map(
      (route, index) => {
        const routeStations =
          buildRouteStationList(
            route,
            stations
          );

        const transportType =
          routeStations
            .flatMap(
              (station) =>
                station.transport_types ||
                []
            )
            .find(Boolean) ||
          'Minibus';

        let criteria =
          'More direct';

        if (index === 1) {
          criteria =
            'Fewer transfers';
        } else if (index >= 2) {
          criteria =
            'Shorter distance';
        }

        return {
          routeName:
            route.name ||
            `${route.origin} → ${route.destination}`,

          transportType,

          criteria,

          stations:
            routeStations,

          summary:
            `${route.origin} → ${route.destination}`,

          origin:
            route.origin,

          destination:
            route.destination,

          description:
            route.description || null
        };
      }
    );

  return res.json({
    success: true,

    from: {
      label: fromStation.name,
      latitude:
        fromStation.latitude ?? null,
      longitude:
        fromStation.longitude ?? null,
      kind:
        fromStation.latitude !== null &&
        fromStation.latitude !== undefined
          ? 'station'
          : 'area'
    },

    to: {
      label: toStation.name,
      latitude:
        toStation.latitude ?? null,
      longitude:
        toStation.longitude ?? null,
      kind:
        toStation.latitude !== null &&
        toStation.latitude !== undefined
          ? 'station'
          : 'area'
    },

    routes: resultRoutes,

    message: null
  });
}

/*
|--------------------------------------------------------------------------
| GET ALL ROUTES
|--------------------------------------------------------------------------
*/

async function getRoutes(req, res) {
  const client =
    getDbClient(req);

  if (client) {
    try {
      const result =
        await client.query(`
          SELECT *
          FROM routes
          ORDER BY id
        `);

      return res.json({
        success: true,
        source: 'database',
        data: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.warn(
        'Failed to load routes from PostgreSQL. Falling back to DEMO DATA.'
      );

      console.warn(error.message);
    }
  }

  return res.json({
    success: true,
    source: 'demo',
    data: demoData.routes,
    total:
      demoData.routes.length
  });
}

/*
|--------------------------------------------------------------------------
| GET TRANSPORT TYPES
|--------------------------------------------------------------------------
*/

async function getTransportTypes(
  req,
  res
) {
  const client =
    getDbClient(req);

  if (client) {
    try {
      const result =
        await client.query(`
          SELECT *
          FROM transport_types
          ORDER BY id
        `);

      return res.json({
        success: true,
        source: 'database',
        data: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.warn(
        'Failed to load transport types from PostgreSQL. Falling back to DEMO DATA.'
      );

      console.warn(error.message);
    }
  }

  return res.json({
    success: true,
    source: 'demo',
    data:
      demoData.transport_types || [],
    total:
      (demoData.transport_types || [])
        .length
  });
}

/*
|--------------------------------------------------------------------------
| NEARBY STATIONS
|--------------------------------------------------------------------------
*/

async function getNearbyStations(
  req,
  res
) {
  const latitude = Number(
    req.query.latitude ??
    req.query.lat
  );

  const longitude = Number(
    req.query.longitude ??
    req.query.lng ??
    req.query.lon
  );

  const radiusKm = Number(
    req.query.radiusKm ??
    req.query.radius ??
    5
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Valid latitude and longitude are required.'
    });
  }

  const stations =
    await buildStationsList(req);

  const results = stations
    .filter(
      (station) =>
        Number.isFinite(
          Number(station.latitude)
        ) &&
        Number.isFinite(
          Number(station.longitude)
        )
    )
    .map((station) => ({
      ...station,

      distance_km:
        haversineDistanceKm(
          latitude,
          longitude,
          Number(station.latitude),
          Number(station.longitude)
        )
    }))
    .filter(
      (station) =>
        station.distance_km <= radiusKm
    )
    .sort(
      (a, b) =>
        a.distance_km -
        b.distance_km
    );

  return res.json({
    success: true,
    data: results,
    total: results.length
  });
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  getStations,
  getStationById,
  searchStations,
  searchRoute,
  getRoutes,
  getTransportTypes,
  getNearbyStations
};