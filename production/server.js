// Complete Express server for BeautyBite authentication
// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const pool = require('./db'); // Database connection pool

const { sendOrderConfirmationEmail, sendTestEmail, sendSupplierOrderLog } = require('./emailService');

// Helper function to log orders
async function logOrder(orderData) {
    try {
        const {
            userId, orderType, orderId = null, stripePaymentIntentId,
            stripeCustomerId = null, quantity, amount, status = 'completed',
            billingEmail = null, billingName = null, shippingAddress = null,
            periodNumber = null, totalPeriods = null, interval = null, notes = null,
            productType = 'standard'
        } = orderData;

        const result = await pool.query(`
            INSERT INTO order_log (
                user_id, order_type, order_id, stripe_payment_intent_id,
                stripe_customer_id, quantity, amount, status, billing_email,
                billing_name, shipping_address, period_number, total_periods,
                interval, notes, product_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
        `, [
            userId, orderType, orderId, stripePaymentIntentId, stripeCustomerId,
            quantity, amount, status, billingEmail, billingName, shippingAddress,
            periodNumber, totalPeriods, interval, notes, productType
        ]);

        const orderLog = result.rows[0];
        console.log(`✅ Order logged: ${orderType} - ${productType} - $${amount} (Log ID: ${orderLog.id})`);

        // Send confirmation email (skip if email not configured)
        try {
            if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
                await sendOrderConfirmationEmail(orderLog);
                await pool.query(
                    'UPDATE order_log SET email_sent = TRUE, email_sent_at = NOW() WHERE id = $1',
                    [orderLog.id]
                );
            } else {
                console.log('⚠️  Email not configured, skipping email');
            }
        } catch (emailError) {
            console.error('⚠️  Email sending failed (order still logged):', emailError.message);
        }

        return orderLog;
    } catch (error) {
        console.error('❌ Failed to log order:', error);
        throw error;
    }
}
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve frontend static files (src/ directory)
app.use(express.static(path.join(__dirname, '../src')));
// Serve production HTML pages (design-studio, purchase) under /studio and /checkout
app.use('/studio', express.static(path.join(__dirname)));
app.use('/assets', express.static(path.join(__dirname)));

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

        try {
            // Get session details from metadata
            const userId = session.metadata?.user_id;
            const productType = session.metadata?.product_type;
            const quantity = session.metadata?.quantity || 1;
            const subscriptionMonths = session.metadata?.subscription_months;

            if (productType === 'one-time') {
                // Insert one-time order
                await pool.query(`
                    INSERT INTO orders (user_id, stripe_session_id, stripe_payment_intent_id, product_type, quantity, amount, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    userId,
                    session.id,
                    session.payment_intent,
                    'one-time',
                    quantity,
                    session.amount_total / 100,
                    'completed'
                ]);
                console.log('✅ Order saved to database');

            } else if (productType === 'subscription') {
                // Insert subscription
                const endDate = new Date();
                endDate.setMonth(endDate.getMonth() + parseInt(subscriptionMonths));

                await pool.query(`
                    INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, product_id, status, duration_months, end_date)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [
                    userId,
                    session.subscription,
                    session.customer,
                    session.metadata?.product_id || 'prod_Tl0VtHyf9DBStQ',
                    'active',
                    subscriptionMonths,
                    endDate
                ]);
                console.log('✅ Subscription saved to database');
            }
            // Schedule subscription cancellation after duration from metadata
            if (session.mode === 'subscription' && session.subscription && session.metadata?.subscription_months) {
                try {
                    const durationMonths = parseInt(session.metadata.subscription_months);
                    const cancelAt = Math.floor(Date.now() / 1000) + (durationMonths * 30 * 24 * 60 * 60);

                    await stripe.subscriptions.update(session.subscription, {
                        cancel_at: cancelAt
                    });

                    console.log(`✅ Subscription ${session.subscription} scheduled to cancel after ${durationMonths} months`);
                } catch (subError) {
                    console.error('❌ Failed to schedule subscription cancellation:', subError);
                }
            }
        } catch (dbError) {
            console.error('❌ Database error:', dbError);
        }
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

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
            return res.status(400).json({ error: 'quantity must be an integer between 1 and 10,000' });
        }

        if (productType === 'subscription') {
            if (!Number.isInteger(subscriptionMonths) || subscriptionMonths < 1 || subscriptionMonths > 36) {
                return res.status(400).json({ error: 'subscriptionMonths must be an integer between 1 and 36' });
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
                    metadata: {
                        duration_months: subscriptionMonths,
                        user_id: req.user.id,
                        quantity_per_month: quantity
                    }
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

app.post('/api/stripe/create-payment-intent', authenticateToken, async (req, res) => {
    try {
        const { quantity } = req.body;
        const userId = req.user.id;

        // Validate quantity
        if (!quantity || quantity < 1 || quantity > 10000) {
            return res.status(400).json({ error: 'Invalid quantity (1-10000)' });
        }

        // Calculate amount (price is $200 = 20000 cents)
        const amount = quantity * 20000;

        // Create PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true
            },
            metadata: {
                user_id: userId,
                product_type: 'one-time',
                quantity: quantity
            }
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('PaymentIntent creation error:', error);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});

// Guest-accessible payment intent for custom (Tier 3) orders
// Amount is validated server-side against the known unit price to prevent tampering
app.post('/api/stripe/create-payment-intent-custom', async (req, res) => {
    try {
        const { quantity, productType, currency = 'usd', metadata = {} } = req.body;

        // Server-side pricing validation — never trust client-supplied amount
        const UNIT_PRICES = {
            'custom-branded':      30000, // $300.00 in cents
            'beautybite-branded':  20000, // $200.00 in cents
            'clear-bulk':          10000  // $100.00 in cents
        };

        const unitPrice = UNIT_PRICES[productType];
        if (!unitPrice) {
            return res.status(400).json({ error: `Unknown productType: ${productType}` });
        }

        // Validate quantity per tier rules
        const MIN_QUANTITIES = { 'custom-branded': 50, 'beautybite-branded': 1, 'clear-bulk': 1000 };
        const minQty = MIN_QUANTITIES[productType] || 1;
        if (!quantity || quantity < minQty) {
            return res.status(400).json({ error: `Minimum quantity for ${productType} is ${minQty}` });
        }

        const amount = quantity * unitPrice;

        // Sanitise metadata values
        const safeMetadata = {};
        for (const [k, v] of Object.entries(metadata)) {
            const key = String(k).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40);
            const val = String(v).slice(0, 500);
            if (key) safeMetadata[key] = val;
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            automatic_payment_methods: { enabled: true },
            metadata: {
                product_type: productType,
                quantity:     String(quantity),
                ...safeMetadata
            }
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Custom PaymentIntent creation error:', error);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});

app.post('/api/stripe/confirm-payment', authenticateToken, async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        const userId = req.user.id;
        const userEmail = req.user.email;
        const userName = req.user.name;

        // Retrieve PaymentIntent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment not completed' });
        }

        const quantity = parseInt(paymentIntent.metadata.quantity || 1);
        const amountPaid = paymentIntent.amount / 100;

        // Save to orders table
        const orderResult = await pool.query(`
            INSERT INTO orders (
                user_id, stripe_payment_intent_id, product_type,
                quantity, amount, status
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            userId,
            paymentIntent.id,
            'standard',
            quantity,
            amountPaid,
            'completed'
        ]);

        const order = orderResult.rows[0];

        // Log the order
        await logOrder({
            userId: userId,
            orderType: 'one-time',
            orderId: order.id,
            stripePaymentIntentId: paymentIntent.id,
            stripeCustomerId: paymentIntent.customer,
            quantity: quantity,
            amount: amountPaid,
            status: 'completed',
            billingEmail: userEmail,
            billingName: userName,
            productType: 'standard',
            notes: `One-time purchase of ${quantity} BeautyBite mouthguards`
        });

        console.log('✅ One-time order saved and logged');
        res.json({ order: order });

    } catch (error) {
        console.error('Payment confirmation error:', error);
        res.status(500).json({ error: 'Failed to confirm payment' });
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

app.post('/api/stripe/create-subscription-payment', authenticateToken, async (req, res) => {
    try {
        const quantity = parseInt(req.body.quantity);
        const duration = parseInt(req.body.duration);
        const interval = req.body.interval;
        if (quantity < 1 || quantity > 1000 || duration < 1 || duration > 36) {
            return res.status(400).json({ error: 'Quantity 1-1000, Duration 1-36' });
        }
        const userId = req.user.id;
        const userEmail = req.user.email;
        if (!['12hour', 'weekly', 'monthly'].includes(interval)) {
            return res.status(400).json({ error: 'Invalid interval' });
        }

        const amount = quantity * 200 * 100; // cents

        let customer;
        const existingCustomer = await pool.query(
            'SELECT stripe_customer_id FROM customers WHERE user_id = $1',
            [userId]
        );

        if (existingCustomer.rows.length > 0) {
            customer = await stripe.customers.retrieve(existingCustomer.rows[0].stripe_customer_id);
        } else {
            customer = await stripe.customers.create({
                email: userEmail,
                metadata: { user_id: userId.toString() }
            });
            await pool.query(
                'INSERT INTO customers (user_id, stripe_customer_id) VALUES ($1, $2)',
                [userId, customer.id]
            );
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            customer: customer.id,
            setup_future_usage: 'off_session',
            automatic_payment_methods: { enabled: true },
            metadata: {
                user_id: userId.toString(),
                subscription_type: 'recurring',
                quantity: quantity.toString(),
                duration: duration.toString(),
                interval
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            customerId: customer.id
        });

    } catch (error) {
        console.error('Subscription payment creation error:', error);
        res.status(500).json({ error: 'Failed to create subscription payment' });
    }
});

app.post('/api/stripe/confirm-subscription', authenticateToken, async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        const userId = req.user.id;

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment not completed' });
        }

        const { quantity, duration, interval } = paymentIntent.metadata;
        const amountPerPeriod = paymentIntent.amount / 100;

        const now = new Date();
        let nextBillingDate = new Date(now);
        let endDate = new Date(now);

        switch (interval) {
            case '12hour':
                nextBillingDate.setHours(now.getHours() + 12);
                endDate.setHours(now.getHours() + (12 * parseInt(duration)));
                break;
            case 'weekly':
                nextBillingDate.setDate(now.getDate() + 7);
                endDate.setDate(now.getDate() + (7 * parseInt(duration)));
                break;
            case 'monthly':
                nextBillingDate.setMonth(now.getMonth() + 1);
                endDate.setMonth(now.getMonth() + parseInt(duration));
                break;
        }

        const subscription = await pool.query(`
            INSERT INTO subscriptions (
                user_id, stripe_customer_id, stripe_payment_method_id,
                quantity_per_period, amount_per_period, interval,
                total_periods, periods_completed, status,
                next_billing_date, end_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            userId,
            paymentIntent.customer,
            paymentIntent.payment_method,
            parseInt(quantity),
            amountPerPeriod,
            interval,
            parseInt(duration),
            1,
            'active',
            nextBillingDate,
            endDate
        ]);

        await pool.query(`
            INSERT INTO subscription_payments (
                subscription_id, stripe_payment_intent_id, amount, status, period_number
            ) VALUES ($1, $2, $3, $4, $5)
        `, [
            subscription.rows[0].id,
            paymentIntent.id,
            amountPerPeriod,
            'succeeded',
            1
        ]);

        // ADD THIS: Log the subscription creation
        await logOrder({
            userId: userId,
            orderType: 'subscription',
            orderId: subscription.rows[0].id,
            stripePaymentIntentId: paymentIntent.id,
            stripeCustomerId: subscription.rows[0].stripe_customer_id,
            quantity: parseInt(quantity),
            amount: amountPerPeriod,
            status: 'completed',
            billingEmail: req.user.email,
            billingName: req.user.name,
            periodNumber: 1,
            totalPeriods: parseInt(duration),
            interval: interval,
            productType: 'standard',
            notes: `Subscription created: ${quantity} BeautyBite mouthguards ${interval}, Period 1 of ${duration}`
        });

        // GET /api/order-log - Returns user's order log
        app.get('/api/order-log', authenticateToken, async (req, res) => {
            try {
                const userId = req.user.id;
                const { limit = 50, offset = 0, status, orderType } = req.query;

                let query = 'SELECT * FROM order_log WHERE user_id = $1';
                let params = [userId];
                let paramCount = 1;

                if (status) {
                    paramCount++;
                    query += ` AND status = $${paramCount}`;
                    params.push(status);
                }

                if (orderType) {
                    paramCount++;
                    query += ` AND order_type = $${paramCount}`;
                    params.push(orderType);
                }

                query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
                params.push(parseInt(limit), parseInt(offset));

                const result = await pool.query(query, params);

                res.json(result.rows);
            } catch (error) {
                console.error('Order log fetch error:', error);
                res.status(500).json({ error: 'Failed to fetch order log' });
            }
        });

        // GET /api/order-log/:id - Get specific order log entry
        app.get('/api/order-log/:id', authenticateToken, async (req, res) => {
            try {
                const { id } = req.params;
                const userId = req.user.id;

                const result = await pool.query(
                    'SELECT * FROM order_log WHERE id = $1 AND user_id = $2',
                    [id, userId]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Order log not found' });
                }

                res.json(result.rows[0]);
            } catch (error) {
                console.error('Order log fetch error:', error);
                res.status(500).json({ error: 'Failed to fetch order log' });
            }
        });

        // ADMIN: Get all order logs (for admin dashboard)
        app.get('/api/admin/order-log', authenticateToken, async (req, res) => {
            try {
                // TODO: Add admin role check here
                // if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

                const { limit = 100, offset = 0 } = req.query;

                const result = await pool.query(`
                    SELECT ol.*, u.email, u.name
                    FROM order_log ol
                    JOIN users u ON ol.user_id = u.id
                    ORDER BY ol.created_at DESC
                    LIMIT $1 OFFSET $2
                `, [parseInt(limit), parseInt(offset)]);

                res.json(result.rows);
            } catch (error) {
                console.error('Admin order log fetch error:', error);
                res.status(500).json({ error: 'Failed to fetch order log' });
            }
        });

        console.log('✅ Subscription created and logged');
        console.log('✅ Subscription created:', subscription.rows[0].id);
        res.json({ subscription: subscription.rows[0] });

    } catch (error) {
        console.error('Subscription confirmation error:', error);
        res.status(500).json({ error: 'Failed to confirm subscription' });
    }
});

app.post('/api/cron/process-subscriptions', async (req, res) => {
    try {
        console.log('🔄 Processing due subscriptions...');

        const dueSubscriptions = await pool.query(`
            SELECT * FROM subscriptions
            WHERE status = 'active'
            AND next_billing_date <= NOW()
        `);

        for (const sub of dueSubscriptions.rows) {
            try {
                // Check if subscription is already complete BEFORE charging
                if (sub.periods_completed >= sub.total_periods) {
                    console.log(`✅ Subscription ${sub.id} already complete (${sub.periods_completed}/${sub.total_periods}) - marking as completed`);
                    await pool.query(
                        'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2',
                        ['completed', sub.id]
                    );
                    continue; // Skip charging, move to next subscription
                }

                // Create PaymentIntent with saved payment method
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: Math.round(sub.amount_per_period * 100),
                    currency: 'usd',
                    customer: sub.stripe_customer_id,
                    payment_method: sub.stripe_payment_method_id,
                    off_session: true,
                    confirm: true,
                    metadata: {
                        subscription_id: sub.id.toString(),
                        period_number: sub.periods_completed + 1
                    }
                });

                if (paymentIntent.status === 'succeeded') {
                    const newPeriodsCompleted = sub.periods_completed + 1;
                    const isComplete = newPeriodsCompleted >= sub.total_periods;

                    let nextBilling = new Date(sub.next_billing_date);
                    switch (sub.interval) {
                        case '12hour':
                            nextBilling.setHours(nextBilling.getHours() + 12);
                            break;
                        case 'weekly':
                            nextBilling.setDate(nextBilling.getDate() + 7);
                            break;
                        case 'monthly':
                            nextBilling.setMonth(nextBilling.getMonth() + 1);
                            break;
                    }

                    await pool.query(`
                        UPDATE subscriptions
                        SET periods_completed = $1,
                            next_billing_date = $2,
                            status = CASE WHEN $3 THEN 'completed' ELSE 'active' END,
                            updated_at = NOW()
                        WHERE id = $4
                    `, [
                        newPeriodsCompleted,
                        nextBilling,
                        isComplete,
                        sub.id
                    ]);

                    await pool.query(`
                        INSERT INTO subscription_payments (
                            subscription_id, stripe_payment_intent_id,
                            amount, status, period_number
                        ) VALUES ($1, $2, $3, $4, $5)
                    `, [
                        sub.id,
                        paymentIntent.id,
                        sub.amount_per_period,
                        'succeeded',
                        newPeriodsCompleted
                    ]);

                    console.log(`✅ Charged subscription ${sub.id}: Period ${newPeriodsCompleted}/${sub.total_periods}`);

                } else {
                    console.error(`❌ Payment failed for subscription ${sub.id}`);
                }

            } catch (error) {
                console.error(`❌ Error processing subscription ${sub.id}:`, error.message);

                if (error.code === 'card_declined') {
                    await pool.query(
                        'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2',
                        ['payment_failed', sub.id]
                    );
                }
            }
        }

        console.log('✅ Finished processing subscriptions');
        res.json({ processed: dueSubscriptions.rows.length });

    } catch (error) {
        console.error('Cron job error:', error);
        res.status(500).json({ error: 'Failed to process subscriptions' });
    }
});

app.post('/api/cron/send-supplier-log', async (req, res) => {
    try {
        console.log('📧 Sending supplier log...');
        
        // Query only UNSENT orders (no time limit - sends all pending)
        const ordersResult = await pool.query(
            `SELECT
                id, order_type, order_id, quantity, amount,
                billing_email, billing_name, period_number,
                total_periods, interval, status, created_at,
                product_type
            FROM order_log
            WHERE supplier_log_sent = FALSE
              AND status = 'completed'
            ORDER BY created_at ASC`
        );
        
        const orders = ordersResult.rows;
        const supplierEmail = process.env.SUPPLIER_EMAIL || 'Harrisonfarrell716@gmail.com';
        
        if (orders.length > 0) {
            console.log(`📦 Found ${orders.length} new unsent orders`);
            
            // Calculate date range from actual orders
            const startDate = new Date(Math.min(...orders.map(o => new Date(o.created_at))));
            const endDate = new Date(Math.max(...orders.map(o => new Date(o.created_at))));
            
            // Send the email
            await sendSupplierOrderLog(orders, supplierEmail, startDate, endDate);
            
            // Mark all these orders as sent
            const orderIds = orders.map(o => o.id);
            await pool.query(
                `UPDATE order_log
                 SET supplier_log_sent = TRUE,
                     supplier_log_sent_at = NOW()
                 WHERE id = ANY($1)`,
                [orderIds]
            );
            
            console.log(`✅ Marked ${orderIds.length} orders as sent`);
            res.json({
                success: true,
                ordersCount: orders.length,
                orderIds: orderIds
            });
        } else {
            console.log('ℹ️  No new orders to send in supplier log');
            res.json({
                success: true,
                ordersCount: 0,
                message: 'No new orders'
            });
        }
    } catch (error) {
        console.error('❌ Cron send-supplier-log failed:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
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
        const userId = req.user.id;
        const result = await pool.query(`
            SELECT s.*,
                   COALESCE(SUM(CASE WHEN sp.status = 'succeeded' THEN sp.amount ELSE 0 END), 0) as total_paid
            FROM subscriptions s
            LEFT JOIN subscription_payments sp ON s.id = sp.subscription_id
            WHERE s.user_id = $1
            GROUP BY s.id
            ORDER BY s.created_at DESC
        `, [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Fetch subscriptions error:', error);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
});

app.post('/api/test-email', authenticateToken, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({ error: 'Valid email required' });
        }
        await sendTestEmail(email);
        res.json({ success: true, message: 'Test email sent successfully' });
    } catch (error) {
        console.error('Test email error:', error);
        res.status(500).json({ error: 'Failed to send test email' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Stripe publishable key endpoint
// Safe to expose — this is the public key, never the secret key
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/config/stripe-publishable-key', (req, res) => {
    const key = process.env.STRIPE_PUBLISHABLE_KEY;
    if (!key) {
        return res.status(503).json({ error: 'Stripe not configured. Add STRIPE_PUBLISHABLE_KEY to .env' });
    }
    res.json({ publishableKey: key });
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom order recording endpoint (Tier 3)
// Called after Stripe payment succeeds on the frontend
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/orders/custom', async (req, res) => {
    const {
        stripePaymentIntentId,
        quantity,
        brandColor,
        materialType,
        brandText,
        logoFilename,
        billingEmail,
        billingName,
        shippingAddress
    } = req.body;

    // Basic validation
    if (!stripePaymentIntentId || !quantity || quantity < 50) {
        return res.status(400).json({ error: 'stripePaymentIntentId and quantity (min 50) are required' });
    }

    // Sanitise text fields — prevent stored XSS
    const safeBrandText   = brandText    ? String(brandText).replace(/[<>"'&]/g, '').slice(0, 100) : null;
    const safeBrandColor  = brandColor   && /^#[0-9A-Fa-f]{3,6}$/.test(brandColor) ? brandColor : '#ffffff';
    const safeMaterial    = ['standard','glossy','metallic'].includes(materialType) ? materialType : 'standard';
    const safeLogoFile    = logoFilename ? String(logoFilename).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 255) : null;

    const unitPrice  = 300.00;
    const totalPrice = quantity * unitPrice;

    try {
        // 1. Log to order_log (existing table)
        const orderLogResult = await logOrder({
            userId:                null,    // guest checkout — no account required
            orderType:             'one_time',
            stripePaymentIntentId,
            quantity,
            amount:                totalPrice,
            status:                'completed',
            billingEmail:          billingEmail  || null,
            billingName:           billingName   || null,
            shippingAddress:       shippingAddress || null,
            productType:           'custom-branded',
            notes:                 `Custom order: color=${safeBrandColor} material=${safeMaterial}`
        });

        // 2. Store design details in custom_order_designs
        const designResult = await pool.query(`
            INSERT INTO custom_order_designs
                (order_log_id, brand_color, material_type, brand_text, logo_filename, quantity, unit_price)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            orderLogResult.id,
            safeBrandColor,
            safeMaterial,
            safeBrandText,
            safeLogoFile,
            quantity,
            unitPrice
        ]);

        console.log(`✅ Custom order design saved: ID ${designResult.rows[0].id} — qty ${quantity} — ${safeBrandColor}`);

        res.json({
            success:     true,
            orderLogId:  orderLogResult.id,
            designId:    designResult.rows[0].id,
            totalPrice
        });

    } catch (error) {
        console.error('❌ Custom order recording failed:', error);
        // Still return 200 so the frontend shows success — payment already completed
        // The order will show up in Stripe dashboard even if our DB write fails
        res.status(500).json({ error: 'Order recorded in Stripe but failed to save design details. Contact support.' });
    }
});

// ── Saved Designs ──────────────────────────────────────────────────────────
// Auto-create table on first use
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS saved_designs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL DEFAULT 'My Design',
                config JSONB NOT NULL DEFAULT '{}',
                thumbnail_data TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
    } catch(e) { console.warn('saved_designs table creation skipped:', e.message); }
})();

app.get('/api/designs', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, config, thumbnail_data, created_at, updated_at FROM saved_designs WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50',
            [req.user.id]
        );
        res.json({ designs: result.rows });
    } catch(e) {
        res.status(500).json({ error: 'Failed to fetch designs' });
    }
});

app.post('/api/designs', authenticateToken, async (req, res) => {
    const { name, config, thumbnail_data } = req.body;
    if (!config) return res.status(400).json({ error: 'config required' });
    try {
        const result = await pool.query(
            'INSERT INTO saved_designs (user_id, name, config, thumbnail_data) VALUES ($1, $2, $3, $4) RETURNING id, name, created_at',
            [req.user.id, name || 'My Design', JSON.stringify(config), thumbnail_data || null]
        );
        res.json({ design: result.rows[0] });
    } catch(e) {
        res.status(500).json({ error: 'Failed to save design' });
    }
});

app.delete('/api/designs/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM saved_designs WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Failed to delete design' });
    }
});

// ── HTML page routes ──────────────────────────────────────────────────────────
app.get('/design-studio', (req, res) => res.sendFile(path.join(__dirname, 'design-studio.html')));
app.get('/checkout',      (req, res) => res.sendFile(path.join(__dirname, 'purchase.html')));
app.get('/shop',          (req, res) => res.sendFile(path.join(__dirname, '../src/shop.html')));
app.get('/login',         (req, res) => res.sendFile(path.join(__dirname, '../src/login.html')));
app.get('/register',      (req, res) => res.sendFile(path.join(__dirname, '../src/register.html')));
app.get('/cart',          (req, res) => res.sendFile(path.join(__dirname, '../src/cart.html')));
app.get('/dashboard',     (req, res) => res.sendFile(path.join(__dirname, '../src/dashboard.html')));

// Catch-all: serve index.html for any unmatched GET (SPA-style)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, '../src/index.html'));
});

// Error handling middleware (catch-all)
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🦷  BeautyBite running at http://localhost:${PORT}\n`);
});
