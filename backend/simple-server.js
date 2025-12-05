import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Force connection to the correct database
const MONGODB_URI = 'mongodb://localhost:27017/beautybite';

// Database connection
const connectDB = async () => {
    try {
        console.log(`🔗 Connecting to: ${MONGODB_URI}`);
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`✅ MongoDB Connected to: ${mongoose.connection.db.databaseName}`);

        // Test connection by counting products
        const Product = (await import('./models/Product.js')).default;
        const productCount = await Product.countDocuments({});
        console.log(`📦 Products in database: ${productCount}`);

        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
};

// Import routes after database connection
const setupRoutes = async () => {
    const { default: productRoutes } = await import('./routes/products.js');
    app.use('/api/products', productRoutes);
};

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        databaseName: mongoose.connection.db?.databaseName || 'unknown'
    });
});

// Simple test endpoint
app.get('/api/test', async (req, res) => {
    try {
        const Product = (await import('./models/Product.js')).default;
        const products = await Product.find({}).limit(5);
        res.json({
            success: true,
            count: products.length,
            products: products.map(p => ({
                id: p._id,
                name: p.name,
                price: p.pricing?.basePrice,
                active: p.isActive
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug products endpoint to check query
app.get('/api/debug-products', async (req, res) => {
    try {
        const Product = (await import('./models/Product.js')).default;

        // Test different queries
        const allProducts = await Product.find({});
        const activeProducts = await Product.find({ isActive: true });
        const inactiveProducts = await Product.find({ isActive: false });

        console.log('Debug products query:');
        console.log('- All products:', allProducts.length);
        console.log('- Active products:', activeProducts.length);
        console.log('- Inactive products:', inactiveProducts.length);

        res.json({
            success: true,
            debug: {
                allProducts: allProducts.length,
                activeProducts: activeProducts.length,
                inactiveProducts: inactiveProducts.length,
                allProductsDetails: allProducts.map(p => ({
                    id: p._id,
                    name: p.name,
                    isActive: p.isActive,
                    pricing: p.pricing
                }))
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
const startServer = async () => {
    const connected = await connectDB();
    if (!connected) {
        console.log('❌ Failed to connect to database. Exiting.');
        process.exit(1);
    }

    await setupRoutes();

    app.listen(PORT, () => {
        console.log(`🚀 Simple server running on port ${PORT}`);
        console.log(`🏥 Health check: http://localhost:${PORT}/health`);
        console.log(`🛍️  Products API: http://localhost:${PORT}/api/products`);
        console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
    });
};

startServer();