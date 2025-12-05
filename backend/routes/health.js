import express from 'express';
import mongoose from 'mongoose';
import os from 'os';
import { getConnectionMetrics } from '../config/database.js';

const router = express.Router();

// Comprehensive health check endpoint
router.get('/', async (req, res) => {
    try {
        const startTime = Date.now();

        // Check database connectivity
        let dbStatus = 'unhealthy';
        let dbPingTime = 0;

        try {
            const dbStart = Date.now();
            await mongoose.connection.db.admin().ping();
            dbPingTime = Date.now() - dbStart;
            dbStatus = 'healthy';
        } catch (dbError) {
            dbStatus = 'unhealthy';
            console.error('Database health check failed:', dbError.message);
        }

        // Check memory usage
        const memoryUsage = process.memoryUsage();
        const systemMemory = os.totalmem();
        const freeMemory = os.freemem();
        const memoryUsagePercent = ((systemMemory - freeMemory) / systemMemory * 100).toFixed(2);

        // Get connection metrics
        const connectionMetrics = getConnectionMetrics();

        const healthData = {
            status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            response_time: Date.now() - startTime,
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',

            database: {
                status: dbStatus,
                ping_time: dbPingTime,
                ready_state: mongoose.connection.readyState,
                ...connectionMetrics
            },

            system: {
                memory: {
                    used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
                    total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
                    system_total: Math.round(systemMemory / 1024 / 1024) + ' MB',
                    system_free: Math.round(freeMemory / 1024 / 1024) + ' MB',
                    usage_percent: memoryUsagePercent + '%'
                },
                cpu: {
                    architecture: os.arch(),
                    cores: os.cpus().length,
                    load_average: os.loadavg()
                },
                platform: os.platform(),
                uptime: os.uptime()
            },

            services: {
                api_endpoints: {
                    products: '/api/products',
                    users: '/api/users',
                    auth: '/api/auth',
                    health: '/health'
                }
            }
        };

        const statusCode = healthData.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(healthData);

    } catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message,
            uptime: process.uptime()
        });
    }
});

// Quick health check for load balancers and monitoring systems
router.get('/ping', (req, res) => {
    const isHealthy = mongoose.connection.readyState === 1;
    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        database: isHealthy ? 'connected' : 'disconnected'
    });
});

// Detailed system metrics
router.get('/metrics', async (req, res) => {
    try {
        const metrics = {
            timestamp: new Date().toISOString(),

            // Process metrics
            process: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu_usage: process.cpuUsage(),
                pid: process.pid,
                node_version: process.version
            },

            // System metrics
            system: {
                memory: {
                    total: os.totalmem(),
                    free: os.freemem(),
                    used: os.totalmem() - os.freemem()
                },
                load: os.loadavg(),
                uptime: os.uptime(),
                cpus: os.cpus().length
            },

            // Database metrics
            database: getConnectionMetrics(),

            // HTTP metrics
            http: {
                active_connections: process._getActiveRequests().length,
                active_handles: process._getActiveHandles().length
            }
        };

        res.json(metrics);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to collect metrics',
            message: error.message
        });
    }
});

// Health check for specific services
router.get('/services/:service', async (req, res) => {
    const { service } = req.params;

    try {
        let serviceHealth = {};

        switch (service) {
            case 'database':
                const dbStart = Date.now();
                await mongoose.connection.db.admin().ping();
                serviceHealth = {
                    status: 'healthy',
                    response_time: Date.now() - dbStart,
                    connection_state: mongoose.connection.readyState,
                    ...getConnectionMetrics()
                };
                break;

            case 'api':
                serviceHealth = {
                    status: 'healthy',
                    endpoints: [
                        { path: '/api/products', method: 'GET', status: 'available' },
                        { path: '/api/users', method: 'GET', status: 'available' },
                        { path: '/api/auth', method: 'POST', status: 'available' }
                    ]
                };
                break;

            case 'memory':
                serviceHealth = {
                    status: 'healthy',
                    memory_usage: process.memoryUsage(),
                    system_memory: {
                        total: os.totalmem(),
                        free: os.freemem()
                    }
                };
                break;

            default:
                return res.status(404).json({
                    error: 'Service not found',
                    available_services: ['database', 'api', 'memory']
                });
        }

        res.json(serviceHealth);
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            service: service,
            error: error.message
        });
    }
});

export default router;