// db.js — Turso/libSQL driver with pg-compatible interface
// Wraps @libsql/client so server.js can keep pool.query($1, $2) syntax unchanged.
const { createClient } = require('@libsql/client');

const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log('✅ Turso libSQL client initialised:', process.env.TURSO_DATABASE_URL);

// Convert PostgreSQL $1/$2/... positional params to ? for libSQL
function convertPlaceholders(sql) {
    return sql.replace(/\$(\d+)/g, '?');
}

// Mimic pg Pool.query(sql, params) → { rows, rowCount }
async function query(sql, params = []) {
    const converted = convertPlaceholders(sql);
    try {
        const result = await client.execute({ sql: converted, args: params });
        return {
            rows:     result.rows,
            rowCount: Number(result.rowsAffected ?? result.rows.length),
        };
    } catch (err) {
        console.error('❌ DB query error:', err.message, '\nSQL:', converted);
        throw err;
    }
}

// Expose a pool-shaped object so existing `pool.query(...)` calls work as-is
const pool = { query };

module.exports = pool;
