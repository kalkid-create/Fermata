require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function setupDatabase() {
    try {
        const databaseSchema = fs.readFileSync(
            path.join(__dirname, "db", "database.sql"),
            "utf8"
        );

        const gtfsSchema = fs.readFileSync(
            path.join(__dirname, "gtfs-schema.sql"),
            "utf8"
        );

        console.log("Creating Fermata database tables...");
        await pool.query(databaseSchema);

        console.log("Applying GTFS database extensions...");
        await pool.query(gtfsSchema);

        console.log("✅ Database setup completed successfully!");

    } catch (error) {
        console.error("❌ Database setup failed:");
        console.error(error.message);

    } finally {
        await pool.end();
    }
}

setupDatabase();