// Complete Express server for BeautyBite authentication
// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('./db'); // Database connection pool
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// CORS for development (frontend on localhost any port)
app.use(cors({
    origin: /^http:\/\/localhost(:\d+)?$/,
    credentials: true
}));

// IMPORTANT: Webhook endpoint MUST come BEFORE bodyParser.json()
// It needs express.raw() to verify signatures
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,  // Raw body
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.log('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('✅ Webhook received:', event.type);

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log('Payment successful for session:', session.id);

        // TODO: Save order to database here
    }

    res.json({ received: true });
});
// Body parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// JWT authentication middleware for protected routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Token verification failed:', err.message);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// POST /api/auth/register
// Registers new user with validation, bcrypt hashing, unique email check
app.post('/api/auth/register', async (req, res) => {
    try {
        let { name, email, password } = req.body;

        // Sanitize inputs
        name = (name || '').trim();
        email = (email || '').trim().toLowerCase();
        password = password || '';

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user with prepared statement
        const query = `
      INSERT INTO users (email, password, name) 
      VALUES ($1, $2, $3) 
      RETURNING id, email, name
    `;
        const result = await pool.query(query, [email, hashedPassword, name]);

        const user = result.rows[0];
        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`User registered: ${email}`);
        res.status(201).json({ message: 'User created successfully', token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        console.error('Register error:', err);
        if (err.code === '23505') { // PostgreSQL unique violation
            return res.status(409).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/login
// Logs in user, verifies password, returns token and user info
app.post('/api/auth/login', async (req, res) => {
    try {
        let { email, password } = req.body;

        // Sanitize
        email = (email || '').trim().toLowerCase();
        password = password || '';

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            console.log('Invalid login attempt for:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`User logged in: ${email}`);
        res.status(200).json({
            token,
            user: { name: user.name, email: user.email }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/auth/verify
// Verifies JWT token, returns user info if valid
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    console.log(`Token verified for user: ${req.user.email}`);
    res.status(200).json({
        valid: true,
        user: { name: req.user.name, email: req.user.email }
    });
});

// POST /api/auth/logout
// Client-side logout (clears token), server just acknowledges
app.post('/api/auth/logout', (req, res) => {
    console.log('Logout requested');
    res.status(200).json({ message: 'Logged out successfully' });
});

app.post('/api/stripe/create-checkout-session', authenticateToken, async (req, res) => {
    try {
        const { productType, quantity, subscriptionMonths } = req.body;

        if (!productType || !['one-time', 'subscription'].includes(productType)) {
            return res.status(400).json({ error: 'productType must be "one-time" or "subscription"' });
        }

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
            return res.status(400).json({ error: 'quantity must be an integer between 1 and 10' });
        }

        if (productType === 'subscription') {
            if (!Number.isInteger(subscriptionMonths) || subscriptionMonths < 1 || subscriptionMonths > 12) {
                return res.status(400).json({ error: 'subscriptionMonths must be an integer between 1 and 12' });
            }
        }

        const priceId = productType === 'one-time' ? process.env.STRIPE_PRICE_ID_ONE_TIME : process.env.STRIPE_PRICE_ID_SUBSCRIPTION;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: productType === 'one-time' ? 'payment' : 'subscription',
            customer_email: req.user.email,
            client_reference_id: req.user.id.toString(),
            line_items: [{ price: priceId, quantity }],
            ...(productType === 'subscription' && {
                subscription_data: {
                    cancel_at: Math.floor(Date.now() / 1000) + (subscriptionMonths * 30 * 24 * 60 * 60),
                    metadata: { duration_months: subscriptionMonths, user_id: req.user.id }
                }
            }),
            success_url: 'http://localhost:3000/shop.html?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: `https://localhost:3000/shop.html?cancelled=true`,
            metadata: {
                user_id: req.user.id.toString(),
                product_type: productType,
                quantity: quantity.toString(),
                ...(productType === 'subscription' && { subscription_months: subscriptionMonths.toString() })
            }
        });

        res.json({ sessionId: session.id, sessionUrl: session.url });
    } catch (err) {
        console.error('Checkout session creation error:', err);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body.toString(), sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    console.log(`Received webhook event: ${event.type}`);
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
                const metadata = session.metadata;
                const userId = parseInt(metadata.user_id);
                const productType = metadata.product_type;
                const amount = session.amount_total / 100;
                const quantity = parseInt(metadata.quantity || '1');
                await pool.query(
                    'INSERT INTO orders (user_id, stripe_session_id, stripe_payment_intent_id, product_type, quantity, amount, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [userId, session.id, session.payment_intent, productType, quantity, amount, 'completed']
                );
                // TODO: send confirmation email
                console.log('Order created for user', userId);
                break;
            case 'customer.subscription.created':
                const sub = event.data.object;
                const subMetadata = sub.metadata;
                const subUserId = parseInt(subMetadata.user_id);
                const endDate = new Date(sub.cancel_at * 1000);
                await pool.query(
                    'INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, product_id, status, duration_months, start_date, end_date, next_billing_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
                    [subUserId, sub.id, sub.customer, sub.items.data[0].price.id, sub.status, parseInt(subMetadata.duration_months), new Date(), endDate, new Date(sub.current_period_end * 1000)]
                );
                break;
            case 'customer.subscription.updated':
                const updatedSub = event.data.object;
                await pool.query('UPDATE subscriptions SET status=$1, next_billing_date=$2 WHERE stripe_subscription_id=$3', [updatedSub.status, new Date(updatedSub.current_period_end * 1000), updatedSub.id]);
                break;
            case 'customer.subscription.deleted':
                const deletedSub = event.data.object;
                await pool.query('UPDATE subscriptions SET status=$1 WHERE stripe_subscription_id=$2', ['cancelled', deletedSub.id]);
                break;
            case 'invoice.paid':
                console.log('Subscription payment succeeded:', event.data.object.subscription);
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
    } catch (err) {
        console.error(`Webhook handling error for ${event.type}:`, err);
    }
    res.json({ received: true });
});

app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Orders fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

app.get('/api/subscriptions', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM subscriptions WHERE user_id = $1 AND status != 'cancelled' ORDER BY start_date DESC", [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Subscriptions fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
});

// Error handling middleware (catch-all)
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log('Auth endpoints ready: /api/auth/register, /api/auth/login, /api/auth/verify, /api/auth/logout');
});
