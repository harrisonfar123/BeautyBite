import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import rateLimit from 'express-rate-limit';

// Security event tracking
const securityEvents = new Map();
const failedAttempts = new Map();
const IP_BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

// Clean up old security events periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, event] of securityEvents.entries()) {
        if (now - event.timestamp > 24 * 60 * 60 * 1000) { // 24 hours
            securityEvents.delete(key);
        }
    }
    for (const [ip, data] of failedAttempts.entries()) {
        if (now - data.lastAttempt > IP_BLOCK_DURATION) {
            failedAttempts.delete(ip);
        }
    }
}, 60 * 60 * 1000); // Run every hour

// Security event logging
const logSecurityEvent = (type, req, details = {}) => {
    const event = {
        type,
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.url,
        userId: req.user ? req.user._id : 'anonymous',
        ...details
    };

    const eventKey = `${event.ip}-${event.timestamp}`;
    securityEvents.set(eventKey, event);

    // Log security events to console (in production, this would go to a security log)
    console.log(`SECURITY_EVENT: ${type}`, {
        ip: event.ip,
        userId: event.userId,
        method: event.method,
        url: event.url,
        ...details
    });

    return event;
};

// Check if IP is blocked
const isIPBlocked = (ip) => {
    const data = failedAttempts.get(ip);
    if (!data) return false;

    if (Date.now() - data.lastAttempt > IP_BLOCK_DURATION) {
        failedAttempts.delete(ip);
        return false;
    }

    return data.count >= MAX_FAILED_ATTEMPTS;
};

// Record failed authentication attempt
const recordFailedAttempt = (ip, userId = 'unknown') => {
    const now = Date.now();
    const data = failedAttempts.get(ip) || { count: 0, lastAttempt: now, userIds: new Set() };

    data.count++;
    data.lastAttempt = now;
    data.userIds.add(userId);

    failedAttempts.set(ip, data);

    logSecurityEvent('AUTH_FAILED_ATTEMPT', { ip }, {
        attemptCount: data.count,
        userId,
        blocked: data.count >= MAX_FAILED_ATTEMPTS
    });

    return data.count;
};

// Clear failed attempts for IP (on successful authentication)
const clearFailedAttempts = (ip) => {
    failedAttempts.delete(ip);
};

// Enhanced authentication middleware with security features
const authenticate = async (req, res, next) => {
    try {
        const clientIP = req.ip || req.connection.remoteAddress;

        // Check if IP is blocked
        if (isIPBlocked(clientIP)) {
            logSecurityEvent('IP_BLOCKED_ACCESS_ATTEMPT', req, {
                reason: 'Too many failed authentication attempts',
                ip: clientIP
            });

            return res.status(429).json({
                success: false,
                error: 'Too many failed authentication attempts. Please try again in 15 minutes.'
            });
        }

        let token;

        // Check for token in Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        // Also check for token in cookies (for web clients)
        if (!token && req.cookies && req.cookies.access_token) {
            token = req.cookies.access_token;
        }

        if (!token) {
            recordFailedAttempt(clientIP);
            logSecurityEvent('MISSING_TOKEN', req, { ip: clientIP });

            return res.status(401).json({
                success: false,
                error: 'Access denied. No token provided.'
            });
        }

        try {
            // Verify token with additional security checks
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', {
                clockTolerance: 30, // 30 seconds tolerance for clock skew
                maxAge: '30d' // Ensure token isn't too old
            });

            // Additional token validation
            if (!decoded.id || !decoded.iat) {
                recordFailedAttempt(clientIP);
                logSecurityEvent('INVALID_TOKEN_PAYLOAD', req, { ip: clientIP, decoded });

                return res.status(401).json({
                    success: false,
                    error: 'Invalid token structure.'
                });
            }

            // Get user from token
            const user = await User.findById(decoded.id).select('-password');

            if (!user) {
                recordFailedAttempt(clientIP);
                logSecurityEvent('USER_NOT_FOUND', req, { ip: clientIP, userId: decoded.id });

                return res.status(401).json({
                    success: false,
                    error: 'Invalid token. User not found.'
                });
            }

            if (!user.isActive) {
                recordFailedAttempt(clientIP, user._id.toString());
                logSecurityEvent('INACTIVE_ACCOUNT_ACCESS', req, {
                    ip: clientIP,
                    userId: user._id
                });

                return res.status(401).json({
                    success: false,
                    error: 'Account deactivated. Please contact support.'
                });
            }

            // Check if user needs to re-authenticate (password changed after token issued)
            if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt.getTime() / 1000) {
                recordFailedAttempt(clientIP, user._id.toString());
                logSecurityEvent('STALE_TOKEN', req, {
                    ip: clientIP,
                    userId: user._id,
                    tokenIssuedAt: decoded.iat,
                    passwordChangedAt: user.passwordChangedAt
                });

                return res.status(401).json({
                    success: false,
                    error: 'Password has been changed. Please login again.'
                });
            }

            // Clear failed attempts on successful authentication
            clearFailedAttempts(clientIP);

            req.user = user;

            // Log successful authentication
            logSecurityEvent('AUTH_SUCCESS', req, {
                userId: user._id,
                userRole: user.role
            });

            next();
        } catch (error) {
            const userId = error.name === 'TokenExpiredError' ? 'expired' : 'invalid';
            recordFailedAttempt(clientIP, userId);

            logSecurityEvent('TOKEN_VERIFICATION_FAILED', req, {
                ip: clientIP,
                error: error.name,
                message: error.message
            });

            let errorMessage = 'Invalid token.';
            if (error.name === 'TokenExpiredError') {
                errorMessage = 'Token expired. Please login again.';
            } else if (error.name === 'JsonWebTokenError') {
                errorMessage = 'Invalid token signature.';
            }

            return res.status(401).json({
                success: false,
                error: errorMessage
            });
        }
    } catch (error) {
        logSecurityEvent('AUTH_MIDDLEWARE_ERROR', req, {
            error: error.message,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
        next(error);
    }
};

// Authorization middleware for roles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required.'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `User role '${req.user.role}' is not authorized to access this resource.`
            });
        }

        next();
    };
};

// Optional authentication middleware (doesn't throw error if no token)
const optionalAuth = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id).select('-password');

                if (user && user.isActive) {
                    req.user = user;
                }
            } catch (error) {
                // Token is invalid but we don't throw error for optional auth
                console.log('Optional auth: Invalid token, continuing without user');
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};

// Enhanced refresh token authentication with security features
const authenticateRefresh = async (req, res, next) => {
    try {
        const clientIP = req.ip || req.connection.remoteAddress;

        // Check if IP is blocked for refresh attempts
        if (isIPBlocked(clientIP)) {
            logSecurityEvent('REFRESH_TOKEN_BLOCKED', req, {
                reason: 'Too many failed refresh attempts',
                ip: clientIP
            });

            return res.status(429).json({
                success: false,
                error: 'Too many failed refresh attempts. Please try again in 15 minutes.'
            });
        }

        let refreshToken = req.body.refreshToken;

        // Also check for refresh token in cookies
        if (!refreshToken && req.cookies && req.cookies.refresh_token) {
            refreshToken = req.cookies.refresh_token;
        }

        if (!refreshToken) {
            recordFailedAttempt(clientIP);
            logSecurityEvent('MISSING_REFRESH_TOKEN', req, { ip: clientIP });

            return res.status(401).json({
                success: false,
                error: 'Refresh token required.'
            });
        }

        try {
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret', {
                clockTolerance: 30,
                maxAge: '7d'
            });

            const user = await User.findById(decoded.id).select('-password');

            if (!user) {
                recordFailedAttempt(clientIP);
                logSecurityEvent('INVALID_REFRESH_TOKEN_USER', req, {
                    ip: clientIP,
                    userId: decoded.id
                });

                return res.status(401).json({
                    success: false,
                    error: 'Invalid refresh token.'
                });
            }

            if (!user.isActive) {
                recordFailedAttempt(clientIP, user._id.toString());
                logSecurityEvent('INACTIVE_ACCOUNT_REFRESH', req, {
                    ip: clientIP,
                    userId: user._id
                });

                return res.status(401).json({
                    success: false,
                    error: 'Account deactivated.'
                });
            }

            // Clear failed attempts on successful refresh
            clearFailedAttempts(clientIP);

            req.user = user;

            logSecurityEvent('REFRESH_TOKEN_SUCCESS', req, {
                userId: user._id
            });

            next();
        } catch (error) {
            recordFailedAttempt(clientIP);

            logSecurityEvent('REFRESH_TOKEN_FAILED', req, {
                ip: clientIP,
                error: error.name,
                message: error.message
            });

            let errorMessage = 'Invalid refresh token.';
            if (error.name === 'TokenExpiredError') {
                errorMessage = 'Refresh token expired. Please login again.';
            }

            return res.status(401).json({
                success: false,
                error: errorMessage
            });
        }
    } catch (error) {
        logSecurityEvent('REFRESH_MIDDLEWARE_ERROR', req, {
            error: error.message,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
        next(error);
    }
};

// Enhanced ownership middleware with security logging
const checkOwnership = (model, paramName = 'id') => {
    return async (req, res, next) => {
        try {
            const resourceId = req.params[paramName];
            const userId = req.user._id;

            const resource = await model.findById(resourceId);

            if (!resource) {
                logSecurityEvent('RESOURCE_NOT_FOUND', req, {
                    resourceId,
                    model: model.modelName,
                    paramName
                });

                return res.status(404).json({
                    success: false,
                    error: 'Resource not found.'
                });
            }

            let hasOwnership = false;
            let ownershipField = '';

            // Check if user owns the resource or is admin
            if (resource.userId && resource.userId.toString() === userId.toString()) {
                hasOwnership = true;
                ownershipField = 'userId';
            } else if (resource.user && resource.user.toString() === userId.toString()) {
                hasOwnership = true;
                ownershipField = 'user';
            } else if (req.user.role === 'admin') {
                hasOwnership = true;
                ownershipField = 'admin';
            }

            if (!hasOwnership) {
                logSecurityEvent('UNAUTHORIZED_RESOURCE_ACCESS', req, {
                    resourceId,
                    resourceOwner: resource.userId || resource.user,
                    requestingUser: userId,
                    model: model.modelName,
                    userRole: req.user.role
                });

                return res.status(403).json({
                    success: false,
                    error: 'Access denied. You do not own this resource.'
                });
            }

            req.resource = resource;

            logSecurityEvent('RESOURCE_ACCESS_GRANTED', req, {
                resourceId,
                ownershipField,
                userRole: req.user.role
            });

            next();
        } catch (error) {
            logSecurityEvent('OWNERSHIP_CHECK_ERROR', req, {
                resourceId: req.params[paramName],
                error: error.message
            });
            next(error);
        }
    };
};

// Security monitoring middleware
const securityMonitor = (req, res, next) => {
    // Monitor for suspicious activity
    const suspiciousHeaders = [
        'x-forwarded-for',
        'x-real-ip',
        'cf-connecting-ip'
    ];

    const suspiciousIPs = req.ips || [];
    if (suspiciousIPs.length > 3) {
        logSecurityEvent('SUSPICIOUS_PROXY_CHAIN', req, {
            ipChain: suspiciousIPs,
            headerCount: suspiciousIPs.length
        });
    }

    // Check for common attack patterns in headers
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.includes('bot') || userAgent.includes('crawler') || userAgent.includes('scanner')) {
        logSecurityEvent('SUSPICIOUS_USER_AGENT', req, {
            userAgent
        });
    }

    next();
};

// Get security stats (for monitoring dashboard)
const getSecurityStats = () => {
    return {
        totalSecurityEvents: securityEvents.size,
        blockedIPs: Array.from(failedAttempts.entries()).filter(([ip, data]) => data.count >= MAX_FAILED_ATTEMPTS).length,
        failedAttempts: Array.from(failedAttempts.entries()).reduce((sum, [ip, data]) => sum + data.count, 0),
        recentEvents: Array.from(securityEvents.values())
            .slice(-10)
            .map(event => ({
                type: event.type,
                timestamp: event.timestamp,
                ip: event.ip,
                method: event.method,
                url: event.url
            }))
    };
};

export {
    authenticate,
    authorize,
    optionalAuth,
    authenticateRefresh,
    checkOwnership,
    securityMonitor,
    getSecurityStats,
    logSecurityEvent,
    recordFailedAttempt,
    clearFailedAttempts
};