require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});

// Set the timezone to Europe/Kyiv
pool.on('connect', client => {
    client.query("SET TIME ZONE 'Europe/Kyiv'");
});

module.exports = pool;
