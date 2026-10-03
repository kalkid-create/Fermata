# Addis Transport Finder

Addis Transport Finder is a full-stack web application for discovering transport stations around Addis Ababa, Ethiopia. It is designed as a portfolio-friendly, beginner-friendly project that shows how a station-finder UI, mapping layer, and REST API can work together.

## Purpose

This project is not a live GPS vehicle tracking system. Instead, it helps people:

- find transport stations by name or destination
- filter stations by transport type
- explore station details and available routes
- view stations on an interactive map
- search nearby stations using approximate browser location
- manage station and route data from a simple admin dashboard

The code is structured so verified real-world station data can replace the demo dataset later without rewriting the app architecture.

## Features

- Responsive home page with landing hero, search bar, filters, and map
- Interactive Leaflet map centered on Addis Ababa
- Station popups with route information and action buttons
- Search by station name, destination, route, or transport type
- Filter by Minibus, Bus, Taxi, and Other
- Station detail page with coordinates and route information
- "Use my location" button for nearby station discovery
- Directions links using Google Maps
- Admin dashboard with login, station CRUD, route CRUD, and assignment forms
- PostgreSQL-ready backend with REST API endpoints
- Demo data clearly labeled as DEMO DATA

## Technologies

- Frontend: HTML5, CSS3, JavaScript
- Mapping: Leaflet.js + OpenStreetMap
- Backend: Node.js + Express.js
- Database: PostgreSQL
- API: REST API

## Project structure

```text
addis-transport-finder/
├── frontend/
│   ├── index.html
│   ├── station.html
│   ├── admin.html
│   ├── css/
│   │   ├── style.css
│   │   ├── station.css
│   │   └── admin.css
│   └── js/
│       ├── app.js
│       ├── map.js
│       ├── stations.js
│       └── admin.js
│
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   ├── db/
│   │   └── database.sql
│   ├── routes/
│   │   ├── stations.js
│   │   └── admin.js
│   ├── controllers/
│   │   ├── stationController.js
│   │   └── adminController.js
│   ├── middleware/
│   │   └── adminAuth.js
│   ├── utils/
│   │   ├── demoData.js
│   │   └── helpers.js
│   └── tests/
│       └── app.test.js
│
├── .gitignore
├── README.md
└── .env.example (optional root-level example if desired)
```

## PostgreSQL setup

1. Install PostgreSQL.
2. Create a database named `addis_transport_finder` (or choose another name).
3. Update the environment variables in the backend `.env` file.
4. Run the SQL schema in `backend/db/database.sql`.

Example:

```bash
createdb addis_transport_finder
psql -d addis_transport_finder -f backend/db/database.sql
```

## Environment variables

Create a backend `.env` file by copying `.env.example`.

```bash
cp backend/.env.example backend/.env
```

Required variables:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=addis_transport_finder
DB_USER=postgres
DB_PASSWORD=your_password
PORT=5000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ChangeMe123!
```

Important:

- Never commit `.env` files to Git.
- Never expose database credentials in frontend JavaScript.
- The demo admin login is only for local testing and demonstration.

## Installation

```bash
cd addis-transport-finder/backend
npm install
```

## Running the backend

Development mode:

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

The app will serve the frontend on the same port as the backend by default. For example:

- Home: http://localhost:5000/
- Station page: http://localhost:5000/station.html?id=1
- Admin: http://localhost:5000/admin.html

## Running the frontend

The frontend is served from the Express backend, so no separate frontend dev server is required for local development.

If you want to host the static frontend separately, you can point the browser to the generated HTML files in `frontend/` and set the API base URL in the browser console or a small config script.

## REST API endpoints

Base URL: `http://localhost:5000/api`

- `GET /api/stations` — get all stations
- `GET /api/stations/:id` — get a specific station
- `GET /api/stations/search?q=...` — search station data
- `GET /api/stations/nearby?lat=...&lng=...` — nearby stations by distance
- `GET /api/routes` — list all routes
- `GET /api/transport-types` — list transport types
- `POST /api/admin/login` — demo admin login
- `GET /api/admin/stations` — list stations in admin dashboard
- `POST /api/admin/stations` — create a station
- `PUT /api/admin/stations/:id` — update a station
- `DELETE /api/admin/stations/:id` — delete a station
- `POST /api/admin/routes` — create a route
- `PUT /api/admin/routes/:id` — update a route
- `DELETE /api/admin/routes/:id` — delete a route

## How to add station data

1. Use the admin dashboard login page.
2. Add or edit station data through the dashboard.
3. Assign transport types and routes to stations.
4. Save the changes.
5. Replace the demo data later with verified real-world station records from a trusted source.

## Demo data notice

The app ships with DEMO DATA only. These sample stations are placeholder records for UI testing and development. They are clearly marked as demo entries in the SQL schema and backend data. The code is prepared so real station records can be inserted later without changing the overall structure.

## Deployment considerations

This project is structured to be deployable as:

- Frontend: Netlify or static hosting
- Backend: Render, Railway, or another Node.js host
- Database: managed PostgreSQL service

For production:

- use real, rotated secrets instead of demo credentials
- validate all inputs server-side
- keep `.env` values on the backend host only
- use HTTPS
- secure admin authentication with a production-grade auth system

## Local demo account

For local testing, the admin login defaults to:

- username: `admin`
- password: `ChangeMe123!`

These credentials are only used server-side and are intentionally shown here for the demo environment.
