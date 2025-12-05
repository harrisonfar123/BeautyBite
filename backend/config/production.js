/**
 * Production Configuration for BeautyBite
 * 
 * Production-specific database and security configurations
 * This file should be loaded in production environment only
 */

import dotenv from 'dotenv';

// Load production environment variables
dotenv.config({ path: '.env.production' });

const productionConfig = {
    // Database Configuration
    database: {
        uri: process.env.MONGODB_URI,
        options: {
            // Connection pooling and performance
            maxPoolSize: 50,
            minPoolSize: 10,
            maxIdleTimeMS: 30000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4, // Use IPv4, skip trying IPv6

            // Write concern for data safety
            writeConcern: {
                w: 'majority',
                j: true, // Journal acknowledged
                wtimeout: 5000
            },

            // Read preference for performance
            readPreference: 'secondaryPreferred',

            // SSL/TLS configuration
            ssl: true,
            sslValidate: true,
            tlsAllowInvalidCertificates: false,
            tlsAllowInvalidHostnames: false,

            // Retry configuration
            retryWrites: true,
            retryReads: true,

            // Authentication
            authSource: 'admin',
            authMechanism: 'SCRAM-SHA-256'
        },

        // Connection event handlers
        events: {
            connected: () => console.log('✅ Production MongoDB connected'),
            error: (err) => console.error('❌ Production MongoDB connection error:', err),
            disconnected: () => console.log('⚠️ Production MongoDB disconnected'),
            reconnected: () => console.log('🔁 Production MongoDB reconnected')
        }
    },

    // Security Configuration
    security: {
        // JWT Configuration
        jwt: {
            secret: process.env.JWT_SECRET,
            expiresIn: process.env.JWT_EXPIRE || '7d',
            issuer: 'beautybite.com',
            audience: 'beautybite-users'
        },

        // Password Policy
        passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            maxAge: 90, // days
            history: 5 // remember last 5 passwords
        },

        // Rate Limiting
        rateLimit: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false
        },

        // CORS Configuration
        cors: {
            origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['https://beautybite.com'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
        },

        // Helmet Security Headers
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    scriptSrc: ["'self'"],
                    connectSrc: ["'self'"]
                }
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            },
            noSniff: true,
            xssFilter: true,
            hidePoweredBy: true
        },

        // Input Validation and Sanitization
        validation: {
            maxRequestBodySize: '10mb',
            maxFileSize: '5mb',
            allowedFileTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
            maxFields: 100,
            maxFieldSize: '2mb'
        }
    },

    // Performance Configuration
    performance: {
        // Compression
        compression: {
            level: 6,
            threshold: '1kb',
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression.filter(req, res);
            }
        },

        // Caching
        cache: {
            redis: {
                url: process.env.REDIS_URL,
                ttl: parseInt(process.env.CACHE_TTL) || 3600
            },
            memory: {
                max: 100,
                ttl: 60000 // 1 minute
            }
        },

        // Database Query Optimization
        query: {
            maxTimeMS: 30000, // 30 seconds max query time
            allowDiskUse: false,
            batchSize: 1000
        }
    },

    // Monitoring and Logging
    monitoring: {
        // Application Logging
        logging: {
            level: process.env.LOG_LEVEL || 'info',
            format: 'json',
            transports: ['file', 'console'],
            file: {
                filename: 'logs/production.log',
                maxsize: 10485760, // 10MB
                maxFiles: 10,
                zippedArchive: true
            }
        },

        // Database Monitoring
        database: {
            slowQueryThreshold: 1000, // 1 second
            logSlowQueries: true,
            explainQueries: false, // Only in development
            connectionPoolMonitoring: true
        },

        // Health Checks
        health: {
            endpoint: '/health',
            checks: [
                'database',
                'memory',
                'redis',
                'external-apis'
            ],
            timeout: 5000
        }
    },

    // Backup and Recovery
    backup: {
        schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
        retention: {
            days: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
            maxBackups: parseInt(process.env.MAX_BACKUPS) || 50
        },
        storage: {
            local: {
                path: './backups',
                compression: 'gzip'
            },
            cloud: {
                provider: 'aws', // or 'gcp', 'azure'
                bucket: process.env.S3_BUCKET_NAME,
                region: process.env.AWS_REGION
            }
        },
        encryption: {
            enabled: true,
            algorithm: 'aes-256-gcm'
        }
    },

    // Feature Flags
    features: {
        emailVerification: process.env.FEATURE_EMAIL_VERIFICATION === 'true',
        twoFactorAuth: process.env.FEATURE_TWO_FACTOR_AUTH === 'true',
        maintenanceMode: process.env.FEATURE_MAINTENANCE_MODE === 'false',
        apiDocumentation: false, // Disable in production
        debugEndpoints: false   // Disable in production
    },

    // External Services
    services: {
        stripe: {
            secretKey: process.env.STRIPE_SECRET_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            apiVersion: '2023-10-16'
        },
        email: {
            provider: process.env.EMAIL_PROVIDER || 'sendgrid',
            sendgrid: {
                apiKey: process.env.SENDGRID_API_KEY
            },
            from: {
                email: process.env.FROM_EMAIL,
                name: process.env.FROM_NAME
            }
        },
        storage: {
            provider: 'aws',
            aws: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION,
                bucket: process.env.S3_BUCKET_NAME
            }
        }
    },

    // Error Handling
    errorHandling: {
        // Show minimal error details in production
        exposeStack: false,
        logErrors: true,
        notifyAdmins: true,

        // Custom error responses
        customErrors: {
            validation: 'Invalid input data',
            authentication: 'Authentication failed',
            authorization: 'Access denied',
            notFound: 'Resource not found',
            server: 'Internal server error'
        }
    }
};

// Validation function to ensure all required production environment variables are set
productionConfig.validate = function () {
    const required = [
        'MONGODB_URI',
        'JWT_SECRET',
        'STRIPE_SECRET_KEY',
        'SENDGRID_API_KEY',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'S3_BUCKET_NAME'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    }

    // Validate MongoDB URI format
    if (!process.env.MONGODB_URI.includes('mongodb+srv://')) {
        console.warn('⚠️  Production MongoDB URI should use SRV connection string for Atlas');
    }

    // Validate JWT secret strength
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        console.warn('⚠️  JWT secret is too short for production. Consider using a longer secret.');
    }

    console.log('✅ Production configuration validated successfully');
    return true;
};

// Method to get database configuration for different environments
productionConfig.getDatabaseConfig = function (environment = 'production') {
    const config = { ...this.database };

    if (environment === 'production') {
        config.uri = process.env.MONGODB_URI;
    } else if (environment === 'staging') {
        config.uri = process.env.MONGODB_URI?.replace('_production', '_staging');
    } else if (environment === 'development') {
        config.uri = process.env.MONGODB_URI?.replace('_production', '_development');
        // Less restrictive settings for development
        config.options.ssl = false;
        config.options.readPreference = 'primary';
    }

    return config;
};

// Method to get security headers configuration
productionConfig.getSecurityHeaders = function () {
    if (process.env.SECURITY_HEADERS_ENABLED === 'false') {
        return {};
    }

    return {
        'Strict-Transport-Security': this.security.helmet.hsts,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': this.security.helmet.contentSecurityPolicy.directives
    };
};

export default productionConfig;