#!/usr/bin/env node

/**
 * BeautyBite Alerting System
 * Monitors system health and sends alerts when thresholds are breached
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AlertingSystem {
    constructor() {
        this.config = {
            baseUrl: process.env.BACKEND_URL || 'http://localhost:5001',
            alertThresholds: {
                responseTime: 5000, // 5 seconds
                memoryUsage: 85, // 85%
                errorRate: 5, // 5%
                consecutiveFailures: 3
            },
            checkInterval: 60000, // 1 minute
            alertCooldown: 300000 // 5 minutes
        };

        this.alertHistory = new Map();
        this.activeAlerts = new Set();
    }

    async checkSystemHealth() {
        try {
            const response = await axios.get(`${this.config.baseUrl}/health`, {
                timeout: 10000
            });

            const healthData = response.data;
            await this.evaluateThresholds(healthData);

        } catch (error) {
            console.error('❌ Failed to check system health:', error.message);
            await this.handleSystemUnreachable();
        }
    }

    async evaluateThresholds(healthData) {
        const alerts = [];

        // Check response time
        if (healthData.response_time > this.config.alertThresholds.responseTime) {
            alerts.push({
                level: 'WARNING',
                type: 'PERFORMANCE',
                message: `High response time: ${healthData.response_time}ms`,
                threshold: this.config.alertThresholds.responseTime,
                current: healthData.response_time
            });
        }

        // Check memory usage
        const memoryUsagePercent = parseFloat(healthData.system.memory.usage_percent);
        if (memoryUsagePercent > this.config.alertThresholds.memoryUsage) {
            alerts.push({
                level: 'WARNING',
                type: 'RESOURCE',
                message: `High memory usage: ${memoryUsagePercent}%`,
                threshold: this.config.alertThresholds.memoryUsage,
                current: memoryUsagePercent
            });
        }

        // Check database status
        if (healthData.database.status !== 'healthy') {
            alerts.push({
                level: 'CRITICAL',
                type: 'DATABASE',
                message: `Database is unhealthy: ${healthData.database.status}`,
                current: healthData.database.status
            });
        }

        // Check overall system status
        if (healthData.status === 'unhealthy') {
            alerts.push({
                level: 'CRITICAL',
                type: 'SYSTEM',
                message: 'System is unhealthy',
                current: healthData.status
            });
        }

        // Process alerts
        for (const alert of alerts) {
            await this.processAlert(alert);
        }

        // If no critical alerts, log system health
        if (alerts.length === 0) {
            console.log('✅ System health: OK');
        }
    }

    async handleSystemUnreachable() {
        const alert = {
            level: 'CRITICAL',
            type: 'CONNECTIVITY',
            message: 'System is unreachable',
            timestamp: new Date().toISOString()
        };

        await this.processAlert(alert);
    }

    async processAlert(alert) {
        alert.timestamp = new Date().toISOString();
        alert.id = this.generateAlertId(alert);

        // Check cooldown period
        if (this.alertHistory.has(alert.id)) {
            const lastAlertTime = this.alertHistory.get(alert.id);
            const timeSinceLastAlert = Date.now() - lastAlertTime;

            if (timeSinceLastAlert < this.config.alertCooldown) {
                console.log(`⏸️ Alert cooldown active for: ${alert.message}`);
                return;
            }
        }

        // Send alert
        await this.sendAlert(alert);

        // Update alert history
        this.alertHistory.set(alert.id, Date.now());
        this.activeAlerts.add(alert.id);
    }

    generateAlertId(alert) {
        return `${alert.type}-${alert.level}-${alert.message.substring(0, 50)}`.replace(/[^a-zA-Z0-9-]/g, '-');
    }

    async sendAlert(alert) {
        const alertMessage = this.formatAlertMessage(alert);

        // Console output (always)
        console.log(`\n🚨 ALERT: ${alertMessage}`);

        // Log to file
        this.logToFile('alerts.log', JSON.stringify(alert));

        // In production, you would add:
        // - Email notifications
        // - Slack/Teams webhooks
        // - SMS alerts
        // - PagerDuty integration

        // Example: Send to external webhook
        await this.sendToWebhook(alert);
    }

    formatAlertMessage(alert) {
        const timestamp = new Date(alert.timestamp).toLocaleString();
        return `[${timestamp}] ${alert.level} - ${alert.type}: ${alert.message}`;
    }

    async sendToWebhook(alert) {
        // Placeholder for webhook integration
        // In production, you would send to services like:
        // - Slack
        // - Discord
        // - Microsoft Teams
        // - Custom webhook

        const webhookUrl = process.env.ALERT_WEBHOOK_URL;
        if (!webhookUrl) return;

        try {
            await axios.post(webhookUrl, {
                text: this.formatAlertMessage(alert),
                alert: alert
            });
        } catch (error) {
            console.error('Failed to send webhook alert:', error.message);
        }
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

    async startMonitoring() {
        console.log('🚀 Starting alerting system...');
        console.log(`   Monitoring URL: ${this.config.baseUrl}`);
        console.log(`   Check Interval: ${this.config.checkInterval / 1000}s`);
        console.log(`   Alert Cooldown: ${this.config.alertCooldown / 1000}s`);
        console.log('   Thresholds:');
        console.log(`     - Response Time: ${this.config.alertThresholds.responseTime}ms`);
        console.log(`     - Memory Usage: ${this.config.alertThresholds.memoryUsage}%`);
        console.log(`     - Consecutive Failures: ${this.config.alertThresholds.consecutiveFailures}`);

        // Run initial check
        await this.checkSystemHealth();

        // Set up interval for continuous monitoring
        setInterval(async () => {
            await this.checkSystemHealth();
        }, this.config.checkInterval);
    }

    // Method to manually trigger a check
    async runCheck() {
        console.log('🔍 Running manual health check...');
        await this.checkSystemHealth();
    }

    // Get alert statistics
    getAlertStats() {
        return {
            totalAlerts: this.alertHistory.size,
            activeAlerts: this.activeAlerts.size,
            lastAlert: this.alertHistory.size > 0 ?
                new Date(Math.max(...this.alertHistory.values())) : null
        };
    }
}

// CLI interface
const alertSystem = new AlertingSystem();

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'start':
        alertSystem.startMonitoring();
        break;
    case 'check':
    default:
        alertSystem.runCheck().then(() => process.exit(0));
        break;
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down alerting system...');
    const stats = alertSystem.getAlertStats();
    console.log(`   Total alerts sent: ${stats.totalAlerts}`);
    console.log(`   Active alerts: ${stats.activeAlerts}`);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Alerting system terminated');
    process.exit(0);
});

export default AlertingSystem;