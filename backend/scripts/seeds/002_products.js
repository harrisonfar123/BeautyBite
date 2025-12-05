/**
 * Seed: Initial Products
 * Creates sample dental products for the store
 */

export default {
  async run(db, mongoose) {
    console.log('🦷 Creating initial products...');
    
    const products = [
      {
        name: 'Premium Dental Guard',
        description: 'Professional-grade dental guard for optimal protection and comfort during sports and sleep.',
        shortDescription: 'Professional dental protection guard',
        sku: 'DG-PREM-001',
        category: 'dental-guards',
        subcategory: 'sports',
        tags: ['sports', 'premium', 'custom-fit', 'protection'],
        images: [
          '/images/products/dental-guard-premium-1.jpg',
          '/images/products/dental-guard-premium-2.jpg'
        ],
        specifications: {
          material: 'Medical-grade silicone',
          thickness: '3mm',
          fit: 'Custom',
          protectionLevel: 'High',
          usage: 'Sports, Sleep Bruxism',
          durability: '6-12 months',
          careInstructions: 'Rinse with cold water after use, store in provided case'
        },
        pricing: {
          basePrice: 89.99,
          salePrice: 79.99,
          currency: 'USD',
          cost: 25.50,
          margin: 68.5
        },
        inventory: {
          quantity: 100,
          reserved: 0,
          available: 100,
          lowStockThreshold: 10,
          reorderPoint: 20,
          trackInventory: true
        },
        seo: {
          title: 'Premium Dental Guard - Professional Sports Protection | BeautyBite',
          description: 'Get professional-grade dental protection with our premium dental guard. Perfect for sports and sleep bruxism.',
          keywords: ['dental guard', 'sports protection', 'mouth guard', 'teeth protection'],
          slug: 'premium-dental-guard'
        },
        status: 'active',
        featured: true,
        customizable: true,
        productionTime: 3,
        metadata: {
          weight: 0.1,
          dimensions: {
            length: 8,
            width: 5,
            height: 2
          },
          packageIncludes: ['Dental Guard', 'Storage Case', 'Care Instructions']
        },
        reviews: {
          averageRating: 4.8,
          totalReviews: 47,
          ratings: {
            5: 38,
            4: 8,
            3: 1,
            2: 0,
            1: 0
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Comfort Fit Night Guard',
        description: 'Soft, comfortable night guard for teeth grinding and TMJ relief. Perfect for comfortable sleep.',
        shortDescription: 'Soft night guard for teeth grinding relief',
        sku: 'NG-COMF-001',
        category: 'night-guards',
        subcategory: 'sleep',
        tags: ['sleep', 'comfort', 'tmj', 'bruxism'],
        images: [
          '/images/products/night-guard-comfort-1.jpg',
          '/images/products/night-guard-comfort-2.jpg'
        ],
        specifications: {
          material: 'Soft medical-grade polymer',
          thickness: '2mm',
          fit: 'Semi-custom',
          protectionLevel: 'Medium',
          usage: 'Sleep Bruxism, TMJ Relief',
          durability: '12-18 months',
          careInstructions: 'Clean with mild soap, store dry'
        },
        pricing: {
          basePrice: 69.99,
          salePrice: null,
          currency: 'USD',
          cost: 18.75,
          margin: 73.2
        },
        inventory: {
          quantity: 75,
          reserved: 0,
          available: 75,
          lowStockThreshold: 5,
          reorderPoint: 15,
          trackInventory: true
        },
        seo: {
          title: 'Comfort Fit Night Guard - TMJ & Teeth Grinding Relief | BeautyBite',
          description: 'Experience relief from teeth grinding and TMJ with our comfortable night guard. Soft material for better sleep.',
          keywords: ['night guard', 'teeth grinding', 'tmj relief', 'sleep guard'],
          slug: 'comfort-fit-night-guard'
        },
        status: 'active',
        featured: false,
        customizable: true,
        productionTime: 2,
        metadata: {
          weight: 0.08,
          dimensions: {
            length: 7,
            width: 4,
            height: 1.5
          },
          packageIncludes: ['Night Guard', 'Storage Case']
        },
        reviews: {
          averageRating: 4.6,
          totalReviews: 32,
          ratings: {
            5: 24,
            4: 6,
            3: 2,
            2: 0,
            1: 0
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Whitening Dental Tray',
        description: 'Custom-fit whitening trays for professional at-home teeth whitening results.',
        shortDescription: 'Custom teeth whitening trays',
        sku: 'WT-TRAY-001',
        category: 'whitening',
        subcategory: 'trays',
        tags: ['whitening', 'cosmetic', 'custom-fit', 'dental'],
        images: [
          '/images/products/whitening-tray-1.jpg',
          '/images/products/whitening-tray-2.jpg'
        ],
        specifications: {
          material: 'Flexible dental resin',
          thickness: '1.5mm',
          fit: 'Custom',
          protectionLevel: 'N/A',
          usage: 'Teeth Whitening',
          durability: 'Single use with gel',
          careInstructions: 'Use with provided whitening gel, rinse after use'
        },
        pricing: {
          basePrice: 49.99,
          salePrice: 39.99,
          currency: 'USD',
          cost: 12.25,
          margin: 75.5
        },
        inventory: {
          quantity: 200,
          reserved: 0,
          available: 200,
          lowStockThreshold: 25,
          reorderPoint: 50,
          trackInventory: true
        },
        seo: {
          title: 'Custom Whitening Dental Trays - Professional At-Home Whitening | BeautyBite',
          description: 'Achieve professional teeth whitening results at home with our custom-fit whitening trays.',
          keywords: ['whitening trays', 'teeth whitening', 'dental cosmetic', 'custom trays'],
          slug: 'whitening-dental-tray'
        },
        status: 'active',
        featured: true,
        customizable: true,
        productionTime: 1,
        metadata: {
          weight: 0.05,
          dimensions: {
            length: 6,
            width: 3,
            height: 1
          },
          packageIncludes: ['Whitening Trays', 'Instruction Guide']
        },
        reviews: {
          averageRating: 4.7,
          totalReviews: 28,
          ratings: {
            5: 20,
            4: 6,
            3: 2,
            2: 0,
            1: 0
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Insert products
    const result = await db.collection('products').insertMany(products);
    console.log(`✅ Created ${result.insertedCount} products`);
    
    // Create indexes
    await db.collection('products').createIndex({ sku: 1 }, { unique: true });
    await db.collection('products').createIndex({ category: 1, status: 1 });
    await db.collection('products').createIndex({ tags: 1 });
    await db.collection('products').createIndex({ 'pricing.basePrice': 1 });
    await db.collection('products').createIndex({ featured: 1, status: 1 });
    await db.collection('products').createIndex({ createdAt: -1 });
    
    console.log('✅ Product indexes created');
  }
};
