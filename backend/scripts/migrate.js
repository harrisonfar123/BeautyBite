#!/usr/bin/env node

/**
 * Database Migration Script for BeautyBite
 * 
 * This script handles database schema migrations and updates
 * Run with: node backend/scripts/migrate.js [--env production|development|test]
 */

import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Migration configuration
const MIGRATIONS_DIR = join(__dirname, 'migrations');
const CONNECTION_TIMEOUT = 30000; // 30 seconds

class DatabaseMigrator {
    constructor() {
        this.migrations = [];
        this.appliedMigrations = new Set();
        this.migrationCollection = 'migrations';
    }

    async connect() {
        try {
            const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/beautybite';

            console.log('🔌 Connecting to database...');

            const config = {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                bufferCommands: false,
                bufferMaxEntries: 0
            };

            await mongoose.connect(connectionString, config);
            console.log('✅ Database connected successfully');

            // Ensure migrations collection exists
            await this.ensureMigrationsCollection();

        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            process.exit(1);
        }
    }

    async ensureMigrationsCollection() {
        const db = mongoose.connection.db;
        const collections = await db.listCollections({ name: this.migrationCollection }).toArray();

        if (collections.length === 0) {
            await db.createCollection(this.migrationCollection);
            console.log('✅ Created migrations collection');
        }
    }

    async loadMigrations() {
        try {
            if (!fs.existsSync(MIGRATIONS_DIR)) {
                fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
                console.log('📁 Created migrations directory');
                return;
            }

            const files = fs.readdirSync(MIGRATIONS_DIR)
                .filter(file => file.endsWith('.js'))
                .sort();

            for (const file of files) {
                const migrationPath = join(MIGRATIONS_DIR, file);
                const migration = await import(migrationPath);

                this.migrations.push({
                    name: file.replace('.js', ''),
                    path: migrationPath,
                    module: migration.default
                });
            }

            console.log(`📦 Loaded ${this.migrations.length} migration files`);
        } catch (error) {
            console.error('❌ Failed to load migrations:', error.message);
            process.exit(1);
        }
    }

    async loadAppliedMigrations() {
        try {
            const db = mongoose.connection.db;
            const migrations = await db.collection(this.migrationCollection)
                .find({})
                .sort({ appliedAt: 1 })
                .toArray();

            this.appliedMigrations = new Set(migrations.map(m => m.name));
            console.log(`📋 Found ${this.appliedMigrations.size} applied migrations`);
        } catch (error) {
            console.error('❌ Failed to load applied migrations:', error.message);
            process.exit(1);
        }
    }

    async runMigrations() {
        const pendingMigrations = this.migrations.filter(m => !this.appliedMigrations.has(m.name));

        if (pendingMigrations.length === 0) {
            console.log('✅ No pending migrations');
            return;
        }

        console.log(`🔄 Running ${pendingMigrations.length} pending migrations...`);

        for (const migration of pendingMigrations) {
            try {
                console.log(`\n📝 Running migration: ${migration.name}`);

                const startTime = Date.now();
                await migration.module.up(mongoose.connection.db);
                const duration = Date.now() - startTime;

                // Record migration
                await mongoose.connection.db.collection(this.migrationCollection).insertOne({
                    name: migration.name,
                    appliedAt: new Date(),
                    duration: duration
                });

                console.log(`✅ Migration ${migration.name} completed in ${duration}ms`);
            } catch (error) {
                console.error(`❌ Migration ${migration.name} failed:`, error.message);
                throw error;
            }
        }
    }

    async createMigration(name) {
        const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14);
        const filename = `${timestamp}_${name}.js`;
        const filepath = join(MIGRATIONS_DIR, filename);

        const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

export default {
  async up(db) {
    // Add your migration logic here
    // Example: await db.collection('users').createIndex({ email: 1 }, { unique: true });
  },

  async down(db) {
    // Add rollback logic here (optional)
    // Example: await db.collection('users').dropIndex('email_1');
  }
};
`;

        fs.writeFileSync(filepath, template);
        console.log(`📄 Created migration: ${filename}`);
    }

    async disconnect() {
        try {
            await mongoose.disconnect();
            console.log('🔌 Database disconnected');
        } catch (error) {
            console.error('❌ Error disconnecting from database:', error.message);
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    const migrator = new DatabaseMigrator();

    try {
        await migrator.connect();

        if (command === 'create') {
            const name = args[1];
            if (!name) {
                console.error('❌ Please provide a migration name: node migrate.js create <name>');
                process.exit(1);
            }
            await migrator.createMigration(name);
        } else if (command === 'status') {
            await migrator.loadMigrations();
            await migrator.loadAppliedMigrations();

            console.log('\n📊 Migration Status:');
            migrator.migrations.forEach(migration => {
                const status = migrator.appliedMigrations.has(migration.name) ? '✅ Applied' : '⏳ Pending';
                console.log(`  ${status}: ${migration.name}`);
            });
        } else {
            // Default: run migrations
            await migrator.loadMigrations();
            await migrator.loadAppliedMigrations();
            await migrator.runMigrations();
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await migrator.disconnect();
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

export default DatabaseMigrator;