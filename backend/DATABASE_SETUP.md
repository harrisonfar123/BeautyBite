# BeautyBite Database Setup Guide

## Overview

This document provides comprehensive documentation for setting up, configuring, and maintaining the BeautyBite MongoDB database in production environments.

## Table of Contents

1. [Database Schema Overview](#database-schema-overview)
2. [Production Configuration](#production-configuration)
3. [Migration and Seeding](#migration-and-seeding)
4. [Backup and Recovery](#backup-and-recovery)
5. [Performance Optimization](#performance-optimization)
6. [Security Configuration](#security-configuration)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)

## Database Schema Overview

### Collections

#### Users Collection

- **Purpose**: Store user accounts and authentication data
- **Key Fields**: `email`, `password`, `role`, `isActive`, `emailVerified`
- **Indexes**:
  - `email` (unique)
  - `role + isActive`
  - `createdAt` (descending)

#### Products Collection

- **Purpose**: Store product catalog and inventory
- **Key Fields**: `sku`, `name`, `category`, `pricing`, `inventory`, `status`
- **Indexes**:
  - `sku` (unique)
  - `category + status`
  - `tags` (array)
  - `featured + status`

#### Orders Collection

- **Purpose**: Store customer orders and payment information
- **Key Fields**: `orderNumber`, `userId`, `status`, `totalAmount`, `payment`
- **Indexes**:
  - `orderNumber` (unique)
  - `userId + status`
  - `status + createdAt`
  - `payment.stripePaymentIntentId`

#### Subscriptions Collection

- **Purpose**: Manage recurring subscriptions and billing
- **Key Fields**: `subscriptionId`, `userId`, `plan`, `status`, `currentPeriod`
- **Indexes**:
  - `subscriptionId` (unique, sparse)
  - `userId + status`
  - `status + currentPeriod.end`
  - `billingCycle.anchor`

#### CustomDesigns Collection

- **Purpose**: Store custom dental guard designs
- **Key Fields**: `designId`, `userId`, `status`, `designData`, `versionHistory`
- **Indexes**:
  - `userId + status`
  - `designId + versionHistory.version`
  - `createdAt` (descending)

## Production Configuration

### Environment Variables

Create `.env.production` file with the following variables:

```bash
# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/beautybite_production?retryWrites=true&w=majority
DATABASE_NAME=beautybite_production

# Security
JWT_SECRET=your-super-secure-jwt-secret-key-here-change-in-production
JWT_EXPIRE=7d

# External Services
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here

# Email Configuration
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key_here

# Cloud Storage
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=beautybite-production

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=your_sentry_dsn_here
```

### MongoDB Atlas Configuration

1. **Create Cluster**:
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a new cluster in your preferred region
   - Choose M10 tier or higher for production

2. **Network Access**:
   - Add your application server IP addresses to the IP whitelist
   - Enable VPC peering if using AWS/Azure/GCP

3. **Database Users**:
   - Create a dedicated database user with read/write permissions
   - Use strong, unique passwords
   - Enable SCRAM-SHA-256 authentication

4. **Backup Configuration**:
   - Enable continuous backup
   - Set retention policy (30-60 days recommended)
   - Configure point-in-time recovery

## Migration and Seeding

### Initial Setup

1. **Run Migrations**:

```bash
cd backend
node scripts/migrate.js
```

2. **Seed Initial Data**:

```bash
cd backend
node scripts/seed.js init
```

### Creating New Migrations

```bash
# Create a new migration file
node scripts/migrate.js create add_new_feature

# Run pending migrations
node scripts/migrate.js
```

### Creating New Seeds

```bash
# Create a new seed file
node scripts/seed.js create sample_data

# Run all seeds (including new ones)
node scripts/seed.js
```

## Backup and Recovery

### Automated Backups

```bash
# Create backup
node scripts/backup.js backup

# List available backups
node scripts/backup.js list

# Restore from backup
node scripts/backup.js restore beautybite-backup-20240101-120000

# Cleanup old backups
node scripts/backup.js cleanup
```

### Scheduled Backups (Cron)

Add to crontab for daily backups:

```bash
0 2 * * * cd /path/to/beautybite/backend && node scripts/backup.js backup
```

### Recovery Procedures

1. **Point-in-Time Recovery**:
   - Use MongoDB Atlas point-in-time recovery feature
   - Restore to specific timestamp

2. **Manual Recovery**:

```bash
# Stop application
# Restore latest backup
node scripts/backup.js restore beautybite-backup-latest
# Start application
```

## Performance Optimization

### Index Management

```bash
# Create optimal indexes
node scripts/optimize.js indexes

# Analyze query performance
node scripts/optimize.js analyze

# Get database statistics
node scripts/optimize.js stats

# Cleanup orphaned data
node scripts/optimize.js cleanup

# Run all optimizations
node scripts/optimize.js all
```

### Query Optimization Tips

1. **Use Covered Queries**:
   - Ensure queries can be satisfied entirely by indexes
   - Use projection to limit returned fields

2. **Avoid Large Scans**:
   - Use appropriate indexes
   - Implement pagination for large datasets
   - Use `limit()` and `skip()` efficiently

3. **Monitor Slow Queries**:
   - Use MongoDB Profiler
   - Set `slowms` threshold appropriately
   - Review query patterns regularly

### Connection Pooling

Configure in `backend/config/database.js`:

```javascript
const config = {
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
};
```

## Security Configuration

### Database Security

1. **Network Security**:
   - Use VPC peering or private endpoints
   - Configure IP whitelisting
   - Enable TLS/SSL connections

2. **Authentication**:
   - Use strong passwords
   - Enable SCRAM-SHA-256
   - Regular credential rotation

3. **Authorization**:
   - Principle of least privilege
   - Separate read/write users
   - Regular access reviews

### Application Security

1. **Input Validation**:
   - Validate all user inputs
   - Use Mongoose schema validation
   - Sanitize special characters

2. **Query Security**:
   - Use parameterized queries
   - Avoid raw queries when possible
   - Implement rate limiting

3. **Data Encryption**:
   - Enable encryption at rest
   - Use field-level encryption for sensitive data
   - Secure key management

## Monitoring and Maintenance

### Health Checks

```bash
# Run database health check
node scripts/backup.js health

# Validate data integrity
node scripts/backup.js validate
```

### Performance Monitoring

1. **MongoDB Atlas Metrics**:
   - CPU and memory usage
   - Connection count
   - Operation execution times
   - Storage metrics

2. **Custom Monitoring**:
   - Query performance
   - Index usage
   - Connection pool status

### Regular Maintenance

**Daily**:

- Monitor backup completion
- Check error logs
- Review slow queries

**Weekly**:

- Analyze index usage
- Cleanup orphaned data
- Review security logs

**Monthly**:

- Performance review
- Capacity planning
- Security audit

## Troubleshooting

### Common Issues

1. **Connection Timeouts**:
   - Check network connectivity
   - Verify IP whitelist
   - Review connection pool settings

2. **Slow Queries**:
   - Analyze query patterns
   - Check index usage
   - Review data model

3. **High Memory Usage**:
   - Monitor working set
   - Check index size
   - Review aggregation pipelines

### Diagnostic Commands

```bash
# Check current operations
db.currentOp()

# Get database stats
db.stats()

# Get collection stats
db.collection.stats()

# Explain query
db.collection.find().explain("executionStats")
```

### Recovery Procedures

1. **Database Corruption**:
   - Restore from backup
   - Run repair commands
   - Contact MongoDB support

2. **Performance Degradation**:
   - Analyze slow queries
   - Review index usage
   - Check hardware resources

3. **Security Breach**:
   - Rotate credentials
   - Review access logs
   - Audit user permissions

## Deployment Checklist

### Pre-Deployment

- [ ] Database backups are current
- [ ] Migration scripts tested
- [ ] Environment variables configured
- [ ] Security settings reviewed
- [ ] Performance benchmarks established

### During Deployment

- [ ] Run migrations
- [ ] Seed initial data (if needed)
- [ ] Verify database connectivity
- [ ] Test critical queries
- [ ] Monitor performance metrics

### Post-Deployment

- [ ] Verify backup procedures
- [ ] Monitor error rates
- [ ] Review query performance
- [ ] Check security logs
- [ ] Update documentation

## Support and Resources

### Documentation

- [MongoDB Documentation](https://docs.mongodb.com/)
- [Mongoose Guide](https://mongoosejs.com/docs/guide.html)
- [Atlas Documentation](https://docs.atlas.mongodb.com/)

### Monitoring Tools

- MongoDB Atlas Monitoring
- MongoDB Compass
- mongotop and mongostat

### Support Contacts

- Database Administrator: [email]
- Development Team: [email]
- Emergency Support: [phone]

---

**Last Updated**: ${new Date().toISOString().split['T'](0)}
**Version**: 1.0.0
