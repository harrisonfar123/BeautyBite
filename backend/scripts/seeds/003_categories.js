/**
 * Seed: Product Categories
 * Creates product categories and subcategories
 */

export default {
  async run(db, mongoose) {
    console.log('📂 Creating product categories...');
    
    const categories = [
      {
        name: 'Dental Guards',
        slug: 'dental-guards',
        description: 'Professional dental protection for sports and activities',
        image: '/images/categories/dental-guards.jpg',
        parent: null,
        subcategories: ['sports', 'custom', 'boil-bite'],
        metadata: {
          displayOrder: 1,
          featured: true,
          seo: {
            title: 'Dental Guards - Sports Protection & Custom Fit | BeautyBite',
            description: 'Protect your smile with our professional dental guards for sports and activities.',
            keywords: ['dental guards', 'sports protection', 'mouth guards']
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Night Guards',
        slug: 'night-guards',
        description: 'Comfortable protection for teeth grinding and TMJ relief',
        image: '/images/categories/night-guards.jpg',
        parent: null,
        subcategories: ['sleep', 'tmj', 'bruxism'],
        metadata: {
          displayOrder: 2,
          featured: true,
          seo: {
            title: 'Night Guards - Teeth Grinding & TMJ Relief | BeautyBite',
            description: 'Find relief from teeth grinding and TMJ with our comfortable night guards.',
            keywords: ['night guards', 'teeth grinding', 'tmj relief']
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Whitening',
        slug: 'whitening',
        description: 'Professional teeth whitening solutions for a brighter smile',
        image: '/images/categories/whitening.jpg',
        parent: null,
        subcategories: ['trays', 'gels', 'kits'],
        metadata: {
          displayOrder: 3,
          featured: false,
          seo: {
            title: 'Teeth Whitening - Professional At-Home Solutions | BeautyBite',
            description: 'Achieve a brighter smile with our professional teeth whitening products.',
            keywords: ['teeth whitening', 'whitening trays', 'dental cosmetic']
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Accessories',
        slug: 'accessories',
        description: 'Dental care accessories and maintenance products',
        image: '/images/categories/accessories.jpg',
        parent: null,
        subcategories: ['cases', 'cleaners', 'storage'],
        metadata: {
          displayOrder: 4,
          featured: false,
          seo: {
            title: 'Dental Accessories - Care & Maintenance Products | BeautyBite',
            description: 'Keep your dental products clean and well-maintained with our accessories.',
            keywords: ['dental accessories', 'cleaning', 'storage']
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Insert categories
    const result = await db.collection('categories').insertMany(categories);
    console.log(`✅ Created ${result.insertedCount} categories`);
    
    // Create indexes
    await db.collection('categories').createIndex({ slug: 1 }, { unique: true });
    await db.collection('categories').createIndex({ parent: 1 });
    await db.collection('categories').createIndex({ 'metadata.displayOrder': 1 });
    
    console.log('✅ Category indexes created');
  }
};
