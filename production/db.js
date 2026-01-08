// db.js - PostgreSQL connection pool for BeautyBite backend
const { Pool } = require('pg');

// Create connection pool using DATABASE_URL from .env
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false  // Required for Heroku Postgres
    }
});

// Log connection events for debugging
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = pool;
