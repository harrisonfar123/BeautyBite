import rateLimit from 'express-rate-limit';
import User from '../models/User.js';

// Security event types
const SECURITY_EVENT_TYPES = {
    AUTH_SUCCESS: 'AUTH_SUCCESS',
    AUTH_FAILED: 'AUTH_FAILED',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
    BRUTE_FORCE_ATTEMPT: 'BRUTE_FORCE_ATTEMPT',
    SQL_INJECTION_ATTEMPT: 'SQL_INJECTION_ATTEMPT',
    XSS_ATTEMPT: 'XSS_ATTEMPT',
    FILE_UPLOAD_VIOLATION: 'FILE_UPLOAD_VIOLATION',
    ACCESS_VIOLATION: 'ACCESS_VIOLATION',
    DATA_BREACH_ATTEMPT: 'DATA_BREACH_ATTEMPT'
};

// Security event storage (in production, this would be a database)
const securityEvents = new Map();
const suspiciousIPs = new Map();
const userSecurityProfiles = new Map();

// Security monitoring configuration
const SECURITY_CONFIG = {
    // Rate limiting thresholds
    MAX_LOGIN_ATTEMPTS: parseInt(process.env.SECURITY_MAX_LOGIN_ATTEMPTS) || 5,
    LOGIN_LOCKOUT_MINUTES: parseInt(process.env.SECURITY_LOGIN_LOCKOUT_MINUTES) || 15,

    // Suspicious activity thresholds
    SUSPICIOUS_REQUESTS_PER_MINUTE: 60,
    UNUSUAL_ACTIVITY_WINDOW: 5 * 60 * 1000, // 5 minutes

    // Monitoring intervals
    CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
    REPORTING_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
};

// Security event logger
class SecurityLogger {
    static logEvent(type, req, details = {}) {
        const event = {
            id: this.generateEventId(),
            type,
            timestamp: new Date().toISOString(),
            ip: this.getClientIP(req),
            userAgent: req.get('User-Agent'),
            method: req.method,
            url: req.url,
            userId: req.user ? req.user._id : 'anonymous',
            userRole: req.user ? req.user.role : 'anonymous',
            ...details
        };

        // Store event
        securityEvents.set(event.id, event);

        // Update suspicious IP tracking
        this.updateSuspiciousIPs(event);

        // Update user security profile
        if (req.user) {
            this.updateUserSecurityProfile(req.user._id, event);
        }

        // Log to console (in production, this would go to a security logging service)
        this.consoleLog(event);

        // Alert on critical events
        if (this.isCriticalEvent(event)) {
            this.alertSecurityTeam(event);
        }

        return event;
    }

    static generateEventId() {
        return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    static getClientIP(req) {
        return req.ip ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
            'unknown';
    }

    static updateSuspiciousIPs(event) {
        const ip = event.ip;
        if (!suspiciousIPs.has(ip)) {
            suspiciousIPs.set(ip, {
                firstSeen: event.timestamp,
                lastSeen: event.timestamp,
                eventCount: 0,
                eventTypes: new Set(),
                userIds: new Set()
            });
        }

        const ipData = suspiciousIPs.get(ip);
        ipData.lastSeen = event.timestamp;
        ipData.eventCount++;
        ipData.eventTypes.add(event.type);

        if (event.userId && event.userId !== 'anonymous') {
            ipData.userIds.add(event.userId);
        }

        suspiciousIPs.set(ip, ipData);
    }

    static updateUserSecurityProfile(userId, event) {
        if (!userSecurityProfiles.has(userId)) {
            userSecurityProfiles.set(userId, {
                userId,
                firstActivity: event.timestamp,
                lastActivity: event.timestamp,
                totalEvents: 0,
                eventTypes: new Set(),
                ips: new Set(),
                suspiciousActivityCount: 0
            });
        }

        const profile = userSecurityProfiles.get(userId);
        profile.lastActivity = event.timestamp;
        profile.totalEvents++;
        profile.eventTypes.add(event.type);
        profile.ips.add(event.ip);

        if (this.isSuspiciousEvent(event)) {
            profile.suspiciousActivityCount++;
        }

        userSecurityProfiles.set(userId, profile);
    }

    static consoleLog(event) {
        const logLevel = this.getLogLevel(event.type);
        const message = `SECURITY_${logLevel}: ${event.type} - IP: ${event.ip} - User: ${event.userId} - URL: ${event.method} ${event.url}`;

        if (logLevel === 'ERROR' || logLevel === 'WARN') {
            console.error(message, event);
        } else {
            console.log(message, event);
        }
    }

    static getLogLevel(eventType) {
        const errorEvents = [
            SECURITY_EVENT_TYPES.BRUTE_FORCE_ATTEMPT,
            SECURITY_EVENT_TYPES.SQL_INJECTION_ATTEMPT,
            SECURITY_EVENT_TYPES.XSS_ATTEMPT,
            SECURITY_EVENT_TYPES.DATA_BREACH_ATTEMPT
        ];

        const warnEvents = [
            SECURITY_EVENT_TYPES.RATE_LIMIT_EXCEEDED,
            SECURITY_EVENT_TYPES.SUSPICIOUS_ACTIVITY,
            SECURITY_EVENT_TYPES.FILE_UPLOAD_VIOLATION,
            SECURITY_EVENT_TYPES.ACCESS_VIOLATION
        ];

        if (errorEvents.includes(eventType)) return 'ERROR';
        if (warnEvents.includes(eventType)) return 'WARN';
        return 'INFO';
    }

    static isCriticalEvent(event) {
        const criticalEvents = [
            SECURITY_EVENT_TYPES.BRUTE_FORCE_ATTEMPT,
            SECURITY_EVENT_TYPES.SQL_INJECTION_ATTEMPT,
            SECURITY_EVENT_TYPES.DATA_BREACH_ATTEMPT
        ];
        return criticalEvents.includes(event.type);
    }

    static isSuspiciousEvent(event) {
        const suspiciousEvents = [
            SECURITY_EVENT_TYPES.RATE_LIMIT_EXCEEDED,
            SECURITY_EVENT_TYPES.SUSPICIOUS_ACTIVITY,
            SECURITY_EVENT_TYPES.FILE_UPLOAD_VIOLATION,
            SECURITY_EVENT_TYPES.ACCESS_VIOLATION,
            SECURITY_EVENT_TYPES.XSS_ATTEMPT
        ];
        return suspiciousEvents.includes(event.type);
    }

    static alertSecurityTeam(event) {
        // In production, this would send an email, Slack message, or trigger a pager
        console.error(`🚨 SECURITY ALERT: ${event.type}`, {
            ip: event.ip,
            userId: event.userId,
            timestamp: event.timestamp,
            details: event
        });
    }
}

// Security monitoring middleware
const securityMonitor = (req, res, next) => {
    // Ignore CORS preflight to avoid false positives and unnecessary processing
    if (req.method === 'OPTIONS') return next();

    const clientIP = SecurityLogger.getClientIP(req);

    // Check for common attack patterns
    checkForSuspiciousActivity(req, clientIP);

    // Monitor request patterns
    monitorRequestPatterns(req, clientIP);

    // Check for data exfiltration attempts
    checkDataExfiltration(req);

    next();
};

// Suspicious activity detection
function checkForSuspiciousActivity(req, clientIP) {
    const { method, url, headers, body } = req;

    // Check for SQL injection patterns
    if (containsSQLInjection(url) || containsSQLInjection(JSON.stringify(body))) {
        SecurityLogger.logEvent(SECURITY_EVENT_TYPES.SQL_INJECTION_ATTEMPT, req, {
            detectedPattern: 'SQL Injection',
            url,
            body: JSON.stringify(body).substring(0, 500)
        });
    }

    // Check for XSS patterns
    if (containsXSS(url) || containsXSS(JSON.stringify(body))) {
        SecurityLogger.logEvent(SECURITY_EVENT_TYPES.XSS_ATTEMPT, req, {
            detectedPattern: 'XSS Attempt',
            url,
            body: JSON.stringify(body).substring(0, 500)
        });
    }

    // Check for suspicious headers
    checkSuspiciousHeaders(req, clientIP);

    // Check for unusual user agents
    checkSuspiciousUserAgent(req, clientIP);
}

function containsSQLInjection(input) {
    if (!input) return false;

    const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|ALTER|CREATE|TRUNCATE)\b)/i,
        /('|"|;|--|\/\*|\*\/)/,
        /(\b(OR|AND)\b.*=)/i,
        /(\b(WAITFOR|DELAY)\b)/i
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
}

function containsXSS(input) {
    if (!input) return false;

    const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe/gi,
        /<object/gi,
        /<embed/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
}

function checkSuspiciousHeaders(req, clientIP) {
    const suspiciousHeaders = {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'cf-connecting-ip': req.headers['cf-connecting-ip']
    };

    Object.entries(suspiciousHeaders).forEach(([header, value]) => {
        if (value && value.includes(',')) {
            const ips = value.split(',').map(ip => ip.trim());
            if (ips.length > 3) {
                SecurityLogger.logEvent(SECURITY_EVENT_TYPES.SUSPICIOUS_ACTIVITY, req, {
                    reason: 'Suspicious proxy chain',
                    header,
                    ipChain: ips,
                    clientIP
                });
            }
        }
    });
}

function checkSuspiciousUserAgent(req, clientIP) {
    const userAgent = req.get('User-Agent') || '';

    const suspiciousPatterns = [
        /(bot|crawler|scanner|spider|nmap|sqlmap|metasploit|burp|wget|curl)/i,
        /(python|java|go|ruby|perl|php)\//i,
        /(\\x[0-9a-f]{2})/i // Hex encoded characters
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
        SecurityLogger.logEvent(SECURITY_EVENT_TYPES.SUSPICIOUS_ACTIVITY, req, {
            reason: 'Suspicious User-Agent',
            userAgent,
            clientIP
        });
    }
}

// Request pattern monitoring
function monitorRequestPatterns(req, clientIP) {
    const now = Date.now();
    const ipData = suspiciousIPs.get(clientIP) || { requestCount: 0, firstRequest: now, lastRequest: now };

    ipData.requestCount = (ipData.requestCount || 0) + 1;
    ipData.lastRequest = now;

    if (!ipData.firstRequest) {
        ipData.firstRequest = now;
    }

    // Check for rapid request patterns (potential DoS)
    const timeWindow = now - ipData.firstRequest;
    const requestsPerMinute = (ipData.requestCount / (timeWindow / 60000));

    if (requestsPerMinute > SECURITY_CONFIG.SUSPICIOUS_REQUESTS_PER_MINUTE) {
        SecurityLogger.logEvent(SECURITY_EVENT_TYPES.SUSPICIOUS_ACTIVITY, req, {
            reason: 'High request rate',
            requestsPerMinute: Math.round(requestsPerMinute),
            totalRequests: ipData.requestCount,
            clientIP
        });
    }

    suspiciousIPs.set(clientIP, ipData);
}

// Data exfiltration detection
function checkDataExfiltration(req) {
    const { method, url, body } = req;

    // Check for large data exports
    if (method === 'GET' && url.includes('/api/') && (url.includes('export') || url.includes('download'))) {
        SecurityLogger.logEvent(SECURITY_EVENT_TYPES.DATA_BREACH_ATTEMPT, req, {
            reason: 'Data export request',
            endpoint: url
        });
    }

    // Check for sensitive data in requests
    if (body) {
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'ssn', 'creditcard'];
        const bodyStr = JSON.stringify(body).toLowerCase();

        sensitiveFields.forEach(field => {
            if (bodyStr.includes(field) && bodyStr.length > 1000) {
                SecurityLogger.logEvent(SECURITY_EVENT_TYPES.DATA_BREACH_ATTEMPT, req, {
                    reason: 'Large request with sensitive fields',
                    sensitiveField: field,
                    requestSize: bodyStr.length
                });
            }
        });
    }
}

// Security reporting functions
const getSecurityReport = () => {
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    const recentEvents = Array.from(securityEvents.values())
        .filter(event => new Date(event.timestamp) > oneHourAgo);

    const dailyEvents = Array.from(securityEvents.values())
        .filter(event => new Date(event.timestamp) > oneDayAgo);

    const eventCounts = {};
    dailyEvents.forEach(event => {
        eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
    });

    return {
        timestamp: now.toISOString(),
        summary: {
            totalEvents: securityEvents.size,
            recentEvents: recentEvents.length,
            suspiciousIPs: suspiciousIPs.size,
            monitoredUsers: userSecurityProfiles.size
        },
        eventBreakdown: eventCounts,
        topSuspiciousIPs: Array.from(suspiciousIPs.entries())
            .sort((a, b) => b[1].eventCount - a[1].eventCount)
            .slice(0, 10)
            .map(([ip, data]) => ({
                ip,
                eventCount: data.eventCount,
                eventTypes: Array.from(data.eventTypes),
                lastSeen: data.lastSeen
            })),
        recentCriticalEvents: recentEvents
            .filter(event => SecurityLogger.isCriticalEvent(event))
            .slice(0, 5)
    };
};

// Cleanup old data
setInterval(() => {
    const now = new Date();
    const retentionPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days

    // Clean old security events
    for (const [id, event] of securityEvents.entries()) {
        if (now - new Date(event.timestamp) > retentionPeriod) {
            securityEvents.delete(id);
        }
    }

    // Clean old IP data
    for (const [ip, data] of suspiciousIPs.entries()) {
        if (now - new Date(data.lastSeen) > retentionPeriod) {
            suspiciousIPs.delete(ip);
        }
    }

    // Clean old user profiles
    for (const [userId, profile] of userSecurityProfiles.entries()) {
        if (now - new Date(profile.lastActivity) > retentionPeriod) {
            userSecurityProfiles.delete(userId);
        }
    }
}, SECURITY_CONFIG.CLEANUP_INTERVAL);

// Export everything
export {
    securityMonitor,
    SecurityLogger,
    SECURITY_EVENT_TYPES,
    getSecurityReport,
    securityEvents,
    suspiciousIPs,
    userSecurityProfiles
};