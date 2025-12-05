import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://localhost:27017/beautybite';

async function debugMongoQuery() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        const Product = (await import('./models/Product.js')).default;
        
        // Test with raw MongoDB query
        const db = mongoose.connection.db;
        const productsCollection = db.collection('products');
        
        const rawProducts = await productsCollection.find({}).toArray();
        console.log('Raw products count:', rawProducts.length);
        
        rawProducts.forEach(p => {
            console.log(`Raw Product: ${p.name}, isActive: ${p.isActive}, type: ${typeof p.isActive}`);
        });
        
        // Test the query that should work
        const activeProducts = await productsCollection.find({ isActive: true }).toArray();
        console.log('Active products (raw):', activeProducts.length);
        
        // Test with different query formats
        const query1 = await Product.find({ isActive: true });
        console.log('Query 1 (Product.find):', query1.length);
        
        const query2 = await Product.find({ isActive: { $eq: true } });
        console.log('Query 2 ($eq):', query2.length);
        
        const query3 = await Product.find({});
        console.log('Query 3 (all):', query3.length);
        
        // Check if there's a schema issue
        console.log('Product schema paths:');
        Object.keys(Product.schema.paths).forEach(path => {
            if (path.includes('isActive')) {
                console.log(`  ${path}: ${Product.schema.paths[path].instance}`);
            }
        });
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

debugMongoQuery();