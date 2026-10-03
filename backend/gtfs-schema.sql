-- ============================================
-- FERMATA GTFS DATABASE STRUCTURE
-- ============================================

-- Extra GTFS identifiers
ALTER TABLE stations
ADD COLUMN IF NOT EXISTS gtfs_stop_id TEXT;

ALTER TABLE routes
ADD COLUMN IF NOT EXISTS gtfs_route_id TEXT;

ALTER TABLE routes
ADD COLUMN IF NOT EXISTS route_type INTEGER;

ALTER TABLE routes
ADD COLUMN IF NOT EXISTS route_short_name TEXT;

ALTER TABLE routes
ADD COLUMN IF NOT EXISTS route_color TEXT;

ALTER TABLE routes
ADD COLUMN IF NOT EXISTS shape_id TEXT;

-- Shape table for drawing routes on the map
CREATE TABLE IF NOT EXISTS route_shapes (
    id SERIAL PRIMARY KEY,
    shape_id TEXT NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    point_sequence INTEGER NOT NULL,
    distance_traveled DECIMAL,
    UNIQUE (shape_id, point_sequence)
);

CREATE INDEX IF NOT EXISTS idx_stations_gtfs_stop_id
ON stations(gtfs_stop_id);

CREATE INDEX IF NOT EXISTS idx_routes_gtfs_route_id
ON routes(gtfs_route_id);

CREATE INDEX IF NOT EXISTS idx_route_shapes_shape_id
ON route_shapes(shape_id);

-- Make GTFS IDs unique when present
CREATE UNIQUE INDEX IF NOT EXISTS
idx_unique_gtfs_stop_id
ON stations(gtfs_stop_id)
WHERE gtfs_stop_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
idx_unique_gtfs_route_id
ON routes(gtfs_route_id)
WHERE gtfs_route_id IS NOT NULL;

SELECT 'GTFS database structure ready!' AS status;