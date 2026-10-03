const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
const { getStations } = require('../controllers/stationController');

async function getJson(path) {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const result = await response.json();
    return { response, result };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('controller prefers database rows when PostgreSQL is connected', async () => {
  app.locals.db = {
    query: async (sql, params) => {
      if (sql.includes('FROM stations')) {
        return { rows: [{ id: 99, name: 'DB Station', description: 'DB data', latitude: 8.9, longitude: 38.7, address: 'DB area', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] };
      }
      if (sql.includes('station_transport_types')) {
        return { rows: [{ station_id: 99, name: 'Bus' }] };
      }
      if (sql.includes('station_routes')) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const payload = await new Promise((resolve) => {
    const req = {
      app: {
        locals: { db: app.locals.db },
      },
    };
    const res = {
      json: (value) => resolve(value),
      status: () => ({ json: resolve }),
    };

    getStations(req, res);
  });

  assert.equal(payload.source, 'database');
  assert.equal(payload.data[0].name, 'DB Station');
  app.locals.db = null;
});

test('GET /api/stations returns a successful response with station data', async () => {
  const { response, result } = await getJson('/api/stations');

  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.ok(Array.isArray(result.data));
  assert.ok(result.data.length > 0);
});

test('GET /api/stations/search returns matches for a known area', async () => {
  const { response, result } = await getJson('/api/stations/search?q=Bole');

  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.ok(result.data.some((station) => station.name.toLowerCase().includes('bole') || station.address.toLowerCase().includes('bole')));
});

test('GET /api/search-route returns route recommendations for a simple A to B trip', async () => {
  const { response, result } = await getJson('/api/search-route?from=Bole&to=Piazza');

  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.ok(result.from && result.to);
  assert.ok(Array.isArray(result.routes));
  assert.ok(result.routes.length > 0);
  assert.ok(result.routes.some((route) => route.routeName.toLowerCase().includes('bole') || route.stations.some((station) => station.name.toLowerCase().includes('bole'))));
});
