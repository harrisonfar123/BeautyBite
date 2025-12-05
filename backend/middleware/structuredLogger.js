import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Safe header retrieval tolerant of non-Express req objects
 */
function getHeader(req, name) {
    try {
        return req?.get?.(name) ?? req?.headers?.[String(name).toLowerCase()];
    } catch {
        return undefined;
    }
}

/**
 * Extract a whitelisted subset of HTTP request metadata
 */
function pickReqMeta(req) {
    if (!req || typeof req !== 'object') return undefined;
    const url = req.originalUrl || req.url;
    const ip = req.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress;
    const httpVersion = req.httpVersion;
    const method = req.method;
    const userAgent = getHeader(req, 'user-agent');
    const referer = getHeader(req, 'referer') ?? getHeader(req, 'referrer');
    const meta = {
        method,
        url,
        httpVersion,
        ip,
        userAgent,
        referer
    };
    // Remove undefineds
    Object.keys(meta).forEach(k => meta[k] === undefined && delete meta[k]);
    return Object.keys(meta).length ? meta : undefined;
}

/**
 * Extract a whitelisted subset of HTTP response metadata
 */
function pickResMeta(res) {
    if (!res || typeof res !== 'object') return undefined;
    const statusCode = res?.statusCode;
    let contentLength;
    try {
        contentLength = res?.getHeader?.('content-length') ?? res?.getHeaders?.()?.['content-length'];
    } catch {
        contentLength = undefined;
    }
    const meta = {
        statusCode,
        contentLength: contentLength !== undefined ? contentLength : undefined
    };
    Object.keys(meta).forEach(k => meta[k] === undefined && delete meta[k]);
    return Object.keys(meta).length ? meta : undefined;
}

/**
 * Redact sensitive values by key name
 */
function redactValue(key, val) {
    const k = String(key).toLowerCase();
    const sensitiveKeys = new Set([
        'password', 'pass', 'pwd', 'token', 'authorization', 'auth', 'apikey', 'api_key', 'secret'
    ]);
    if (sensitiveKeys.has(k)) return '[REDACTED]';
    // Also redact likely bearer tokens in headers-like keys
    if ((k.includes('token') || k.includes('secret') || k.includes('auth') || k.includes('key'))) {
        return '[REDACTED]';
    }
    return val;
}

/**
 * Cycle-safe, depth-limited JSON stringify with redaction
 */
function safeStringify(obj, opts = {}) {
    const maxDepth = Number.isFinite(opts.maxDepth) ? opts.maxDepth : 3;
    const maxLen = Number.isFinite(opts.maxLen) ? opts.maxLen : 10_000;
    const seen = new WeakSet();

    const build = (value, depth) => {
        try {
            if (value === null || value === undefined) return value;
            const t = typeof value;

            if (t === 'string' || t === 'number' || t === 'boolean') return value;
            if (t === 'function') return '[Function]';

            // Handle Buffers
            if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
                return `[Buffer len=${value.length}]`;
            }

            // Prevent circular refs
            if (t === 'object') {
                if (seen.has(value)) return '[Circular]';
                seen.add(value);

                // Depth limiting
                if (depth >= maxDepth) return '[MaxDepth]';

                // Avoid embedding raw req/res/socket objects
                const looksLikeReq = value && (value.method && value.url && (value.headers || value.socket));
                const looksLikeRes = value && (value.statusCode !== undefined && (value.getHeader || value.socket));
                if (looksLikeReq) return pickReqMeta(value) ?? '[Request]';
                if (looksLikeRes) return pickResMeta(value) ?? '[Response]';

                if (Array.isArray(value)) {
                    return value.map((v) => build(v, depth + 1));
                }

                const out = {};
                for (const [k, v] of Object.entries(value)) {
                    const redacted = redactValue(k, v);
                    if (redacted === '[REDACTED]') {
                        out[k] = '[REDACTED]';
                        continue;
                    }
                    out[k] = build(v, depth + 1);
                }
                return out;
            }

            // Fallback for symbols/bigints
            return String(value);
        } catch {
            return '[Unserializable]';
        }
    };

    try {
        const safeObj = build(obj, 0);
        let str = JSON.stringify(safeObj);
        if (str.length > maxLen) {
            // Return a compact JSON string token when too large
            str = JSON.stringify('[Truncated]');
        }
        return str;
    } catch {
        return '"[Unserializable]"';
    }
}

/**
 * Sanitize arbitrary context objects, shallowly cloning and avoiding req/res
 */
function safeContext(ctx) {
    if (ctx === null || typeof ctx !== 'object') return ctx;
    try {
        // Avoid embedding request/response/socket
        const isReq = ctx && (ctx.method && (ctx.url || ctx.originalUrl) && (ctx.headers || ctx.socket));
        const isRes = ctx && (ctx.statusCode !== undefined && (ctx.getHeader || ctx.socket));
        if (isReq || isRes) return undefined;

        if (Array.isArray(ctx)) {
            return ctx.map((item) => {
                if (item !== null && typeof item === 'object') {
                    try { return JSON.parse(safeStringify(item)); } catch { return '[Unserializable]'; }
                }
                return item;
            });
        }

        const out = {};
        for (const [k, v] of Object.entries(ctx)) {
            if (v && typeof v === 'object') {
                const maybeReq = v && (v.method && (v.url || v.originalUrl) && (v.headers || v.socket));
                const maybeRes = v && (v.statusCode !== undefined && (v.getHeader || v.socket));
                if (maybeReq || maybeRes) {
                    // skip raw req/res
                    continue;
                }
                const redacted = redactValue(k, v);
                if (redacted === '[REDACTED]') {
                    out[k] = '[REDACTED]';
                    continue;
                }
                try {
                    out[k] = JSON.parse(safeStringify(v));
                } catch {
                    out[k] = '[Unserializable]';
                }
            } else {
                const redacted = redactValue(k, v);
                out[k] = redacted === '[REDACTED]' ? '[REDACTED]' : v;
            }
        }
        return out;
    } catch {
        return undefined;
    }
}

// Log levels
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

class StructuredLogger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'INFO';
        this.logDir = path.join(__dirname, '../logs');
        this.setupLogDirectory();
    }

    setupLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getLogFilePath(type = 'app') {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.logDir, `${type}-${date}.log`);
    }

    shouldLog(level) {
        const currentLevel = LOG_LEVELS[this.logLevel.toUpperCase()] || LOG_LEVELS.INFO;
        const messageLevel = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
        return messageLevel <= currentLevel;
    }

    formatLogEntry(level, message, meta = {}) {
        // Must never throw; always return a string
        try {
            const ts = new Date().toISOString();

            // Whitelisted http metadata only
            const httpReq = pickReqMeta(meta?.req);
            const httpRes = pickResMeta(meta?.res);
            const http = Object.assign({}, httpReq || {}, httpRes || {});

            // Optional user info (sanitized)
            const user = meta?.user ? {
                id: meta.user.id || meta.user._id || undefined,
                role: meta.user.role || undefined
            } : undefined;

            // Optional error details (safe)
            let error;
            if (meta?.error) {
                if (meta.error instanceof Error) {
                    error = {
                        name: meta.error.name,
                        message: meta.error.message,
                        stack: meta.error.stack
                    };
                } else {
                    // Normalize non-Error error-like objects safely
                    const errObj = {
                        name: meta.error.name,
                        message: meta.error.message,
                        stack: meta.error.stack
                    };
                    try {
                        error = JSON.parse(safeStringify(errObj));
                    } catch {
                        error = { message: '[Unserializable error]' };
                    }
                }
            }

            // Build safe context: prefer meta.context; otherwise shallow copy of meta excluding reserved keys
            const reserved = new Set(['req', 'res', 'route', 'durationMs', 'user', 'error', 'message', 'level']);
            let rawContext = meta?.context;
            if (rawContext === undefined) {
                const clone = {};
                for (const [k, v] of Object.entries(meta || {})) {
                    if (!reserved.has(k)) clone[k] = v;
                }
                rawContext = clone;
            }
            const context = rawContext !== undefined ? (() => {
                try { return JSON.parse(safeStringify(safeContext(rawContext))); } catch { return undefined; }
            })() : undefined;

            const entry = {
                ts,
                level: (meta?.level || level || 'INFO').toString().toUpperCase(),
                message: meta?.message || message || '',
                http: (http && Object.keys(http).length) ? http : undefined,
                route: meta?.route || undefined,
                durationMs: Number.isFinite(meta?.durationMs) ? meta.durationMs : undefined,
                user,
                error,
                context
            };

            // Strip undefined keys
            Object.keys(entry).forEach(k => entry[k] === undefined && delete entry[k]);

            // Return serialized safely (avoid circulars and raw req/res)
            return safeStringify(entry);
        } catch (e) {
            try {
                return JSON.stringify({
                    ts: new Date().toISOString(),
                    level: (meta?.level || level || 'INFO').toString().toUpperCase(),
                    message: 'Logger formatting failure',
                    err: String(e && e.message ? e.message : e)
                });
            } catch {
                return '{"ts":"' + new Date().toISOString() + '","level":"INFO","message":"Logger formatting failure"}';
            }
        }
    }

    writeToFile(type, logEntry) {
        const filePath = this.getLogFilePath(type);
        fs.appendFileSync(filePath, logEntry + '\n');
    }

    log(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;

        let logEntry;
        try {
            logEntry = this.formatLogEntry(level, message, meta);
        } catch (e) {
            // Defensive fallback; never crash
            logEntry = JSON.stringify({
                ts: new Date().toISOString(),
                level: (level || 'INFO').toUpperCase(),
                message: 'Logger formatting failure',
                err: String(e && e.message ? e.message : e)
            });
        }

        try {
            // Write to files without throwing
            this.writeToFile('app', logEntry);
            if ((level || '').toLowerCase() === 'error') {
                this.writeToFile('error', logEntry);
            }
        } catch (e) {
            // Do not crash on file write issues
            try { console.error('Logger file write failure:', String(e && e.message ? e.message : e)); } catch { /* noop */ }
        }

        // Console output in development: emit the structured line only
        if (process.env.NODE_ENV !== 'production') {
            const lvl = (level || '').toLowerCase();
            const method = lvl === 'error' ? 'error' : (lvl === 'warn' ? 'warn' : 'log');
            try { console[method](logEntry); } catch { console.log(logEntry); }
        }
    }

    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }

    // HTTP request logging middleware
    getHttpLogger() {
        return morgan((tokens, req, res) => {
            const response_time_raw = tokens['response-time'](req, res);
            const response_time_ms = response_time_raw != null ? Number.parseFloat(response_time_raw) : undefined;

            const logData = {
                method: tokens.method(req, res),
                url: tokens.url(req, res),
                status: tokens.status(req, res),
                response_time_ms,
                content_length: tokens.res(req, res, 'content-length'),
                ip: req?.ip || req?.connection?.remoteAddress,
                user_agent: getHeader(req, 'user-agent'),
                referer: getHeader(req, 'referer') ?? getHeader(req, 'referrer'),
                user_id: req?.user ? (req.user._id || req.user.id) : 'anonymous'
            };

            const level = res?.statusCode >= 400 ? 'warn' : 'info';

            // Pass req/res; formatter will safely pick only whitelisted meta
            this.log(level, 'HTTP Request', {
                req,
                res,
                durationMs: response_time_ms,
                context: logData
            });

            return `${logData.method} ${logData.url} ${logData.status} - ${response_time_ms}ms`;
        });
    }

    // Performance monitoring middleware
    performanceMonitor() {
        return (req, res, next) => {
            const startTime = Date.now();

            // Monitor memory before request
            const memoryBefore = process.memoryUsage();

            res.on('finish', () => {
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                const memoryAfter = process.memoryUsage();

                const performanceData = {
                    response_time: responseTime,
                    memory_usage: {
                        heap_used: memoryAfter.heapUsed - memoryBefore.heapUsed,
                        heap_total: memoryAfter.heapTotal - memoryBefore.heapTotal,
                        external: memoryAfter.external - memoryBefore.external
                    },
                    url: req.url,
                    method: req.method,
                    status_code: res.statusCode
                };

                // Log slow requests
                if (responseTime > 1000) {
                    this.warn('Slow request detected', performanceData);
                }

                // Log high memory usage
                if (performanceData.memory_usage.heap_used > 50 * 1024 * 1024) { // 50MB
                    this.warn('High memory usage detected', performanceData);
                }

                this.debug('Request performance', performanceData);
            });

            next();
        };
    }

    // Error tracking middleware
    errorTracker() {
        return (err, req, res, next) => {
            this.error('Unhandled error', {
                error: err,
                req
            });

            next(err);
        };
    }

    // Get log statistics
    getLogStats() {
        const stats = {
            total_size: 0,
            file_count: 0,
            error_count: 0,
            warn_count: 0,
            info_count: 0
        };

        try {
            const files = fs.readdirSync(this.logDir);
            stats.file_count = files.length;

            files.forEach(file => {
                const filePath = path.join(this.logDir, file);
                const fileStats = fs.statSync(filePath);
                stats.total_size += fileStats.size;

                // Count log levels in current day's app log
                if (file.startsWith('app-')) {
                    const logContent = fs.readFileSync(filePath, 'utf8');
                    stats.error_count += (logContent.match(/"level":"ERROR"/g) || []).length;
                    stats.warn_count += (logContent.match(/"level":"WARN"/g) || []).length;
                    stats.info_count += (logContent.match(/"level":"INFO"/g) || []).length;
                }
            });

            stats.total_size_mb = (stats.total_size / 1024 / 1024).toFixed(2);
        } catch (error) {
            this.error('Failed to get log statistics', { error: error.message });
        }

        return stats;
    }

    // Rotate logs (to be called periodically)
    rotateLogs() {
        const files = fs.readdirSync(this.logDir);
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

        files.forEach(file => {
            const filePath = path.join(this.logDir, file);
            const fileStats = fs.statSync(filePath);

            if (now - fileStats.mtime.getTime() > maxAge) {
                fs.unlinkSync(filePath);
                this.info('Rotated old log file', { file });
            }
        });
    }
}

// Create singleton instance
const logger = new StructuredLogger();

// Export for use in other modules
export default logger;

// Export middleware functions
export const httpLogger = logger.getHttpLogger();
export const performanceMonitor = logger.performanceMonitor();
export const errorTracker = logger.errorTracker();