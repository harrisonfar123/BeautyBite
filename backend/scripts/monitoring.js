#!/usr/bin/env node

/**
 * BeautyBite Automated Health Check and Monitoring Script
 * Runs comprehensive system checks and reports status
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MonitoringScript {
    constructor() {
        this.config = {
            baseUrl: process.env.BACKEND_URL || 'http://localhost:5001',
            frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',
            timeout: 10000,
            checkInterval: 30000, // 30 seconds
            alertThreshold: 3 // Number of consecutive failures before alert
        };

        this.status = {
            backend: { healthy: false, consecutiveFailures: 0, lastCheck: null },
            frontend: { healthy: false, consecutiveFailures: 0, lastCheck: null },
            database: { healthy: false, consecutiveFailures: 0, lastCheck: null },
            apiEndpoints: {}
        };

        this.metrics = {
            checksPerformed: 0,
            totalFailures: 0,
            uptime: 0,
            startTime: Date.now()
        };
    }

    async runHealthCheck() {
        this.metrics.checksPerformed++;
        const checkTime = new Date().toISOString();

        console.log(`\n🔍 Running health check at ${checkTime}`);
        console.log('='.repeat(50));

        try {
            // Check backend health
            await this.checkBackendHealth();

            // Check frontend availability
            await this.checkFrontendHealth();

            // Check critical API endpoints
            await this.checkApiEndpoints();

            // Generate report
            await this.generateReport();

            // Check for alerts
            this.checkAlerts();

        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            this.metrics.totalFailures++;
        }
    }

    async checkBackendHealth() {
        try {
            const response = await axios.get(`${this.config.baseUrl}/health`, {
                timeout: this.config.timeout
            });

            const healthData = response.data;
            this.status.backend.healthy = healthData.status === 'healthy';
            this.status.backend.lastCheck = new Date().toISOString();

            if (this.status.backend.healthy) {
                this.status.backend.consecutiveFailures = 0;
                console.log('✅ Backend: HEALTHY');
                console.log(`   Uptime: ${Math.round(healthData.uptime)}s`);
                console.log(`   Response Time: ${healthData.response_time}ms`);
                console.log(`   Memory: ${healthData.system.memory.used}`);
            } else {
                this.status.backend.consecutiveFailures++;
                console.log('⚠️ Backend: DEGRADED');
            }

            // Check database status from health data
            this.status.database.healthy = healthData.database.status === 'healthy';
            this.status.database.lastCheck = new Date().toISOString();

            if (this.status.database.healthy) {
                this.status.database.consecutiveFailures = 0;
                console.log('✅ Database: HEALTHY');
                console.log(`   Ping Time: ${healthData.database.ping_time}ms`);
            } else {
                this.status.database.consecutiveFailures++;
                console.log('❌ Database: UNHEALTHY');
            }

        } catch (error) {
            this.status.backend.healthy = false;
            this.status.backend.consecutiveFailures++;
            this.status.database.healthy = false;
            this.status.database.consecutiveFailures++;
            this.metrics.totalFailures++;

            console.log('❌ Backend: UNREACHABLE');
            console.log(`   Error: ${error.message}`);
        }
    }

    async checkFrontendHealth() {
        try {
            const response = await axios.get(this.config.frontendUrl, {
                timeout: this.config.timeout,
                validateStatus: (status) => status < 500 // Accept 4xx as reachable
            });

            this.status.frontend.healthy = true;
            this.status.frontend.lastCheck = new Date().toISOString();
            this.status.frontend.consecutiveFailures = 0;

            console.log('✅ Frontend: HEALTHY');
            console.log(`   Status: ${response.status}`);
            console.log(`   Content Type: ${response.headers['content-type']}`);

        } catch (error) {
            this.status.frontend.healthy = false;
            this.status.frontend.consecutiveFailures++;
            this.metrics.totalFailures++;

            console.log('❌ Frontend: UNREACHABLE');
            console.log(`   Error: ${error.message}`);
        }
    }

    async checkApiEndpoints() {
        const endpoints = [
            { name: 'Products API', path: '/api/products', method: 'GET' },
            { name: 'Users API', path: '/api/users', method: 'GET' },
            { name: 'Auth API', path: '/api/auth', method: 'GET' },
            { name: 'Health Metrics', path: '/health/metrics', method: 'GET' }
        ];

        for (const endpoint of endpoints) {
            try {
                const startTime = Date.now();
                const response = await axios({
                    method: endpoint.method,
                    url: `${this.config.baseUrl}${endpoint.path}`,
                    timeout: this.config.timeout
                });

                const responseTime = Date.now() - startTime;
                const isHealthy = response.status >= 200 && response.status < 400 && responseTime < 3000;

                this.status.apiEndpoints[endpoint.name] = {
                    healthy: isHealthy,
                    responseTime,
                    statusCode: response.status,
                    lastCheck: new Date().toISOString()
                };

                if (isHealthy) {
                    console.log(`✅ ${endpoint.name}: HEALTHY (${responseTime}ms)`);
                } else {
                    console.log(`⚠️ ${endpoint.name}: SLOW (${responseTime}ms)`);
                }

            } catch (error) {
                this.status.apiEndpoints[endpoint.name] = {
                    healthy: false,
                    responseTime: null,
                    statusCode: error.response?.status || 0,
                    lastCheck: new Date().toISOString(),
                    error: error.message
                };

                console.log(`❌ ${endpoint.name}: FAILED`);
                console.log(`   Error: ${error.message}`);
            }
        }
    }

    checkAlerts() {
        const alerts = [];

        // Check for consecutive failures
        if (this.status.backend.consecutiveFailures >= this.config.alertThreshold) {
            alerts.push({
                level: 'CRITICAL',
                service: 'Backend',
                message: `Backend has been unhealthy for ${this.status.backend.consecutiveFailures} consecutive checks`,
                timestamp: new Date().toISOString()
            });
        }

        if (this.status.database.consecutiveFailures >= this.config.alertThreshold) {
            alerts.push({
                level: 'CRITICAL',
                service: 'Database',
                message: `Database has been unhealthy for ${this.status.database.consecutiveFailures} consecutive checks`,
                timestamp: new Date().toISOString()
            });
        }

        if (this.status.frontend.consecutiveFailures >= this.config.alertThreshold) {
            alerts.push({
                level: 'HIGH',
                service: 'Frontend',
                message: `Frontend has been unreachable for ${this.status.frontend.consecutiveFailures} consecutive checks`,
                timestamp: new Date().toISOString()
            });
        }

        // Check API endpoints
        Object.entries(this.status.apiEndpoints).forEach(([name, endpoint]) => {
            if (!endpoint.healthy) {
                alerts.push({
                    level: 'MEDIUM',
                    service: name,
                    message: `API endpoint ${name} is failing`,
                    timestamp: endpoint.lastCheck
                });
            }
        });

        if (alerts.length > 0) {
            console.log('\n🚨 ALERTS:');
            alerts.forEach(alert => {
                console.log(`   ${alert.level} - ${alert.service}: ${alert.message}`);
            });

            // In a real implementation, you would send these alerts via:
            // - Email
            // - Slack/Teams webhook
            // - SMS
            // - PagerDuty
            this.sendAlerts(alerts);
        }
    }

    sendAlerts(alerts) {
        // This is a placeholder for actual alerting implementation
        // In production, you would integrate with your alerting system
        console.log('\n📢 Sending alerts to monitoring system...');

        alerts.forEach(alert => {
            // Example: Send to logging system, email, or webhook
            this.logToFile('alerts.log', JSON.stringify(alert));
        });
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            metrics: {
                ...this.metrics,
                uptime: Math.round((Date.now() - this.metrics.startTime) / 1000),
                successRate: ((this.metrics.checksPerformed - this.metrics.totalFailures) / this.metrics.checksPerformed * 100).toFixed(2)
            },
            status: this.status,
            overallHealth: this.calculateOverallHealth()
        };

        // Log report to console
        console.log('\n📊 HEALTH REPORT:');
        console.log(`   Overall Health: ${report.overallHealth.status}`);
        console.log(`   Health Score: ${report.overallHealth.score}%`);
        console.log(`   Checks Performed: ${report.metrics.checksPerformed}`);
        console.log(`   Success Rate: ${report.metrics.successRate}%`);
        console.log(`   Script Uptime: ${report.metrics.uptime}s`);

        // Save report to file
        this.logToFile('health-reports.log', JSON.stringify(report));

        return report;
    }

    calculateOverallHealth() {
        const checks = [
            this.status.backend.healthy,
            this.status.database.healthy,
            this.status.frontend.healthy,
            ...Object.values(this.status.apiEndpoints).map(ep => ep.healthy)
        ];

        const healthyChecks = checks.filter(Boolean).length;
        const totalChecks = checks.length;
        const healthScore = Math.round((healthyChecks / totalChecks) * 100);

        let status = 'healthy';
        if (healthScore < 50) status = 'unhealthy';
        else if (healthScore < 80) status = 'degraded';

        return { status, score: healthScore };
    }

    logToFile(filename, data) {
        const logPath = path.join(__dirname, 'logs', filename);
        const logDir = path.dirname(logPath);

        // Ensure log directory exists
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        // Append to log file with timestamp
        const logEntry = `[${new Date().toISOString()}] ${data}\n`;
        fs.appendFileSync(logPath, logEntry);
    }

    async startContinuousMonitoring() {
        console.log('🚀 Starting continuous monitoring...');
        console.log(`   Backend: ${this.config.baseUrl}`);
        console.log(`   Frontend: ${this.config.frontendUrl}`);
        console.log(`   Check Interval: ${this.config.checkInterval / 1000}s`);
        console.log(`   Alert Threshold: ${this.config.alertThreshold} consecutive failures`);

        // Run initial check
        await this.runHealthCheck();

        // Set up interval for continuous monitoring
        setInterval(async () => {
            await this.runHealthCheck();
        }, this.config.checkInterval);
    }

    async runSingleCheck() {
        console.log('🔍 Running single health check...');
        await this.runHealthCheck();
        process.exit(0);
    }
}

// CLI interface
const monitor = new MonitoringScript();

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'continuous':
        monitor.startContinuousMonitoring();
        break;
    case 'single':
    default:
        monitor.runSingleCheck();
        break;
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down monitoring...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Monitoring terminated');
    process.exit(0);
});

export default MonitoringScript;