#!/usr/bin/env node

/**
 * Database Seeding Script for BeautyBite
 * 
 * This script populates the database with initial data for development and testing
 * Run with: node backend/scripts/seed.js [--env development|test|production] [--force]
 */

import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseSeeder {
  constructor() {
    this.seeds = [];
    this.appliedSeeds = new Set();
    this.seedCollection = 'seeds';
  }

  async connect() {
    try {
      const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/beautybite';

      console.log('🔌 Connecting to database...');

      const config = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false
      };

      await mongoose.connect(connectionString, config);
      console.log('✅ Database connected successfully');

      // Ensure seeds collection exists
      await this.ensureSeedsCollection();

    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    }
  }

  async ensureSeedsCollection() {
    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: this.seedCollection }).toArray();

    if (collections.length === 0) {
      await db.createCollection(this.seedCollection);
      console.log('✅ Created seeds collection');
    }
  }

  async loadSeeds() {
    try {
      const seedsDir = join(__dirname, 'seeds');

      if (!fs.existsSync(seedsDir)) {
        fs.mkdirSync(seedsDir, { recursive: true });
        console.log('📁 Created seeds directory');
        return;
      }

      const files = fs.readdirSync(seedsDir)
        .filter(file => file.endsWith('.js'))
        .sort();

      for (const file of files) {
        const seedPath = join(seedsDir, file);
        const seed = await import(seedPath);

        this.seeds.push({
          name: file.replace('.js', ''),
          path: seedPath,
          module: seed.default
        });
      }

      console.log(`📦 Loaded ${this.seeds.length} seed files`);
    } catch (error) {
      console.error('❌ Failed to load seeds:', error.message);
      process.exit(1);
    }
  }

  async loadAppliedSeeds() {
    try {
      const db = mongoose.connection.db;
      const seeds = await db.collection(this.seedCollection)
        .find({})
        .sort({ appliedAt: 1 })
        .toArray();

      this.appliedSeeds = new Set(seeds.map(s => s.name));
      console.log(`📋 Found ${this.appliedSeeds.size} applied seeds`);
    } catch (error) {
      console.error('❌ Failed to load applied seeds:', error.message);
      process.exit(1);
    }
  }

  async runSeeds(force = false) {
    const seedsToRun = force ? this.seeds : this.seeds.filter(s => !this.appliedSeeds.has(s.name));

    if (seedsToRun.length === 0) {
      console.log('✅ No pending seeds');
      return;
    }

    console.log(`🔄 Running ${seedsToRun.length} seeds...`);

    for (const seed of seedsToRun) {
      try {
        console.log(`\n🌱 Running seed: ${seed.name}`);

        const startTime = Date.now();
        await seed.module.run(mongoose.connection.db, mongoose);
        const duration = Date.now() - startTime;

        // Record seed
        await mongoose.connection.db.collection(this.seedCollection).insertOne({
          name: seed.name,
          appliedAt: new Date(),
          duration: duration,
          force: force
        });

        console.log(`✅ Seed ${seed.name} completed in ${duration}ms`);
      } catch (error) {
        console.error(`❌ Seed ${seed.name} failed:`, error.message);
        throw error;
      }
    }
  }

  async createSeed(name) {
    const filename = `${name}.js`;
    const filepath = join(__dirname, 'seeds', filename);

    const template = `/**
 * Seed: ${name}
 * Created: ${new Date().toISOString()}
 */

export default {
  async run(db, mongoose) {
    // Add your seed data here
    // Example:
    // await db.collection('users').insertOne({
    //   name: 'John Doe',
    //   email: 'john@example.com',
    //   createdAt: new Date(),
    //   updatedAt: new Date()
    // });
  }
};
`;

    fs.writeFileSync(filepath, template);
    console.log(`📄 Created seed: ${filename}`);
  }

  async disconnect() {
    try {
      await mongoose.disconnect();
      console.log('🔌 Database disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting from database:', error.message);
    }
  }
}

// Default seed data
const defaultSeeds = {
  async createUsersSeed() {
    const usersSeedPath = join(__dirname, 'seeds', '001_users.js');

    const usersSeed = `/**
 * Seed: Initial Users
 * Creates admin and test users for development
 */

import bcrypt from 'bcryptjs';

export default {
  async run(db, mongoose) {
    console.log('👤 Creating initial users...');
    
    const users = [
      {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@beautybite.com',
        password: await bcrypt.hash('Admin123!', 12),
        role: 'admin',
        emailVerified: true,
        isActive: true,
        preferences: {
          emailNotifications: true,
          smsNotifications: false,
          marketingEmails: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        firstName: 'Test',
        lastName: 'Customer',
        email: 'customer@beautybite.com',
        password: await bcrypt.hash('Customer123!', 12),
        role: 'customer',
        emailVerified: true,
        isActive: true,
        preferences: {
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: false
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        firstName: 'Design',
        lastName: 'Professional',
        email: 'designer@beautybite.com',
        password: await bcrypt.hash('Designer123!', 12),
        role: 'designer',
        emailVerified: true,
        isActive: true,
        preferences: {
          emailNotifications: true,
          smsNotifications: false,
          marketingEmails: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Insert users
    const result = await db.collection('users').insertMany(users);
    console.log(\`✅ Created \${result.insertedCount} users\`);
    
    // Create indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1, isActive: 1 });
    await db.collection('users').createIndex({ createdAt: -1 });
    
    console.log('✅ User indexes created');
  }
};
`;

    fs.writeFileSync(usersSeedPath, usersSeed);
    console.log('📄 Created users seed');
  },

  async createProductsSeed() {
    const productsSeedPath = join(__dirname, 'seeds', '002_products.js');

    const productsSeed = `/**
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
    console.log(\`✅ Created \${result.insertedCount} products\`);
    
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
`;

    fs.writeFileSync(productsSeedPath, productsSeed);
    console.log('📄 Created products seed');
  },

  async createCategoriesSeed() {
    const categoriesSeedPath = join(__dirname, 'seeds', '003_categories.js');

    const categoriesSeed = `/**
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
    console.log(\`✅ Created \${result.insertedCount} categories\`);
    
    // Create indexes
    await db.collection('categories').createIndex({ slug: 1 }, { unique: true });
    await db.collection('categories').createIndex({ parent: 1 });
    await db.collection('categories').createIndex({ 'metadata.displayOrder': 1 });
    
    console.log('✅ Category indexes created');
  }
};
`;

    fs.writeFileSync(categoriesSeedPath, categoriesSeed);
    console.log('📄 Created categories seed');
  }
};

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const force = args.includes('--force');

  const seeder = new DatabaseSeeder();

  try {
    await seeder.connect();

    if (command === 'create') {
      const name = args[1];
      if (!name) {
        console.error('❌ Please provide a seed name: node seed.js create <name>');
        process.exit(1);
      }
      await seeder.createSeed(name);
    } else if (command === 'init') {
      // Create default seeds
      console.log('🌱 Creating default seeds...');
      await defaultSeeds.createUsersSeed();
      await defaultSeeds.createProductsSeed();
      await defaultSeeds.createCategoriesSeed();
      console.log('✅ Default seeds created');
    } else if (command === 'status') {
      await seeder.loadSeeds();
      await seeder.loadAppliedSeeds();

      console.log('\n📊 Seed Status:');
      seeder.seeds.forEach(seed => {
        const status = seeder.appliedSeeds.has(seed.name) ? '✅ Applied' : '⏳ Pending';
        console.log(`  ${status}: ${seed.name}`);
      });
    } else {
      // Default: run seeds
      await seeder.loadSeeds();
      await seeder.loadAppliedSeeds();
      await seeder.runSeeds(force);
    }

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await seeder.disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export default DatabaseSeeder;