require('dotenv').config({
  path: require('path').join(__dirname, '.env')
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

const stationsRoutes = require('./routes/stations');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = Number(process.env.PORT || 5000);

/* =========================================================
   FIND FRONTEND DIRECTORY
   ========================================================= */

const possibleFrontendPaths = [
  path.join(__dirname, '..', 'frontend'),
  path.join(process.cwd(), 'frontend'),
  path.join('/app', 'frontend')
];

const frontendDir =
  possibleFrontendPaths.find((dir) => fs.existsSync(dir)) ||
  path.join(__dirname, '..', 'frontend');

console.log('Frontend directory:', frontendDir);
console.log(
  'Frontend index exists:',
  fs.existsSync(path.join(frontendDir, 'index.html'))
);

/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(cors());

app.use(express.json({ limit: '1mb' }));

app.use(express.urlencoded({ extended: true }));

/* =========================================================
   API ROUTES
   ========================================================= */

app.use('/api', stationsRoutes);

app.use('/api/admin', adminRoutes);

/* =========================================================
   FRONTEND STATIC FILES
   ========================================================= */

app.use(express.static(frontendDir));

/* =========================================================
   FRONTEND PAGES
   ========================================================= */

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.get('/station.html', (req, res) => {
  res.sendFile(path.join(frontendDir, 'station.html'));
});

app.get('/stations.html', (req, res) => {
  res.sendFile(path.join(frontendDir, 'stations.html'));
});

app.get('/routes.html', (req, res) => {
  res.sendFile(path.join(frontendDir, 'routes.html'));
});

app.get('/about.html', (req, res) => {
  res.sendFile(path.join(frontendDir, 'about.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(frontendDir, 'admin.html'));
});

/* =========================================================
   ERROR HANDLER
   ========================================================= */

app.use((err, req, res, next) => {
  console.error('Server Error:', err);

  res.status(500).json({
    success: false,
    message: 'Server error occurred.',
    error: err.message
  });
});

/* =========================================================
   DATABASE CONNECTION
   ========================================================= */

async function initDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log(
      'DATABASE_URL is missing. App is running in DEMO DATA mode.'
    );

    return null;
  }

  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    await client.connect();

    console.log('✅ Connected to Neon PostgreSQL successfully.');

    app.locals.db = client;

    return client;
  } catch (error) {
    console.warn(
      '❌ Neon PostgreSQL connection failed.'
    );

    console.warn(error.message);

    return null;
  }
}

/* =========================================================
   START SERVER
   ========================================================= */

async function startServer() {
  await initDatabase();

  app.listen(PORT, () => {
    console.log(
      `Addis Transport Finder backend running on http://localhost:${PORT}`
    );
  });
}

/* =========================================================
   START ONLY WHEN RUN DIRECTLY
   ========================================================= */

if (require.main === module) {
  startServer();
}

module.exports = app;
