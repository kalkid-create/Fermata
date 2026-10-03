-- DEMO DATA ONLY: this schema is set up to support future real-world data replacement.
-- The sample rows below intentionally identify themselves as DEMO DATA.

CREATE TABLE IF NOT EXISTS stations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transport_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS routes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  origin VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS station_transport_types (
  station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  transport_type_id INTEGER NOT NULL REFERENCES transport_types(id) ON DELETE CASCADE,
  PRIMARY KEY (station_id, transport_type_id)
);

CREATE TABLE IF NOT EXISTS station_routes (
  station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  PRIMARY KEY (station_id, route_id)
);

INSERT INTO transport_types (name) VALUES
  ('Minibus'),
  ('Bus'),
  ('Taxi'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

INSERT INTO stations (name, description, latitude, longitude, address)
VALUES
  ('Bole Lemi Transport Hub', 'DEMO DATA: sample station for UI testing and local development. Replace with verified station data later.', 8.9953, 38.7995, 'Bole Lemi, Addis Ababa'),
  ('Megenagna Station', 'DEMO DATA: sample station for UI testing and local development. Replace with verified station data later.', 9.0274, 38.7952, 'Megenagna, Addis Ababa'),
  ('Mexico Roundabout', 'DEMO DATA: sample station for UI testing and local development. Replace with verified station data later.', 9.0189, 38.7608, 'Mexico, Addis Ababa'),
  ('Meskel Square', 'DEMO DATA: sample station for UI testing and local development. Replace with verified station data later.', 9.0105, 38.7624, 'Meskel Square, Addis Ababa'),
  ('Saris Transport Stop', 'DEMO DATA: sample station for UI testing and local development. Replace with verified station data later.', 8.9802, 38.7911, 'Saris, Addis Ababa'),
  ('Piassa Central Station', 'DEMO DATA: sample station for UI testing and local development. Replace with verified station data later.', 9.0337, 38.7562, 'Piassa, Addis Ababa')
ON CONFLICT DO NOTHING;

INSERT INTO routes (name, origin, destination, description)
VALUES
  ('Bole to Piazza', 'Bole', 'Piazza', 'DEMO DATA: sample route only.'),
  ('Megenagna to Saris', 'Megenagna', 'Saris', 'DEMO DATA: sample route only.'),
  ('Meskel Square to Mexico', 'Meskel Square', 'Mexico', 'DEMO DATA: sample route only.'),
  ('Kebena to Bole', 'Kebena', 'Bole', 'DEMO DATA: sample route only.'),
  ('Woreda 8 to Piassa', 'Woreda 8', 'Piassa', 'DEMO DATA: sample route only.')
ON CONFLICT DO NOTHING;

-- Link sample station attributes for demo use.
INSERT INTO station_transport_types (station_id, transport_type_id)
SELECT s.id, tt.id
FROM stations s
JOIN transport_types tt ON tt.name IN ('Minibus', 'Bus', 'Taxi')
WHERE s.name = 'Bole Lemi Transport Hub'
ON CONFLICT DO NOTHING;

INSERT INTO station_transport_types (station_id, transport_type_id)
SELECT s.id, tt.id
FROM stations s
JOIN transport_types tt ON tt.name IN ('Minibus', 'Taxi')
WHERE s.name = 'Megenagna Station'
ON CONFLICT DO NOTHING;

INSERT INTO station_transport_types (station_id, transport_type_id)
SELECT s.id, tt.id
FROM stations s
JOIN transport_types tt ON tt.name IN ('Minibus', 'Bus', 'Taxi')
WHERE s.name = 'Mexico Roundabout'
ON CONFLICT DO NOTHING;

INSERT INTO station_transport_types (station_id, transport_type_id)
SELECT s.id, tt.id
FROM stations s
JOIN transport_types tt ON tt.name IN ('Bus', 'Taxi')
WHERE s.name = 'Meskel Square'
ON CONFLICT DO NOTHING;

INSERT INTO station_transport_types (station_id, transport_type_id)
SELECT s.id, tt.id
FROM stations s
JOIN transport_types tt ON tt.name IN ('Minibus', 'Other')
WHERE s.name = 'Saris Transport Stop'
ON CONFLICT DO NOTHING;

INSERT INTO station_transport_types (station_id, transport_type_id)
SELECT s.id, tt.id
FROM stations s
JOIN transport_types tt ON tt.name IN ('Minibus', 'Bus', 'Taxi')
WHERE s.name = 'Piassa Central Station'
ON CONFLICT DO NOTHING;

INSERT INTO station_routes (station_id, route_id)
SELECT s.id, r.id
FROM stations s, routes r
WHERE s.name = 'Bole Lemi Transport Hub' AND r.name = 'Bole to Piazza'
ON CONFLICT DO NOTHING;

INSERT INTO station_routes (station_id, route_id)
SELECT s.id, r.id
FROM stations s, routes r
WHERE s.name = 'Bole Lemi Transport Hub' AND r.name = 'Kebena to Bole'
ON CONFLICT DO NOTHING;

INSERT INTO station_routes (station_id, route_id)
SELECT s.id, r.id
FROM stations s, routes r
WHERE s.name = 'Megenagna Station' AND r.name = 'Megenagna to Saris'
ON CONFLICT DO NOTHING;

INSERT INTO station_routes (station_id, route_id)
SELECT s.id, r.id
FROM stations s, routes r
WHERE s.name = 'Megenagna Station' AND r.name = 'Kebena to Bole'
ON CONFLICT DO NOTHING;

INSERT INTO station_routes (station_id, route_id)
SELECT s.id, r.id
FROM stations s, routes r
WHERE s.name = 'Mexico Roundabout' AND r.name = 'Meskel Square to Mexico'
ON CONFLICT DO NOTHING;

INSERT INTO station_routes (station_id, route_id)
SELECT s.id, r.id
FROM stations s, routes r
WHERE s.name = 'Mexico Roundabout' AND r.name = 'Woreda 8 to Piassa'
ON CONFLICT DO NOTHING;

INSERT INTO station_routes (station_id, route_id)
SELECT s.id, r.id
FROM stations s, routes r
WHERE s.name = 'Meskel Square' AND r.name = 'Meskel Square to Mexico'
ON CONFLICT DO NOTHING;

INSERT INTO station_routes (station_id, route_id)
SELECT s.id, r.id
FROM stations s, routes r
WHERE s.name = 'Saris Transport Stop' AND r.name = 'Megenagna to Saris'
ON CONFLICT DO NOTHING;

INSERT INTO station_routes (station_id, route_id)
SELECT s.id, r.id
FROM stations s, routes r
WHERE s.name = 'Piassa Central Station' AND r.name = 'Bole to Piazza'
ON CONFLICT DO NOTHING;

INSERT INTO station_routes (station_id, route_id)
SELECT s.id, r.id
FROM stations s, routes r
WHERE s.name = 'Piassa Central Station' AND r.name = 'Woreda 8 to Piassa'
ON CONFLICT DO NOTHING;
