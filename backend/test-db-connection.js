const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

console.log('MONGODB_URI from env:', process.env.MONGODB_URI);
console.log('NODE_ENV:', process.env.NODE_ENV);

async function testConnection() {
    try {
        const conn = await mongoose.connect(
            process.env.MONGODB_URI || 'mongodb://localhost:27017/beautybite', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        }
        );

        console.log('✅ Connected to database:', conn.connection.db.databaseName);
        console.log('📊 Connection state:', mongoose.connection.readyState);

        const Product = require('./models/Product.js').default;
        const products = await Product.find({});
        console.log('📦 Products found:', products.length);

        if (products.length > 0) {
            console.log('Product details:');
            products.forEach(p => {
                console.log(`  - ${p.name} (ID: ${p._id}, Active: ${p.isActive})`);
            });
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Connection error:', error.message);
    }
}

testConnection();