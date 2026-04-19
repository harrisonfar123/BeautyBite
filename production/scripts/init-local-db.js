// init-local-db.js — Create all SQLite tables referenced by server.js
// Uses @libsql/client against file:local.db (same driver db.js picks in dev)
// Run from production/: node scripts/init-local-db.js

const path = require('path');
const { createClient } = require('@libsql/client');

const dbUrl = process.env.TURSO_DATABASE_URL || 'file:local.db';
const client = createClient({ url: dbUrl });

const statements = [
    `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        stripe_session_id TEXT UNIQUE,
        stripe_payment_intent_id TEXT,
        product_type TEXT,
        quantity INTEGER,
        amount REAL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        stripe_subscription_id TEXT UNIQUE,
        stripe_customer_id TEXT,
        product_id TEXT,
        status TEXT DEFAULT 'active',
        duration_months INTEGER,
        start_date TEXT,
        end_date TEXT,
        next_billing_date TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE REFERENCES users(id),
        stripe_customer_id TEXT UNIQUE,
        created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS subscription_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscription_id INTEGER,
        stripe_invoice_id TEXT,
        amount REAL,
        status TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS order_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        order_type TEXT,
        order_id INTEGER,
        stripe_payment_intent_id TEXT,
        stripe_customer_id TEXT,
        quantity INTEGER,
        amount REAL,
        status TEXT DEFAULT 'completed',
        billing_email TEXT,
        billing_name TEXT,
        shipping_address TEXT,
        period_number INTEGER,
        total_periods INTEGER,
        interval TEXT,
        notes TEXT,
        product_type TEXT DEFAULT 'standard',
        email_sent INTEGER DEFAULT 0,
        email_sent_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS custom_order_designs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        user_id INTEGER,
        design_config TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS saved_designs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT 'My Design',
        config TEXT NOT NULL DEFAULT '{}',
        thumbnail_data TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`,
];

(async () => {
    console.log(`Initializing SQLite DB at ${dbUrl}`);
    for (const sql of statements) {
        const name = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
        try {
            await client.execute(sql);
            console.log(`  ok   ${name}`);
        } catch (e) {
            console.error(`  fail ${name}: ${e.message}`);
        }
    }
    const tables = await client.execute(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    );
    console.log('Tables present:', tables.rows.map(r => r.name).join(', '));
    process.exit(0);
})();
