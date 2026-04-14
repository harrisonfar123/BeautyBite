// db.js — unified database driver
// Uses PostgreSQL (pg) when DATABASE_URL is set (Heroku),
// falls back to Turso/libSQL for local development.

let pool;

if (process.env.DATABASE_URL) {
    // PostgreSQL via Heroku DATABASE_URL
    const { Pool } = require('pg');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
    console.log('PostgreSQL pool initialised (Heroku)');
} else {
    // Local dev: Turso/libSQL wrapper with pg-compatible interface
    const { createClient } = require('@libsql/client');
    const client = createClient({
        url:       process.env.TURSO_DATABASE_URL || 'file:local.db',
        authToken: process.env.TURSO_AUTH_TOKEN,
    });
    console.log('Turso libSQL client initialised:', process.env.TURSO_DATABASE_URL || 'file:local.db');

    function convertPlaceholders(sql) {
        return sql.replace(/\$(\d+)/g, '?');
    }

    async function query(sql, params = []) {
        const converted = convertPlaceholders(sql);
        try {
            const result = await client.execute({ sql: converted, args: params });
            return {
                rows:     result.rows,
                rowCount: Number(result.rowsAffected ?? result.rows.length),
            };
        } catch (err) {
            console.error('DB query error:', err.message, '\nSQL:', converted);
            throw err;
        }
    }

    pool = { query };
}

module.exports = pool;
