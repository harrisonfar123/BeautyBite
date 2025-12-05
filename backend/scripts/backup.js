#!/usr/bin/env node

/**
 * Database Backup and Restore Script for BeautyBite
 * 
 * This script handles database backups, restores, and health checks
 * Run with: node backend/scripts/backup.js [backup|restore|health|cleanup]
 */

import mongoose from 'mongoose';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = promisify(exec);

class DatabaseManager {
    constructor() {
        this.backupDir = join(__dirname, '..', '..', 'backups');
        this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
        this.maxBackups = parseInt(process.env.MAX_BACKUPS) || 50;
    }

    async connect() {
        try {
            const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/beautybite';

            console.log('🔌 Connecting to database...');

            const config = {
                maxPoolSize: 5,
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                bufferCommands: false
            };

            await mongoose.connect(connectionString, config);
            console.log('✅ Database connected successfully');

        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            process.exit(1);
        }
    }

    async disconnect() {
        try {
            await mongoose.disconnect();
            console.log('🔌 Database disconnected');
        } catch (error) {
            console.error('❌ Error disconnecting from database:', error.message);
        }
    }

    async ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            console.log(`📁 Created backup directory: ${this.backupDir}`);
        }
    }

    async createBackup() {
        try {
            await this.ensureBackupDir();

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `beautybite-backup-${timestamp}`;
            const backupPath = join(this.backupDir, backupName);

            console.log(`💾 Creating backup: ${backupName}`);

            // Get database connection details
            const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/beautybite';

            // Use mongodump for backup
            const mongodumpCmd = `mongodump --uri="${connectionString}" --out="${backupPath}" --gzip`;

            console.log(`📦 Running: ${mongodumpCmd}`);
            const { stdout, stderr } = await execAsync(mongodumpCmd);

            if (stderr && !stderr.includes('writing')) {
                console.warn('⚠️  Backup warnings:', stderr);
            }

            // Create metadata file
            const metadata = {
                name: backupName,
                timestamp: new Date().toISOString(),
                database: 'beautybite',
                version: process.env.npm_package_version || '1.0.0',
                collections: await this.getCollectionStats(),
                size: await this.getBackupSize(backupPath)
            };

            const metadataPath = join(backupPath, 'backup-metadata.json');
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

            console.log(`✅ Backup created successfully: ${backupName}`);
            console.log(`📊 Backup size: ${this.formatBytes(metadata.size)}`);

            return backupName;

        } catch (error) {
            console.error('❌ Backup failed:', error.message);
            throw error;
        }
    }

    async restoreBackup(backupName) {
        try {
            const backupPath = join(this.backupDir, backupName);

            if (!fs.existsSync(backupPath)) {
                throw new Error(`Backup not found: ${backupName}`);
            }

            console.log(`🔄 Restoring backup: ${backupName}`);

            // Check metadata
            const metadataPath = join(backupPath, 'backup-metadata.json');
            if (fs.existsSync(metadataPath)) {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                console.log(`📋 Backup info: ${metadata.timestamp}, ${this.formatBytes(metadata.size)}`);
            }

            // Get database connection details
            const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/beautybite';

            // Use mongorestore for restoration
            const mongorestoreCmd = `mongorestore --uri="${connectionString}" --drop --gzip "${backupPath}"`;

            console.log(`📦 Running: ${mongorestoreCmd}`);
            const { stdout, stderr } = await execAsync(mongorestoreCmd);

            if (stderr && !stderr.includes('restoring')) {
                console.warn('⚠️  Restore warnings:', stderr);
            }

            console.log(`✅ Backup restored successfully: ${backupName}`);

        } catch (error) {
            console.error('❌ Restore failed:', error.message);
            throw error;
        }
    }

    async listBackups() {
        await this.ensureBackupDir();

        const backups = fs.readdirSync(this.backupDir)
            .filter(dir => dir.startsWith('beautybite-backup-'))
            .map(dir => {
                const dirPath = join(this.backupDir, dir);
                const stats = fs.statSync(dirPath);
                const metadataPath = join(dirPath, 'backup-metadata.json');

                let metadata = {};
                if (fs.existsSync(metadataPath)) {
                    try {
                        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                    } catch (e) {
                        console.warn(`⚠️  Could not read metadata for ${dir}`);
                    }
                }

                return {
                    name: dir,
                    path: dirPath,
                    created: stats.birthtime,
                    size: metadata.size || this.getDirectorySize(dirPath),
                    collections: metadata.collections || {}
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));

        return backups;
    }

    async cleanupBackups() {
        const backups = await this.listBackups();

        if (backups.length === 0) {
            console.log('📭 No backups found to clean up');
            return;
        }

        console.log(`🧹 Cleaning up backups (retention: ${this.retentionDays} days, max: ${this.maxBackups})`);

        const now = new Date();
        const cutoffDate = new Date(now.setDate(now.getDate() - this.retentionDays));

        let deletedCount = 0;
        let totalFreed = 0;

        // Delete backups older than retention period
        for (const backup of backups) {
            const backupDate = new Date(backup.created);

            if (backupDate < cutoffDate || backups.indexOf(backup) >= this.maxBackups) {
                console.log(`🗑️  Deleting old backup: ${backup.name}`);

                try {
                    await this.deleteBackup(backup.name);
                    deletedCount++;
                    totalFreed += backup.size;
                } catch (error) {
                    console.error(`❌ Failed to delete backup ${backup.name}:`, error.message);
                }
            }
        }

        if (deletedCount > 0) {
            console.log(`✅ Cleanup completed: deleted ${deletedCount} backups, freed ${this.formatBytes(totalFreed)}`);
        } else {
            console.log('✅ No backups needed cleanup');
        }
    }

    async deleteBackup(backupName) {
        const backupPath = join(this.backupDir, backupName);

        if (!fs.existsSync(backupPath)) {
            throw new Error(`Backup not found: ${backupName}`);
        }

        // Recursively delete backup directory
        const deleteRecursive = (path) => {
            if (fs.existsSync(path)) {
                fs.readdirSync(path).forEach(file => {
                    const curPath = join(path, file);
                    if (fs.lstatSync(curPath).isDirectory()) {
                        deleteRecursive(curPath);
                    } else {
                        fs.unlinkSync(curPath);
                    }
                });
                fs.rmdirSync(path);
            }
        };

        deleteRecursive(backupPath);
        console.log(`✅ Deleted backup: ${backupName}`);
    }

    async checkHealth() {
        try {
            console.log('🏥 Running database health check...');

            const db = mongoose.connection.db;
            const adminDb = db.admin();

            // Check server status
            const serverStatus = await adminDb.serverStatus();
            console.log('✅ Server is running');
            console.log(`📊 Version: ${serverStatus.version}`);
            console.log(`🔄 Uptime: ${Math.floor(serverStatus.uptime / 60)} minutes`);

            // Check connection count
            console.log(`🔗 Connections: ${serverStatus.connections.current} active`);

            // Check database stats
            const dbStats = await db.stats();
            console.log(`💾 Database size: ${this.formatBytes(dbStats.dataSize)}`);
            console.log(`📂 Collections: ${dbStats.collections}`);
            console.log(`📄 Documents: ${dbStats.objects}`);

            // Check collection health
            const collections = await db.listCollections().toArray();
            console.log('\n📋 Collection details:');

            for (const collInfo of collections) {
                const coll = db.collection(collInfo.name);
                const stats = await coll.stats();

                console.log(`  ${collInfo.name}:`);
                console.log(`    📄 Documents: ${stats.count}`);
                console.log(`    💾 Size: ${this.formatBytes(stats.size)}`);
                console.log(`    📏 Avg doc size: ${this.formatBytes(stats.avgObjSize || 0)}`);

                if (stats.nindexes > 0) {
                    console.log(`    🔍 Indexes: ${stats.nindexes}`);
                    console.log(`    📐 Index size: ${this.formatBytes(stats.totalIndexSize)}`);
                }
            }

            // Check for long-running operations
            const currentOps = await adminDb.currentOp({ active: true, secs_running: { $gt: 10 } });
            if (currentOps.inprog.length > 0) {
                console.warn(`⚠️  Found ${currentOps.inprog.length} long-running operations`);
            }

            console.log('✅ Database health check passed');
            return true;

        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            return false;
        }
    }

    async validateData() {
        try {
            console.log('🔍 Running data validation...');

            const db = mongoose.connection.db;
            const collections = await db.listCollections().toArray();

            let totalIssues = 0;

            for (const collInfo of collections) {
                console.log(`\n📋 Validating collection: ${collInfo.name}`);

                const coll = db.collection(collInfo.name);

                // Check for documents without required fields
                // This is a basic validation - extend based on your schema requirements
                const sampleDoc = await coll.findOne({});
                if (sampleDoc) {
                    // Check for common issues
                    const issues = [];

                    // Check for missing timestamps in time-sensitive collections
                    if (['users', 'products', 'orders', 'subscriptions'].includes(collInfo.name)) {
                        const missingTimestamps = await coll.countDocuments({
                            $or: [
                                { createdAt: { $exists: false } },
                                { updatedAt: { $exists: false } }
                            ]
                        });

                        if (missingTimestamps > 0) {
                            issues.push(`Missing timestamps in ${missingTimestamps} documents`);
                        }
                    }

                    // Check for orphaned references
                    if (collInfo.name === 'orders') {
                        // Get all valid user IDs
                        const usersCollection = db.collection('users');
                        const validUserIds = await usersCollection.find({}, { projection: { _id: 1 } }).toArray();
                        const validUserIdsArray = validUserIds.map(user => user._id);

                        // Count orders with invalid user references
                        const orphanedOrders = await coll.countDocuments({
                            userId: { $exists: true, $nin: validUserIdsArray }
                        });

                        if (orphanedOrders > 0) {
                            issues.push(`Found ${orphanedOrders} orders with invalid user references`);
                        }
                    }

                    if (issues.length > 0) {
                        console.warn(`  ⚠️  Issues found:`);
                        issues.forEach(issue => console.warn(`    - ${issue}`));
                        totalIssues += issues.length;
                    } else {
                        console.log('  ✅ No issues found');
                    }
                }
            }

            if (totalIssues > 0) {
                console.warn(`\n⚠️  Total validation issues: ${totalIssues}`);
            } else {
                console.log('\n✅ Data validation passed');
            }

            return totalIssues === 0;

        } catch (error) {
            console.error('❌ Data validation failed:', error.message);
            return false;
        }
    }

    // Helper methods
    async getCollectionStats() {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        const stats = {};

        for (const collInfo of collections) {
            const coll = db.collection(collInfo.name);
            const collStats = await coll.stats();
            stats[collInfo.name] = {
                count: collStats.count,
                size: collStats.size,
                avgObjSize: collStats.avgObjSize,
                storageSize: collStats.storageSize
            };
        }

        return stats;
    }

    async getBackupSize(backupPath) {
        let totalSize = 0;

        const calculateSize = (path) => {
            const stats = fs.statSync(path);
            if (stats.isDirectory()) {
                fs.readdirSync(path).forEach(file => {
                    calculateSize(join(path, file));
                });
            } else {
                totalSize += stats.size;
            }
        };

        calculateSize(backupPath);
        return totalSize;
    }

    getDirectorySize(path) {
        let totalSize = 0;

        if (fs.existsSync(path)) {
            const stats = fs.statSync(path);
            if (stats.isDirectory()) {
                fs.readdirSync(path).forEach(file => {
                    totalSize += this.getDirectorySize(join(path, file));
                });
            } else {
                totalSize += stats.size;
            }
        }

        return totalSize;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'health';
    const backupName = args[1];

    const dbManager = new DatabaseManager();

    try {
        await dbManager.connect();

        switch (command) {
            case 'backup':
                await dbManager.createBackup();
                break;

            case 'restore':
                if (!backupName) {
                    console.error('❌ Please provide a backup name: node backup.js restore <backup-name>');
                    process.exit(1);
                }
                await dbManager.restoreBackup(backupName);
                break;

            case 'list':
                const backups = await dbManager.listBackups();
                console.log('\n📋 Available backups:');
                backups.forEach(backup => {
                    console.log(`  📦 ${backup.name}`);
                    console.log(`    📅 Created: ${backup.created.toLocaleString()}`);
                    console.log(`    💾 Size: ${dbManager.formatBytes(backup.size)}`);
                    console.log(`    📄 Collections: ${Object.keys(backup.collections).length}`);
                });
                break;

            case 'cleanup':
                await dbManager.cleanupBackups();
                break;

            case 'health':
                await dbManager.checkHealth();
                break;

            case 'validate':
                await dbManager.validateData();
                break;

            case 'delete':
                if (!backupName) {
                    console.error('❌ Please provide a backup name: node backup.js delete <backup-name>');
                    process.exit(1);
                }
                await dbManager.deleteBackup(backupName);
                break;

            default:
                console.log('❌ Unknown command. Available commands: backup, restore, list, cleanup, health, validate, delete');
                process.exit(1);
        }

    } catch (error) {
        console.error('❌ Operation failed:', error.message);
        process.exit(1);
    } finally {
        await dbManager.disconnect();
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

export default DatabaseManager;