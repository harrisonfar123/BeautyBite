/**
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
    console.log(`✅ Created ${result.insertedCount} users`);
    
    // Create indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1, isActive: 1 });
    await db.collection('users').createIndex({ createdAt: -1 });
    
    console.log('✅ User indexes created');
  }
};
