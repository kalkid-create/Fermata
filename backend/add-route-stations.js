require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function addRouteStationsTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS route_stations (
                route_id INTEGER NOT NULL
                    REFERENCES routes(id)
                    ON DELETE CASCADE,

                station_id INTEGER NOT NULL
                    REFERENCES stations(id)
                    ON DELETE CASCADE,

                stop_order INTEGER NOT NULL,

                PRIMARY KEY (route_id, station_id)
            );
        `);

        console.log("✅ route_stations table created successfully!");

    } catch (error) {
        console.error("❌ Failed to create route_stations:");
        console.error(error.message);

    } finally {
        await pool.end();
    }
}

addRouteStationsTable();