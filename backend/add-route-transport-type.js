require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function addColumn() {
    try {
        await pool.query(`
            ALTER TABLE routes
            ADD COLUMN IF NOT EXISTS transport_type_id INTEGER
            REFERENCES transport_types(id)
            ON DELETE SET NULL;
        `);

        console.log("✅ transport_type_id column added successfully!");

    } catch (error) {
        console.error("❌ Failed to add column:");
        console.error(error.message);

    } finally {
        await pool.end();
    }
}

addColumn();