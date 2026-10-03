require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Client } = require('pg');

const stationsRoutes = require('./routes/stations');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const frontendDir = path.join(__dirname, '..', 'frontend');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', stationsRoutes);
app.use('/api/admin', adminRoutes);

app.use(express.static(frontendDir));
app.get('/', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
app.get('/station.html', (req, res) => res.sendFile(path.join(frontendDir, 'station.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(frontendDir, 'admin.html')));

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ success: false, message: 'Server error occurred.', error: err.message });
});

async function initDatabase() {
  const isConfigured = process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER;

  if (!isConfigured) {
    console.log('PostgreSQL is not configured. App is running in DEMO DATA mode.');
    return null;
  }

  try {
    const client = new Client({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    await client.connect();
    console.log('Connected to PostgreSQL successfully.');
    app.locals.db = client;
    return client;
  } catch (error) {
    console.warn('PostgreSQL connection failed. Falling back to DEMO DATA mode.');
    console.warn(error.message);
    return null;
  }
}

async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Addis Transport Finder backend running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
