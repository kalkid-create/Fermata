require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkDatabase() {
    try {
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        console.log("\nDATABASE TABLES:\n");
        console.table(result.rows);

    } catch (error) {
        console.error("\nDATABASE ERROR:");
        console.error(error.message);

    } finally {
        await pool.end();
    }
}

checkDatabase();