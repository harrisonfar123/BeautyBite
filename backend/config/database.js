import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Connection configuration based on environment
const getConnectionConfig = () => {
    const baseConfig = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 10,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        heartbeatFrequencyMS: 10000,
        maxIdleTimeMS: 30000,
        retryWrites: true,
        retryReads: true,
        readPreference: process.env.NODE_ENV === 'production' ? 'secondaryPreferred' : 'primary',
        writeConcern: {
            w: process.env.NODE_ENV === 'production' ? 'majority' : 1,
            j: true,
            wtimeout: 10000
        }
    };

    // Add SSL/TLS for production
    if (process.env.NODE_ENV === 'production') {
        baseConfig.ssl = true;
        baseConfig.tlsAllowInvalidCertificates = false;
        baseConfig.tlsAllowInvalidHostnames = false;
    }

    return baseConfig;
};

// Connection retry configuration
const retryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2
};

const connectDB = async (retryCount = 0) => {
    try {
        let connectionString;

        // Always use the beautybite database for now to fix the issue
        connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/beautybite';

        console.log(`🔗 Database Connection: ${connectionString}`);

        if (!connectionString) {
            throw new Error('No MongoDB connection string configured');
        }

        const config = getConnectionConfig();
        const conn = await mongoose.connect(connectionString, config);

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);
        console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`👥 Connection Pool Size: ${config.maxPoolSize}`);

        return conn;
    } catch (error) {
        console.error(`❌ Database connection error (attempt ${retryCount + 1}/${retryConfig.maxRetries + 1}):`, error.message);

        if (retryCount < retryConfig.maxRetries) {
            const delay = retryConfig.retryDelay * Math.pow(retryConfig.backoffMultiplier, retryCount);
            console.log(`🔄 Retrying connection in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return connectDB(retryCount + 1);
        }

        console.error('💥 Maximum connection retries exceeded. Application will exit.');
        process.exit(1);
    }
};

// Enhanced connection event handlers
mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose connected to database');
    console.log(`📈 Ready State: ${mongoose.connection.readyState}`);
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
    // Log additional error details for debugging
    if (err.name === 'MongoNetworkError') {
        console.error('🌐 Network error detected. Check connection string and network connectivity.');
    } else if (err.name === 'MongoTimeoutError') {
        console.error('⏰ Connection timeout. Check server availability and network latency.');
    }
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ Mongoose disconnected');
    // Attempt reconnection for non-production environments
    if (process.env.NODE_ENV !== 'production') {
        console.log('🔄 Attempting to reconnect...');
        setTimeout(() => connectDB(), 5000);
    }
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ Mongoose reconnected to database');
});

// Monitor connection health
const monitorConnectionHealth = () => {
    const state = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    console.log(`🔍 Connection Health Check: ${states[state]} (${state})`);

    if (state !== 1) { // 1 = connected
        console.warn('⚠️ Database connection is not in optimal state');
    }
};

// Set up periodic health checks in production
if (process.env.NODE_ENV === 'production') {
    setInterval(monitorConnectionHealth, 60000); // Check every minute
}

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed gracefully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

// Export connection metrics
export const getConnectionMetrics = () => {
    const connection = mongoose.connection;
    return {
        readyState: connection.readyState,
        host: connection.host,
        port: connection.port,
        name: connection.name,
        collections: Object.keys(connection.collections).length,
        models: Object.keys(connection.models).length
    };
};

export default connectDB;