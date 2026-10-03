require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function verifyGTFS() {
    try {
        const stations = await pool.query(`
            SELECT COUNT(*) AS count
            FROM stations
            WHERE gtfs_stop_id IS NOT NULL;
        `);

        const routes = await pool.query(`
            SELECT COUNT(*) AS count
            FROM routes
            WHERE gtfs_route_id IS NOT NULL;
        `);

        const connections = await pool.query(`
            SELECT COUNT(*) AS count
            FROM route_stations;
        `);

        const shapes = await pool.query(`
            SELECT COUNT(*) AS count
            FROM route_shapes;
        `);

        console.log("\n============================================");
        console.log("FERMATA DATABASE VERIFICATION");
        console.log("============================================");

        console.log("GTFS Stations:", stations.rows[0].count);
        console.log("GTFS Routes:", routes.rows[0].count);
        console.log("Route Connections:", connections.rows[0].count);
        console.log("Shape Points:", shapes.rows[0].count);

        console.log("============================================\n");

    } catch (error) {
        console.error("❌ Verification failed:");
        console.error(error.message);
    } finally {
        await pool.end();
    }
}

verifyGTFS();