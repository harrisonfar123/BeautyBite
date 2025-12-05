#!/usr/bin/env node

/**
 * Database Optimization Script for BeautyBite
 * 
 * This script handles database performance optimization, indexing strategies,
 * and query analysis for production environments.
 * Run with: node backend/scripts/optimize.js [indexes|analyze|stats|cleanup]
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

class DatabaseOptimizer {
    constructor() {
        this.optimizationReports = [];
        this.indexRecommendations = [];
    }

    async connect() {
        try {
            const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/beautybite';

            console.log('🔌 Connecting to database...');

            const config = {
                maxPoolSize: 10,
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

    async createOptimalIndexes() {
        try {
            console.log('🔍 Creating optimal indexes for all collections...');
            const db = mongoose.connection.db;

            // User collection indexes
            await this.createUserIndexes(db);

            // Product collection indexes
            await this.createProductIndexes(db);

            // Order collection indexes
            await this.createOrderIndexes(db);

            // Subscription collection indexes
            await this.createSubscriptionIndexes(db);

            // CustomDesign collection indexes
            await this.createCustomDesignIndexes(db);

            console.log('✅ All optimal indexes created successfully');

        } catch (error) {
            console.error('❌ Index creation failed:', error.message);
            throw error;
        }
    }

    async createUserIndexes(db) {
        console.log('👤 Creating user indexes...');

        const userIndexes = [
            // Primary email index
            { key: { email: 1 }, unique: true, name: 'email_unique' },

            // Compound indexes for common queries
            { key: { role: 1, isActive: 1 }, name: 'role_active' },
            { key: { email: 1, isActive: 1 }, name: 'email_active' },
            { key: { createdAt: -1 }, name: 'created_desc' },
            { key: { updatedAt: -1 }, name: 'updated_desc' },

            // Search indexes
            { key: { firstName: 1, lastName: 1 }, name: 'name_search' },
            { key: { 'preferences.emailNotifications': 1 }, name: 'email_prefs' },

            // Geolocation indexes (if applicable)
            // { key: { 'address.location': '2dsphere' }, name: 'location_geo' }
        ];

        for (const index of userIndexes) {
            try {
                await db.collection('users').createIndex(index.key, {
                    unique: index.unique,
                    name: index.name,
                    background: true // Create in background to avoid blocking
                });
                console.log(`  ✅ Created index: ${index.name}`);
            } catch (error) {
                if (error.code === 85) { // Index already exists
                    console.log(`  ℹ️  Index already exists: ${index.name}`);
                } else {
                    console.error(`  ❌ Failed to create index ${index.name}:`, error.message);
                }
            }
        }
    }

    async createProductIndexes(db) {
        console.log('🦷 Creating product indexes...');

        const productIndexes = [
            // Primary SKU index
            { key: { sku: 1 }, unique: true, name: 'sku_unique' },

            // Category and status for filtering
            { key: { category: 1, status: 1 }, name: 'category_status' },
            { key: { category: 1, subcategory: 1, status: 1 }, name: 'category_sub_status' },

            // Pricing and inventory
            { key: { 'pricing.basePrice': 1 }, name: 'price_asc' },
            { key: { 'pricing.basePrice': -1 }, name: 'price_desc' },
            { key: { 'inventory.available': 1 }, name: 'inventory_low' },

            // Search and discovery
            { key: { tags: 1 }, name: 'tags_search' },
            { key: { featured: 1, status: 1 }, name: 'featured_active' },
            { key: { customizable: 1, status: 1 }, name: 'customizable_active' },

            // SEO and performance
            { key: { 'seo.slug': 1 }, unique: true, name: 'slug_unique' },
            { key: { createdAt: -1 }, name: 'newest_products' },
            { key: { 'reviews.averageRating': -1 }, name: 'highest_rated' },

            // Text search index for full-text search
            // { key: { name: 'text', description: 'text', 'seo.keywords': 'text' }, name: 'text_search' }
        ];

        for (const index of productIndexes) {
            try {
                await db.collection('products').createIndex(index.key, {
                    unique: index.unique,
                    name: index.name,
                    background: true
                });
                console.log(`  ✅ Created index: ${index.name}`);
            } catch (error) {
                if (error.code === 85) {
                    console.log(`  ℹ️  Index already exists: ${index.name}`);
                } else {
                    console.error(`  ❌ Failed to create index ${index.name}:`, error.message);
                }
            }
        }
    }

    async createOrderIndexes(db) {
        console.log('📦 Creating order indexes...');

        const orderIndexes = [
            // Primary order tracking
            { key: { orderNumber: 1 }, unique: true, name: 'order_number_unique' },

            // User and status combinations
            { key: { userId: 1, status: 1 }, name: 'user_status' },
            { key: { userId: 1, createdAt: -1 }, name: 'user_recent_orders' },

            // Status and date ranges
            { key: { status: 1, createdAt: -1 }, name: 'status_recent' },
            { key: { status: 1, 'payment.status': 1 }, name: 'status_payment' },

            // Payment and fulfillment
            { key: { 'payment.stripePaymentIntentId': 1 }, name: 'stripe_payment' },
            { key: { 'fulfillment.trackingNumber': 1 }, name: 'tracking_number' },

            // Date-based queries
            { key: { createdAt: -1 }, name: 'recent_orders' },
            { key: { 'payment.paidAt': -1 }, name: 'recent_payments' },

            // Analytics and reporting
            { key: { 'shippingAddress.country': 1 }, name: 'country_orders' },
            { key: { totalAmount: -1 }, name: 'high_value_orders' }
        ];

        for (const index of orderIndexes) {
            try {
                await db.collection('orders').createIndex(index.key, {
                    unique: index.unique,
                    name: index.name,
                    background: true
                });
                console.log(`  ✅ Created index: ${index.name}`);
            } catch (error) {
                if (error.code === 85) {
                    console.log(`  ℹ️  Index already exists: ${index.name}`);
                } else {
                    console.error(`  ❌ Failed to create index ${index.name}:`, error.message);
                }
            }
        }
    }

    async createSubscriptionIndexes(db) {
        console.log('🔄 Creating subscription indexes...');

        const subscriptionIndexes = [
            // Primary subscription tracking
            { key: { subscriptionId: 1 }, unique: true, sparse: true, name: 'subscription_id_unique' },

            // User and status combinations
            { key: { userId: 1, status: 1 }, name: 'user_subscription_status' },
            { key: { userId: 1, plan: 1 }, name: 'user_plan' },

            // Billing and renewal
            { key: { status: 1, 'currentPeriod.end': 1 }, name: 'active_renewals' },
            { key: { 'currentPeriod.end': 1 }, name: 'upcoming_renewals' },
            { key: { 'billingCycle.anchor': 1 }, name: 'billing_cycle' },

            // Performance and analytics
            { key: { tier: 1, status: 1 }, name: 'tier_status' },
            { key: { 'deliveryPreferences.frequency': 1, status: 1 }, name: 'delivery_frequency' },
            { key: { 'performance.churnRisk': 1, status: 1 }, name: 'churn_risk' },
            { key: { 'usage.currentPeriodUsage.orders': -1 }, name: 'high_usage' }
        ];

        for (const index of subscriptionIndexes) {
            try {
                await db.collection('subscriptions').createIndex(index.key, {
                    unique: index.unique,
                    name: index.name,
                    sparse: index.sparse,
                    background: true
                });
                console.log(`  ✅ Created index: ${index.name}`);
            } catch (error) {
                if (error.code === 85) {
                    console.log(`  ℹ️  Index already exists: ${index.name}`);
                } else {
                    console.error(`  ❌ Failed to create index ${index.name}:`, error.message);
                }
            }
        }
    }

    async createCustomDesignIndexes(db) {
        console.log('🎨 Creating custom design indexes...');

        const designIndexes = [
            // User and status combinations
            { key: { userId: 1, status: 1 }, name: 'user_design_status' },
            { key: { userId: 1, createdAt: -1 }, name: 'user_recent_designs' },

            // Design metadata and status
            { key: { status: 1, 'designData.type': 1 }, name: 'status_design_type' },
            { key: { 'sharing.permissions': 1 }, name: 'sharing_permissions' },

            // Version control
            { key: { designId: 1, 'versionHistory.version': -1 }, name: 'design_versions' },

            // Performance and analytics
            { key: { createdAt: -1 }, name: 'recent_designs' },
            { key: { 'production.estimatedProductionTime': 1 }, name: 'production_time' },
            { key: { 'designData.fileSize': -1 }, name: 'large_designs' }
        ];

        for (const index of designIndexes) {
            try {
                await db.collection('customdesigns').createIndex(index.key, {
                    name: index.name,
                    background: true
                });
                console.log(`  ✅ Created index: ${index.name}`);
            } catch (error) {
                if (error.code === 85) {
                    console.log(`  ℹ️  Index already exists: ${index.name}`);
                } else {
                    console.error(`  ❌ Failed to create index ${index.name}:`, error.message);
                }
            }
        }
    }

    async analyzeQueryPerformance() {
        try {
            console.log('📊 Analyzing query performance...');
            const db = mongoose.connection.db;
            const adminDb = db.admin();

            // Get current operations to identify slow queries
            const currentOps = await adminDb.currentOp({ active: true });

            if (currentOps.inprog.length > 0) {
                console.log(`\n⚠️  Found ${currentOps.inprog.length} active operations:`);

                currentOps.inprog.forEach((op, index) => {
                    if (op.secs_running > 5) { // Operations running longer than 5 seconds
                        console.log(`  ${index + 1}. Collection: ${op.ns}, Duration: ${op.secs_running}s`);
                        console.log(`     Operation: ${op.op}, Query: ${JSON.stringify(op.query)}`);
                    }
                });
            } else {
                console.log('✅ No long-running queries found');
            }

            // Analyze index usage
            await this.analyzeIndexUsage(db);

        } catch (error) {
            console.error('❌ Query performance analysis failed:', error.message);
        }
    }

    async analyzeIndexUsage(db) {
        console.log('\n🔍 Analyzing index usage...');

        const collections = await db.listCollections().toArray();

        for (const collInfo of collections) {
            const coll = db.collection(collInfo.name);
            const stats = await coll.stats();

            console.log(`\n📋 Collection: ${collInfo.name}`);
            console.log(`   📄 Documents: ${stats.count}`);
            console.log(`   🔍 Indexes: ${stats.nindexes}`);
            console.log(`   📐 Total index size: ${this.formatBytes(stats.totalIndexSize)}`);

            // Get index usage stats
            const indexStats = await coll.aggregate([
                { $indexStats: {} }
            ]).toArray();

            indexStats.forEach(index => {
                const usage = index.accesses.ops || 0;
                const since = new Date(index.accesses.since).toLocaleDateString();
                console.log(`   📊 Index "${index.name}": ${usage} operations since ${since}`);

                // Recommend removal for unused indexes
                if (usage === 0 && index.name !== '_id_') {
                    console.log(`   ⚠️  Consider removing unused index: ${index.name}`);
                    this.indexRecommendations.push({
                        collection: collInfo.name,
                        index: index.name,
                        action: 'remove',
                        reason: 'Unused index'
                    });
                }
            });
        }
    }

    async getDatabaseStats() {
        try {
            console.log('📈 Gathering database statistics...');
            const db = mongoose.connection.db;
            const adminDb = db.admin();

            // Server status
            const serverStatus = await adminDb.serverStatus();
            console.log('\n🏢 Server Status:');
            console.log(`   📊 Version: ${serverStatus.version}`);
            console.log(`   🚀 Uptime: ${Math.floor(serverStatus.uptime / 60)} minutes`);
            console.log(`   🔗 Connections: ${serverStatus.connections.current} active`);
            console.log(`   💾 Storage: ${this.formatBytes(serverStatus.mem.resident)} resident`);

            // Database stats
            const dbStats = await db.stats();
            console.log('\n💾 Database Statistics:');
            console.log(`   📂 Collections: ${dbStats.collections}`);
            console.log(`   📄 Documents: ${dbStats.objects}`);
            console.log(`   💽 Data size: ${this.formatBytes(dbStats.dataSize)}`);
            console.log(`   📐 Storage size: ${this.formatBytes(dbStats.storageSize)}`);
            console.log(`   🔍 Index size: ${this.formatBytes(dbStats.totalIndexSize)}`);

            // Collection details
            console.log('\n📋 Collection Details:');
            const collections = await db.listCollections().toArray();

            for (const collInfo of collections) {
                const coll = db.collection(collInfo.name);
                const stats = await coll.stats();

                console.log(`   ${collInfo.name}:`);
                console.log(`     📄 ${stats.count} documents`);
                console.log(`     💽 ${this.formatBytes(stats.size)} data`);
                console.log(`     🔍 ${stats.nindexes} indexes (${this.formatBytes(stats.totalIndexSize)})`);
                console.log(`     📏 Avg doc: ${this.formatBytes(stats.avgObjSize || 0)}`);

                // Size analysis
                const sizeRatio = stats.totalIndexSize / stats.size;
                if (sizeRatio > 1) {
                    console.log(`     ⚠️  Index size larger than data (${(sizeRatio * 100).toFixed(1)}%)`);
                }
            }

        } catch (error) {
            console.error('❌ Failed to gather database statistics:', error.message);
        }
    }

    async cleanupOrphanedData() {
        try {
            console.log('🧹 Cleaning up orphaned data...');
            const db = mongoose.connection.db;

            let cleanedCount = 0;

            // Clean up orders with invalid user references
            const users = await db.collection('users').find({}, { projection: { _id: 1 } }).toArray();
            const validUserIds = users.map(user => user._id);

            const orphanedOrders = await db.collection('orders').deleteMany({
                userId: { $exists: true, $nin: validUserIds }
            });

            if (orphanedOrders.deletedCount > 0) {
                console.log(`   ✅ Removed ${orphanedOrders.deletedCount} orphaned orders`);
                cleanedCount += orphanedOrders.deletedCount;
            }

            // Clean up subscriptions with invalid user references
            const orphanedSubscriptions = await db.collection('subscriptions').deleteMany({
                userId: { $exists: true, $nin: validUserIds }
            });

            if (orphanedSubscriptions.deletedCount > 0) {
                console.log(`   ✅ Removed ${orphanedSubscriptions.deletedCount} orphaned subscriptions`);
                cleanedCount += orphanedSubscriptions.deletedCount;
            }

            // Clean up custom designs with invalid user references
            const orphanedDesigns = await db.collection('customdesigns').deleteMany({
                userId: { $exists: true, $nin: validUserIds }
            });

            if (orphanedDesigns.deletedCount > 0) {
                console.log(`   ✅ Removed ${orphanedDesigns.deletedCount} orphaned designs`);
                cleanedCount += orphanedDesigns.deletedCount;
            }

            // Clean up soft-deleted products after 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const deletedProducts = await db.collection('products').deleteMany({
                status: 'deleted',
                updatedAt: { $lt: thirtyDaysAgo }
            });

            if (deletedProducts.deletedCount > 0) {
                console.log(`   ✅ Removed ${deletedProducts.deletedCount} old deleted products`);
                cleanedCount += deletedProducts.deletedCount;
            }

            if (cleanedCount === 0) {
                console.log('   ✅ No orphaned data found to clean up');
            } else {
                console.log(`   🧹 Total cleaned: ${cleanedCount} documents`);
            }

        } catch (error) {
            console.error('❌ Data cleanup failed:', error.message);
        }
    }

    async generateOptimizationReport() {
        console.log('\n📋 Generating optimization report...');

        const report = {
            timestamp: new Date().toISOString(),
            database: mongoose.connection.db.databaseName,
            recommendations: this.indexRecommendations,
            stats: await this.getCurrentStats()
        };

        // Save report to file
        const reportsDir = join(__dirname, '..', 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const reportFile = join(reportsDir, `optimization-report-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

        console.log(`✅ Optimization report saved to: ${reportFile}`);
        return report;
    }

    async getCurrentStats() {
        const db = mongoose.connection.db;
        const stats = await db.stats();

        return {
            collections: stats.collections,
            documents: stats.objects,
            dataSize: stats.dataSize,
            indexSize: stats.totalIndexSize,
            storageSize: stats.storageSize
        };
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
    const command = args[0] || 'indexes';

    const optimizer = new DatabaseOptimizer();

    try {
        await optimizer.connect();

        switch (command) {
            case 'indexes':
                await optimizer.createOptimalIndexes();
                break;

            case 'analyze':
                await optimizer.analyzeQueryPerformance();
                break;

            case 'stats':
                await optimizer.getDatabaseStats();
                break;

            case 'cleanup':
                await optimizer.cleanupOrphanedData();
                break;

            case 'report':
                await optimizer.generateOptimizationReport();
                break;

            case 'all':
                await optimizer.createOptimalIndexes();
                await optimizer.analyzeQueryPerformance();
                await optimizer.getDatabaseStats();
                await optimizer.cleanupOrphanedData();
                await optimizer.generateOptimizationReport();
                break;

            default:
                console.log('❌ Unknown command. Available commands: indexes, analyze, stats, cleanup, report, all');
                process.exit(1);
        }

    } catch (error) {
        console.error('❌ Optimization failed:', error.message);
        process.exit(1);
    } finally {
        await optimizer.disconnect();
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

export default DatabaseOptimizer;