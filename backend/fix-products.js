import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://localhost:27017/beautybite';

async function fixProducts() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        const Product = (await import('./models/Product.js')).default;
        const db = mongoose.connection.db;
        const productsCollection = db.collection('products');

        // Check the actual document structure
        const rawProducts = await productsCollection.find({}).toArray();
        console.log('Current product structure:');
        rawProducts.forEach(p => {
            console.log(JSON.stringify(p, null, 2));
        });

        // Update products to set isActive field
        const result = await productsCollection.updateMany(
            { isActive: { $exists: false } },
            { $set: { isActive: true } }
        );
        console.log('Update result:', result);

        // Verify the update
        const updatedProducts = await productsCollection.find({}).toArray();
        console.log('Updated products:');
        updatedProducts.forEach(p => {
            console.log(`Product: ${p.name}, isActive: ${p.isActive}`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

fixProducts();