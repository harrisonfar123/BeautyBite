# BeautyBite Backend API

A complete Express.js backend API for the BeautyBite e-commerce platform, featuring user authentication, product management, custom design uploads, order processing, subscription management, and Stripe payment integration.

## Features

- **User Authentication**: JWT-based authentication with refresh tokens
- **Product Management**: CRUD operations for products with inventory tracking
- **Custom Designs**: 3D model upload and compression for custom dental products
- **Order Processing**: Complete order lifecycle management
- **Subscription System**: Recurring billing and subscription management
- **Payment Integration**: Stripe integration for one-time and subscription payments
- **Security**: Rate limiting, CORS, helmet, input validation
- **Error Handling**: Comprehensive error handling and logging

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt password hashing
- **Payments**: Stripe API
- **File Upload**: Multer for design file handling
- **Validation**: Joi for request validation
- **Security**: Helmet, CORS, rate limiting

## Project Structure

```
backend/
├── config/
│   └── database.js          # MongoDB connection configuration
├── models/
│   ├── User.js              # User schema and model
│   ├── Product.js           # Product schema and model
│   ├── CustomDesign.js      # Custom design schema and model
│   ├── Order.js             # Order schema and model
│   └── Subscription.js      # Subscription schema and model
├── middleware/
│   ├── auth.js              # Authentication and authorization
│   ├── errorHandler.js      # Global error handling
│   ├── notFound.js          # 404 handler
│   └── validation.js        # Request validation
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── users.js             # User management routes
│   ├── products.js          # Product routes
│   ├── designs.js           # Custom design routes
│   ├── orders.js            # Order routes
│   ├── subscriptions.js     # Subscription routes
│   └── payments.js          # Payment routes
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies and scripts
├── server.js               # Main server file
└── README.md               # This file
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Users

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/addresses` - Get user addresses
- `POST /api/users/addresses` - Add user address
- `PUT /api/users/addresses/:id` - Update user address
- `DELETE /api/users/addresses/:id` - Delete user address

### Products

- `GET /api/products` - Get all products (with filtering)
- `GET /api/products/:id` - Get single product
- `GET /api/products/:id/pricing` - Get product pricing
- `GET /api/products/category/:category` - Get products by category
- `GET /api/products/featured` - Get featured products

### Designs

- `GET /api/designs` - Get user's designs
- `GET /api/designs/:id` - Get single design
- `POST /api/designs` - Create new design
- `PUT /api/designs/:id` - Update design
- `DELETE /api/designs/:id` - Delete design
- `POST /api/designs/:id/upload` - Upload design file
- `POST /api/designs/:id/duplicate` - Duplicate design

### Orders

- `GET /api/orders` - Get user's orders
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create new order
- `PUT /api/orders/:id/cancel` - Cancel order
- `GET /api/orders/:id/invoice` - Get order invoice

### Subscriptions

- `GET /api/subscriptions` - Get user's subscriptions
- `GET /api/subscriptions/:id` - Get single subscription
- `POST /api/subscriptions` - Create new subscription
- `PUT /api/subscriptions/:id/pause` - Pause subscription
- `PUT /api/subscriptions/:id/resume` - Resume subscription
- `PUT /api/subscriptions/:id/cancel` - Cancel subscription
- `PUT /api/subscriptions/:id/update` - Update subscription

### Payments

- `POST /api/payments/create-intent` - Create payment intent
- `POST /api/payments/confirm` - Confirm payment
- `POST /api/payments/webhook` - Stripe webhook handler
- `GET /api/payments/methods` - Get payment methods

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:
   - MongoDB connection strings
   - JWT secrets
   - Stripe API keys
   - Email configuration

4. **Start the development server**

   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3001` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/beautybite` |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | - |
| `STRIPE_SECRET_KEY` | Stripe secret key | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | - |
| `FRONTEND_URL` | Frontend application URL | `http://localhost:3000` |

## Development

- **Start development server**: `npm run dev`
- **Run tests**: `npm test`
- **Lint code**: `npm run lint`
- **Fix linting issues**: `npm run lint:fix`

## Database Models

### User

- Authentication and profile information
- Address management
- Stripe customer integration
- Preferences and settings

### Product

- Product catalog with variants
- Pricing and inventory management
- 3D model integration
- Subscription options

### CustomDesign

- 3D design file storage and compression
- Design specifications and customization
- Version control and sharing
- Integration with orders

### Order

- Order processing and tracking
- Payment status management
- Invoice generation
- Shipping and fulfillment

### Subscription

- Recurring billing management
- Subscription lifecycle
- Payment method management
- Delivery scheduling

## Security Features

- JWT authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting for API endpoints
- CORS configuration
- Input validation and sanitization
- Helmet security headers
- Error handling without sensitive data exposure

## Deployment

The application is ready for deployment to platforms like:

- Heroku
- DigitalOcean App Platform
- AWS Elastic Beanstalk
- Google Cloud Run

Make sure to set the appropriate environment variables in your deployment platform.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
