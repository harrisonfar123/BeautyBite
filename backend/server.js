import express from 'express';
import mongoose from 'mongoose';
import cors from './middleware/cors.js';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import cookieParser from 'cookie-parser';
import { securityMonitor } from './middleware/securityMonitor.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import productRoutes from './routes/products.js';
import designRoutes from './routes/designs.js';
import orderRoutes from './routes/orders.js';
import subscriptionRoutes from './routes/subscriptions.js';
import paymentRoutes from './routes/payments.js';
import healthRoutes from './routes/health.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { httpLogger, performanceMonitor, errorTracker } from './middleware/structuredLogger.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * CORS - allow frontend dev origins and handle preflight early
 * Must be registered BEFORE any security/rate-limiting middleware and routes.
 */
const allowedOrigins = ['http://localhost:8080', 'http://127.0.0.1:8080'];
app.use(cors(allowedOrigins));

// Comprehensive security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://api.stripe.com"],
            frameSrc: ["'self'", "https://js.stripe.com"],
            objectSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Global rate limiting
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: {
        success: false,
        error: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// moved globalLimiter after logger

// Using custom CORS middleware applied early (see allowedOrigins)
// Additional security middleware
app.use(hpp()); // Protect against HTTP Parameter Pollution attacks
app.use(mongoSanitize()); // Sanitize data against NoSQL injection
app.use(xss()); // Sanitize user input against XSS
app.use(cookieParser(process.env.JWT_SECRET)); // Parse cookies with secret

// Body parsing middleware with size limits
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({
    extended: true,
    limit: '10mb',
    parameterLimit: 100 // Limit number of parameters
}));

// Secure session middleware with MongoDB store
app.use(session({
    name: 'beautybite.sid',
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'your-session-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/beautybite',
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60, // 14 days in seconds
        autoRemove: 'native',
        crypto: {
            secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'your-session-secret-key'
        }
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds
        sameSite: 'strict',
        domain: process.env.NODE_ENV === 'production' ? '.beautybite.com' : undefined
    },
    rolling: true, // Refresh session on activity
    proxy: process.env.NODE_ENV === 'production' // Trust reverse proxy in production
}));

// Compression middleware
app.use(compression());

// Enhanced structured logging middleware
app.use(httpLogger);
app.use(performanceMonitor);

// Security monitoring middleware (after logging; preflight ignored in middleware)
app.use(securityMonitor);

// Global rate limiting
app.use(globalLimiter);

// Enhanced health check routes
app.use('/health', healthRoutes);

// Apply auth rate limiting to authentication routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/designs', designRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);

// Security monitoring endpoint (protected - only accessible in development)
app.get('/api/security/report', async (req, res) => {
    // This would require admin authentication in production
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
            success: false,
            error: 'Access denied in production'
        });
    }

    const { getSecurityReport } = await import('./middleware/securityMonitor.js');
    const report = getSecurityReport();

    res.json({
        success: true,
        data: report
    });
});

// 404 handler
app.use(notFound);

// Error tracking and handler
app.use(errorTracker);
app.use(errorHandler);

// Database connection
const connectDB = async () => {
    try {
        const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/beautybite';
        console.log(`🔗 Connecting to database: ${connectionString}`);

        const conn = await mongoose.connect(
            connectionString,
            {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            }
        );
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.db.databaseName}`);

        // Test the connection by checking products
        const { default: Product } = await import('./models/Product.js');
        const productCount = await Product.countDocuments({});
        console.log(`📦 Products in database: ${productCount}`);
    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        process.exit(1);
    }
};

// Start server
const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
        console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
        console.log(`📈 System metrics at: http://localhost:${PORT}/health/metrics`);
        console.log(`🏓 Quick ping at: http://localhost:${PORT}/health/ping`);
    });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', err);
    // Close server & exit process
    process.exit(1);
});

startServer();

export default app;