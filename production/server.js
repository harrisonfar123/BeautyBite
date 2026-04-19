// BeautyBite production server — hardened
require('dotenv').config();

const express        = require('express');
const cors           = require('cors');
const bodyParser     = require('body-parser');
const jwt            = require('jsonwebtoken');
const bcrypt         = require('bcrypt');
const path           = require('path');
const crypto         = require('crypto');
const helmet         = require('helmet');
const rateLimit      = require('express-rate-limit');
const pool           = require('./db');

const { sendOrderConfirmationEmail, sendTestEmail, sendSupplierOrderLog } = require('./emailService');

// ─────────────────────────────────────────────────────────────────────────────
// Fail-fast on missing required secrets in production
// ─────────────────────────────────────────────────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
if (process.env.NODE_ENV === 'production') {
    const missing = REQUIRED_ENV.filter(k => !process.env[k]);
    if (missing.length) {
        console.error('FATAL: missing required env vars:', missing.join(', '));
        process.exit(1);
    }
    if (!process.env.CRON_SECRET)    console.warn('WARN: CRON_SECRET not set — cron endpoints will reject all requests.');
    if (!process.env.SUPPLIER_EMAIL) console.warn('WARN: SUPPLIER_EMAIL not set — supplier log cron will return 503.');
    if (!process.env.APP_URL)        console.warn('WARN: APP_URL not set — Stripe redirect URLs may be incorrect.');
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app    = express();
const PORT   = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.disable('x-powered-by');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function timingSafeEqualStr(a, b) {
    try {
        const ab = Buffer.from(String(a));
        const bb = Buffer.from(String(b));
        if (ab.length !== bb.length) return false;
        return crypto.timingSafeEqual(ab, bb);
    } catch { return false; }
}

async function issueTokens(user) {
    const payload = {
        id:    user.id,
        email: user.email,
        name:  user.name,
        role:  user.role || 'customer'
    };
    const accessToken  = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshHash  = hashRefreshToken(refreshToken);
    const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    try {
        await pool.query(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [user.id, refreshHash, expiresAt]
        );
    } catch (err) {
        console.error('refresh_tokens insert failed:', err.message);
    }

    return { accessToken, refreshToken };
}

// ─────────────────────────────────────────────────────────────────────────────
// Security middleware
// ─────────────────────────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc:  ["'self'", "'unsafe-inline'", 'https://js.stripe.com', 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
            styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc:    ["'self'", 'https://fonts.gstatic.com', 'data:'],
            imgSrc:     ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'", 'https://api.stripe.com'],
            frameSrc:   ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
            objectSrc:  ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS — env-driven allowlist (no wildcards, no localhost regex in prod)
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5500,http://localhost:8080')
    .split(',').map(s => s.trim()).filter(Boolean);
function isAllowedOrigin(origin) {
    if (!origin) return true; // same-origin / curl / mobile
    if (allowedOrigins.includes(origin)) return true;
    try {
        const host = new URL(origin).host;
        // Auto-allow our Heroku deploys and BeautyBite domains
        if (host.endsWith('.herokuapp.com')) return true;
        if (host === 'beautybite.co' || host.endsWith('.beautybite.co')) return true;
    } catch (_) {}
    return false;
}
app.use(cors({
    origin: (origin, cb) => {
        if (isAllowedOrigin(origin)) return cb(null, true);
        console.warn('CORS blocked:', origin);
        return cb(null, false); // reject without throwing → no 500
    },
    credentials: true
}));

// Rate limiters
const globalLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false });
const authLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,   standardHeaders: true, legacyHeaders: false, message: { error: 'Too many auth attempts, try again later' }});
const paymentLimiter = rateLimit({ windowMs:  1 * 60 * 1000, max: 20,   standardHeaders: true, legacyHeaders: false });
app.use(globalLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// Static (explicit whitelist — never serve the whole production/ directory)
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../src')));

const PRODUCTION_HTML_WHITELIST = ['design-studio.html', 'purchase.html', 'orders.html', 'dashboard.html', 'shop.html', 'login.html'];
app.get('/studio/:file', (req, res, next) => {
    const file = req.params.file;
    if (!PRODUCTION_HTML_WHITELIST.includes(file)) return next();
    res.sendFile(path.join(__dirname, file));
});

// ─────────────────────────────────────────────────────────────────────────────
// Stripe webhook — must come BEFORE json bodyparser (needs raw body)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.log('Webhook signature verification failed:', err.message);
        return res.status(400).send('Webhook Error');
    }

    console.log('Webhook received:', event.type);

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session        = event.data.object;
                const userId         = session.metadata?.user_id ? parseInt(session.metadata.user_id) : null;
                const productType    = session.metadata?.product_type;
                const quantity       = parseInt(session.metadata?.quantity || 1);
                const subscriptionMonths = session.metadata?.subscription_months;

                if (productType === 'one-time') {
                    await pool.query(
                        'INSERT INTO orders (user_id, stripe_session_id, stripe_payment_intent_id, product_type, quantity, amount, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        [userId, session.id, session.payment_intent, 'one-time', quantity, session.amount_total / 100, 'completed']
                    );
                } else if (productType === 'subscription') {
                    const endDate = new Date();
                    endDate.setMonth(endDate.getMonth() + parseInt(subscriptionMonths || 1));
                    await pool.query(
                        'INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, product_id, status, duration_months, end_date) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        [userId, session.subscription, session.customer, session.metadata?.product_id || 'prod_default', 'active', subscriptionMonths, endDate]
                    );
                }

                if (session.mode === 'subscription' && session.subscription && subscriptionMonths) {
                    try {
                        const durationMonths = parseInt(subscriptionMonths);
                        const cancelAt       = Math.floor(Date.now() / 1000) + (durationMonths * 30 * 24 * 60 * 60);
                        await stripe.subscriptions.update(session.subscription, { cancel_at: cancelAt });
                    } catch (subErr) {
                        console.error('Failed to schedule subscription cancellation:', subErr.message);
                    }
                }
                break;
            }
            case 'customer.subscription.updated': {
                const sub = event.data.object;
                await pool.query(
                    'UPDATE subscriptions SET status=$1, next_billing_date=$2 WHERE stripe_subscription_id=$3',
                    [sub.status, new Date(sub.current_period_end * 1000), sub.id]
                );
                break;
            }
            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                await pool.query('UPDATE subscriptions SET status=$1 WHERE stripe_subscription_id=$2', ['cancelled', sub.id]);
                break;
            }
            case 'invoice.paid':
                console.log('Subscription invoice paid:', event.data.object.subscription);
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
    } catch (err) {
        console.error(`Webhook handling error for ${event.type}:`, err.message);
    }

    res.json({ received: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Body parsers (after webhook, with sane limits)
// ─────────────────────────────────────────────────────────────────────────────
app.use(bodyParser.json({ limit: '500kb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '100kb' }));

// ─────────────────────────────────────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────────────────────────────────────
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token      = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(401).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
};

const requireCronSecret = (req, res, next) => {
    const provided = req.headers['x-cron-secret'];
    if (!process.env.CRON_SECRET || !provided || !timingSafeEqualStr(provided, process.env.CRON_SECRET)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: order logger
// ─────────────────────────────────────────────────────────────────────────────
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
        console.log(`Order logged: ${orderType} - ${productType} - $${amount} (Log ID: ${orderLog.id})`);

        try {
            if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
                await sendOrderConfirmationEmail(orderLog);
                await pool.query('UPDATE order_log SET email_sent = TRUE, email_sent_at = NOW() WHERE id = $1', [orderLog.id]);
            }
        } catch (emailError) {
            console.error('Email sending failed (order still logged):', emailError.message);
        }

        return orderLog;
    } catch (error) {
        console.error('Failed to log order:', error);
        throw error;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth routes
// ─────────────────────────────────────────────────────────────────────────────
function validatePasswordStrength(pw) {
    if (!pw || pw.length < 12) return 'Password must be at least 12 characters';
    if (!/[A-Z]/.test(pw))     return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(pw))     return 'Password must contain a lowercase letter';
    if (!/[0-9]/.test(pw))     return 'Password must contain a digit';
    return null;
}

app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        let { name, email, password } = req.body;
        name     = (name || '').trim().slice(0, 100);
        email    = (email || '').trim().toLowerCase().slice(0, 254);
        password = password || '';

        if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
        if (!emailRegex.test(email))       return res.status(400).json({ error: 'Invalid email format' });
        const pwErr = validatePasswordStrength(password);
        if (pwErr) return res.status(400).json({ error: pwErr });

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = await pool.query(
            'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
            [email, hashedPassword, name]
        );

        const user = result.rows[0];
        const { accessToken, refreshToken } = await issueTokens(user);

        console.log(`User registered: ${email}`);
        res.status(201).json({
            message: 'User created successfully',
            token: accessToken,
            refreshToken,
            user: { id: user.id, name: user.name, email: user.email, role: user.role || 'customer' }
        });
    } catch (err) {
        console.error('Register error:', err.message);
        const isUniqueViolation =
            err.code === '23505' || err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
            (typeof err.message === 'string' && err.message.includes('UNIQUE constraint'));
        if (isUniqueViolation) return res.status(409).json({ error: 'Email already exists' });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        let { email, password } = req.body;
        email    = (email || '').trim().toLowerCase();
        password = password || '';

        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user   = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const { accessToken, refreshToken } = await issueTokens(user);

        console.log(`User logged in: ${email}`);
        res.status(200).json({
            token: accessToken,
            refreshToken,
            user: { id: user.id, name: user.name, email: user.email, role: user.role || 'customer' }
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/refresh', authLimiter, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

        const hash = hashRefreshToken(refreshToken);
        const result = await pool.query(
            'SELECT rt.*, u.id as uid, u.email, u.name FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()',
            [hash]
        );
        if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid refresh token' });

        const row = result.rows[0];

        // Revoke old, issue new (rotation)
        await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1', [hash]);

        const user = { id: row.uid, email: row.email, name: row.name, role: 'customer' };
        const { accessToken, refreshToken: newRefresh } = await issueTokens(user);

        res.json({ token: accessToken, refreshToken: newRefresh, user });
    } catch (err) {
        console.error('Refresh error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.status(200).json({
        valid: true,
        user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role || 'customer' }
    });
});

app.post('/api/auth/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body || {};
        if (refreshToken) {
            const hash = hashRefreshToken(refreshToken);
            await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1', [hash]);
        }
    } catch (err) {
        console.error('Logout error:', err.message);
    }
    res.status(200).json({ message: 'Logged out successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stripe: checkout session
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/stripe/create-checkout-session', authenticateToken, paymentLimiter, async (req, res) => {
    try {
        const { productType, quantity, subscriptionMonths } = req.body;
        const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

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
            customer_email:       req.user.email,
            client_reference_id:  req.user.id.toString(),
            line_items: [{ price: priceId, quantity }],
            ...(productType === 'subscription' && {
                subscription_data: {
                    metadata: {
                        duration_months:    subscriptionMonths,
                        user_id:            req.user.id,
                        quantity_per_month: quantity
                    }
                }
            }),
            success_url: `${appUrl}/shop.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  `${appUrl}/shop.html?cancelled=true`,
            metadata: {
                user_id:     req.user.id.toString(),
                product_type: productType,
                quantity:    quantity.toString(),
                ...(productType === 'subscription' && { subscription_months: subscriptionMonths.toString() })
            }
        });

        res.json({ sessionId: session.id, sessionUrl: session.url });
    } catch (err) {
        console.error('Checkout session creation error:', err.message);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Stripe: payment intents
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/stripe/create-payment-intent', authenticateToken, paymentLimiter, async (req, res) => {
    try {
        const { quantity } = req.body;
        const userId = req.user.id;

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
            return res.status(400).json({ error: 'Invalid quantity (1-10000)' });
        }
        const amount = quantity * 20000;

        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            metadata: { user_id: String(userId), product_type: 'one-time', quantity: String(quantity) }
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('PaymentIntent creation error:', error.message);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});

app.post('/api/stripe/create-payment-intent-custom', paymentLimiter, async (req, res) => {
    try {
        const { quantity, productType, currency = 'usd', metadata = {} } = req.body;

        // Currency allowlist — never accept arbitrary currency
        if (currency !== 'usd') return res.status(400).json({ error: 'Only USD is supported' });

        const UNIT_PRICES    = { 'custom-branded': 30000, 'beautybite-branded': 20000, 'clear-bulk': 10000 };
        const MIN_QUANTITIES = { 'custom-branded': 1,     'beautybite-branded': 1,     'clear-bulk': 1     };

        const unitPrice = UNIT_PRICES[productType];
        if (!unitPrice) return res.status(400).json({ error: 'Unknown productType' });

        const minQty = MIN_QUANTITIES[productType] || 1;
        if (!Number.isInteger(quantity) || quantity < minQty || quantity > 100000) {
            return res.status(400).json({ error: `quantity must be integer between ${minQty} and 100,000` });
        }

        const amount = quantity * unitPrice;

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
            metadata: { product_type: productType, quantity: String(quantity), ...safeMetadata }
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Custom PaymentIntent creation error:', error.message);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});

app.post('/api/stripe/confirm-payment', authenticateToken, paymentLimiter, async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        if (!paymentIntentId || !/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) {
            return res.status(400).json({ error: 'Invalid paymentIntentId' });
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment not completed' });
        }

        const quantity   = parseInt(paymentIntent.metadata.quantity || 1);
        const expectedAmount = quantity * 20000;
        if (paymentIntent.amount !== expectedAmount) {
            console.warn(`Amount mismatch on PI ${paymentIntentId}: got ${paymentIntent.amount}, expected ${expectedAmount}`);
            return res.status(400).json({ error: 'Amount mismatch' });
        }

        const amountPaid = paymentIntent.amount / 100;
        const userId     = req.user.id;

        const orderResult = await pool.query(
            'INSERT INTO orders (user_id, stripe_payment_intent_id, product_type, quantity, amount, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [userId, paymentIntent.id, 'standard', quantity, amountPaid, 'completed']
        );
        const order = orderResult.rows[0];

        await logOrder({
            userId,
            orderType:             'one-time',
            orderId:               order.id,
            stripePaymentIntentId: paymentIntent.id,
            stripeCustomerId:      paymentIntent.customer,
            quantity,
            amount:                amountPaid,
            status:                'completed',
            billingEmail:          req.user.email,
            billingName:           req.user.name,
            productType:           'standard',
            notes:                 `One-time purchase of ${quantity} BeautyBite mouthguards`
        });

        res.json({ order });
    } catch (error) {
        console.error('Payment confirmation error:', error.message);
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Stripe: recurring subscription payment intent
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/stripe/create-subscription-payment', authenticateToken, paymentLimiter, async (req, res) => {
    try {
        const quantity = parseInt(req.body.quantity);
        const duration = parseInt(req.body.duration);
        const interval = req.body.interval;

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000 ||
            !Number.isInteger(duration) || duration < 1 || duration > 36) {
            return res.status(400).json({ error: 'Quantity 1-1000, Duration 1-36' });
        }
        if (!['12hour', 'weekly', 'monthly'].includes(interval)) {
            return res.status(400).json({ error: 'Invalid interval' });
        }

        const userId    = req.user.id;
        const userEmail = req.user.email;
        const amount    = quantity * 200 * 100;

        let customer;
        const existing = await pool.query('SELECT stripe_customer_id FROM customers WHERE user_id = $1', [userId]);
        if (existing.rows.length > 0) {
            customer = await stripe.customers.retrieve(existing.rows[0].stripe_customer_id);
        } else {
            customer = await stripe.customers.create({ email: userEmail, metadata: { user_id: userId.toString() } });
            await pool.query('INSERT INTO customers (user_id, stripe_customer_id) VALUES ($1, $2)', [userId, customer.id]);
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            customer: customer.id,
            setup_future_usage: 'off_session',
            automatic_payment_methods: { enabled: true },
            metadata: {
                user_id:           userId.toString(),
                subscription_type: 'recurring',
                quantity:          quantity.toString(),
                duration:          duration.toString(),
                interval
            }
        });

        res.json({ clientSecret: paymentIntent.client_secret, customerId: customer.id });
    } catch (error) {
        console.error('Subscription payment creation error:', error.message);
        res.status(500).json({ error: 'Failed to create subscription payment' });
    }
});

app.post('/api/stripe/confirm-subscription', authenticateToken, paymentLimiter, async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        if (!paymentIntentId || !/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) {
            return res.status(400).json({ error: 'Invalid paymentIntentId' });
        }

        const userId        = req.user.id;
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') return res.status(400).json({ error: 'Payment not completed' });

        // Verify the PI belongs to this user
        if (paymentIntent.metadata.user_id !== String(userId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const quantityN = parseInt(paymentIntent.metadata.quantity);
        const expected  = quantityN * 200 * 100;
        if (paymentIntent.amount !== expected) {
            return res.status(400).json({ error: 'Amount mismatch' });
        }

        const duration = paymentIntent.metadata.duration;
        const interval = paymentIntent.metadata.interval;
        const amountPerPeriod = paymentIntent.amount / 100;

        const now              = new Date();
        let   nextBillingDate  = new Date(now);
        let   endDate          = new Date(now);
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
            quantityN,
            amountPerPeriod,
            interval,
            parseInt(duration),
            1,
            'active',
            nextBillingDate,
            endDate
        ]);

        await pool.query(
            'INSERT INTO subscription_payments (subscription_id, stripe_payment_intent_id, amount, status, period_number) VALUES ($1, $2, $3, $4, $5)',
            [subscription.rows[0].id, paymentIntent.id, amountPerPeriod, 'succeeded', 1]
        );

        await logOrder({
            userId,
            orderType:             'subscription',
            orderId:               subscription.rows[0].id,
            stripePaymentIntentId: paymentIntent.id,
            stripeCustomerId:      subscription.rows[0].stripe_customer_id,
            quantity:              quantityN,
            amount:                amountPerPeriod,
            status:                'completed',
            billingEmail:          req.user.email,
            billingName:           req.user.name,
            periodNumber:          1,
            totalPeriods:          parseInt(duration),
            interval,
            productType:           'standard',
            notes:                 `Subscription created: ${quantityN} mouthguards ${interval}, Period 1 of ${duration}`
        });

        res.json({ subscription: subscription.rows[0] });
    } catch (error) {
        console.error('Subscription confirmation error:', error.message);
        res.status(500).json({ error: 'Failed to confirm subscription' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Order log (top-level, not nested)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/order-log', authenticateToken, async (req, res) => {
    try {
        const userId     = req.user.id;
        const limit      = Math.min(parseInt(req.query.limit)  || 50,  200);
        const offset     = Math.max(parseInt(req.query.offset) || 0,   0);
        const { status, orderType } = req.query;

        let query  = 'SELECT * FROM order_log WHERE user_id = $1';
        let params = [userId];
        let i      = 1;

        if (status)    { i++; query += ` AND status = $${i}`;     params.push(String(status).slice(0, 50)); }
        if (orderType) { i++; query += ` AND order_type = $${i}`; params.push(String(orderType).slice(0, 50)); }

        query += ` ORDER BY created_at DESC LIMIT $${i + 1} OFFSET $${i + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Order log fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch order log' });
    }
});

app.get('/api/order-log/:id', authenticateToken, async (req, res) => {
    try {
        const id     = parseInt(req.params.id);
        const userId = req.user.id;
        if (!id) return res.status(400).json({ error: 'Invalid id' });

        const result = await pool.query('SELECT * FROM order_log WHERE id = $1 AND user_id = $2', [id, userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Order log not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Order log fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch order log' });
    }
});

app.get('/api/admin/order-log', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
        const offset = Math.max(parseInt(req.query.offset) || 0,   0);

        const result = await pool.query(
            'SELECT ol.*, u.email, u.name FROM order_log ol JOIN users u ON ol.user_id = u.id ORDER BY ol.created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Admin order log fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch order log' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cron (protected by CRON_SECRET header)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/cron/process-subscriptions', requireCronSecret, async (req, res) => {
    try {
        const dueSubscriptions = await pool.query(`
            SELECT * FROM subscriptions WHERE status = 'active' AND next_billing_date <= NOW()
        `);

        for (const sub of dueSubscriptions.rows) {
            try {
                if (sub.periods_completed >= sub.total_periods) {
                    await pool.query('UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2', ['completed', sub.id]);
                    continue;
                }

                const paymentIntent = await stripe.paymentIntents.create({
                    amount:         Math.round(sub.amount_per_period * 100),
                    currency:       'usd',
                    customer:       sub.stripe_customer_id,
                    payment_method: sub.stripe_payment_method_id,
                    off_session:    true,
                    confirm:        true,
                    metadata:       { subscription_id: sub.id.toString(), period_number: sub.periods_completed + 1 }
                });

                if (paymentIntent.status === 'succeeded') {
                    const newPeriodsCompleted = sub.periods_completed + 1;
                    const isComplete          = newPeriodsCompleted >= sub.total_periods;

                    let nextBilling = new Date(sub.next_billing_date);
                    switch (sub.interval) {
                        case '12hour':  nextBilling.setHours(nextBilling.getHours() + 12); break;
                        case 'weekly':  nextBilling.setDate(nextBilling.getDate() + 7);   break;
                        case 'monthly': nextBilling.setMonth(nextBilling.getMonth() + 1); break;
                    }

                    await pool.query(
                        `UPDATE subscriptions SET periods_completed = $1, next_billing_date = $2, status = CASE WHEN $3 THEN 'completed' ELSE 'active' END, updated_at = NOW() WHERE id = $4`,
                        [newPeriodsCompleted, nextBilling, isComplete, sub.id]
                    );
                    await pool.query(
                        'INSERT INTO subscription_payments (subscription_id, stripe_payment_intent_id, amount, status, period_number) VALUES ($1, $2, $3, $4, $5)',
                        [sub.id, paymentIntent.id, sub.amount_per_period, 'succeeded', newPeriodsCompleted]
                    );
                }
            } catch (error) {
                console.error(`Error processing subscription ${sub.id}:`, error.message);
                if (error.code === 'card_declined') {
                    await pool.query('UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2', ['payment_failed', sub.id]);
                }
            }
        }

        res.json({ processed: dueSubscriptions.rows.length });
    } catch (error) {
        console.error('Cron job error:', error.message);
        res.status(500).json({ error: 'Failed to process subscriptions' });
    }
});

app.post('/api/cron/send-supplier-log', requireCronSecret, async (req, res) => {
    try {
        const supplierEmail = process.env.SUPPLIER_EMAIL;
        if (!supplierEmail) {
            return res.status(503).json({ error: 'SUPPLIER_EMAIL not configured' });
        }

        const ordersResult = await pool.query(
            `SELECT id, order_type, order_id, quantity, amount, billing_email, billing_name,
                    period_number, total_periods, interval, status, created_at, product_type
             FROM order_log WHERE supplier_log_sent = FALSE AND status = 'completed' ORDER BY created_at ASC`
        );
        const orders = ordersResult.rows;

        if (orders.length === 0) return res.json({ success: true, ordersCount: 0, message: 'No new orders' });

        const startDate = new Date(Math.min(...orders.map(o => new Date(o.created_at))));
        const endDate   = new Date(Math.max(...orders.map(o => new Date(o.created_at))));

        await sendSupplierOrderLog(orders, supplierEmail, startDate, endDate);

        const orderIds = orders.map(o => o.id);
        await pool.query(
            'UPDATE order_log SET supplier_log_sent = TRUE, supplier_log_sent_at = NOW() WHERE id = ANY($1)',
            [orderIds]
        );
        res.json({ success: true, ordersCount: orders.length, orderIds });
    } catch (error) {
        console.error('Cron send-supplier-log failed:', error.message);
        res.status(500).json({ success: false, error: 'Internal error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// User-facing data routes
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Orders fetch error:', err.message);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

app.get('/api/subscriptions', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(`
            SELECT s.*, COALESCE(SUM(CASE WHEN sp.status = 'succeeded' THEN sp.amount ELSE 0 END), 0) as total_paid
            FROM subscriptions s
            LEFT JOIN subscription_payments sp ON s.id = sp.subscription_id
            WHERE s.user_id = $1
            GROUP BY s.id
            ORDER BY s.created_at DESC
        `, [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Fetch subscriptions error:', error.message);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
});

app.post('/api/test-email', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !emailRegex.test(email)) return res.status(400).json({ error: 'Valid email required' });
        await sendTestEmail(email);
        res.json({ success: true, message: 'Test email sent successfully' });
    } catch (error) {
        console.error('Test email error:', error.message);
        res.status(500).json({ error: 'Failed to send test email' });
    }
});

app.get('/api/config/stripe-publishable-key', (req, res) => {
    const key = process.env.STRIPE_PUBLISHABLE_KEY;
    if (!key) return res.status(503).json({ error: 'Stripe not configured' });
    res.json({ publishableKey: key });
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom order recording — verifies Stripe PaymentIntent server-side
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/orders/custom', paymentLimiter, async (req, res) => {
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

    if (!stripePaymentIntentId || !/^pi_[A-Za-z0-9_]+$/.test(stripePaymentIntentId)) {
        return res.status(400).json({ error: 'Invalid stripePaymentIntentId' });
    }
    if (!Number.isInteger(quantity) || quantity < 50 || quantity > 100000) {
        return res.status(400).json({ error: 'quantity must be integer between 50 and 100,000' });
    }

    const UNIT_PRICES = { 'custom-branded': 30000 };
    const unitPriceCents = UNIT_PRICES['custom-branded'];
    const expectedAmount = quantity * unitPriceCents;

    try {
        // Server-side Stripe verification — prevents client tampering
        const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment not completed' });
        }
        if (paymentIntent.amount !== expectedAmount) {
            console.warn(`Custom order amount mismatch: got ${paymentIntent.amount}, expected ${expectedAmount}`);
            return res.status(400).json({ error: 'Amount mismatch' });
        }

        // Sanitise inputs
        const safeBrandText  = brandText    ? String(brandText).replace(/[<>"'&]/g, '').slice(0, 100) : null;
        const safeBrandColor = brandColor   && /^#[0-9A-Fa-f]{3,6}$/.test(brandColor) ? brandColor : '#ffffff';
        const safeMaterial   = ['standard','glossy','metallic'].includes(materialType) ? materialType : 'standard';
        const safeLogoFile   = logoFilename ? String(logoFilename).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 255) : null;
        const safeEmail      = billingEmail && emailRegex.test(billingEmail) ? billingEmail.slice(0, 254) : null;
        const safeName       = billingName ? String(billingName).slice(0, 100) : null;
        const safeShipping   = shippingAddress ? String(shippingAddress).slice(0, 500) : null;

        const totalPrice = quantity * (unitPriceCents / 100);

        const orderLogResult = await logOrder({
            userId:                null,
            orderType:             'one_time',
            stripePaymentIntentId,
            quantity,
            amount:                totalPrice,
            status:                'completed',
            billingEmail:          safeEmail,
            billingName:           safeName,
            shippingAddress:       safeShipping,
            productType:           'custom-branded',
            notes:                 `Custom order: color=${safeBrandColor} material=${safeMaterial}`
        });

        const designResult = await pool.query(`
            INSERT INTO custom_order_designs
                (order_log_id, brand_color, material_type, brand_text, logo_filename, quantity, unit_price)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            orderLogResult.id, safeBrandColor, safeMaterial, safeBrandText, safeLogoFile, quantity, unitPriceCents / 100
        ]);

        console.log(`Custom order design saved: ID ${designResult.rows[0].id} — qty ${quantity}`);

        res.json({ success: true, orderLogId: orderLogResult.id, designId: designResult.rows[0].id, totalPrice });
    } catch (error) {
        console.error('Custom order recording failed:', error.message);
        res.status(500).json({ error: 'Failed to record order' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Saved designs
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
    // config stored as TEXT (serialized JSON) — compact text storage that
    // works on both Postgres (Heroku) and libSQL/SQLite (local dev).
    const isPg    = !!process.env.DATABASE_URL;
    const pk      = isPg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    const nowFn   = isPg ? 'NOW()'              : 'CURRENT_TIMESTAMP';

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS saved_designs (
                id ${pk},
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL DEFAULT 'My Design',
                config TEXT NOT NULL DEFAULT '{}',
                thumbnail_data TEXT,
                created_at TIMESTAMP DEFAULT ${nowFn},
                updated_at TIMESTAMP DEFAULT ${nowFn}
            )
        `);
    } catch (e) { console.warn('saved_designs table creation skipped:', e.message); }

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id ${pk},
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash VARCHAR(128) NOT NULL UNIQUE,
                expires_at TIMESTAMP NOT NULL,
                revoked_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT ${nowFn}
            )
        `);
    } catch (e) { console.warn('refresh_tokens table creation skipped:', e.message); }
})();

app.get('/api/designs', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, config, thumbnail_data, created_at, updated_at FROM saved_designs WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50',
            [req.user.id]
        );
        const designs = result.rows.map(r => {
            let cfg = r.config;
            if (typeof cfg === 'string') {
                try { cfg = JSON.parse(cfg); } catch (_) { cfg = {}; }
            }
            return { ...r, config: cfg };
        });
        res.json({ designs });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch designs' });
    }
});

app.post('/api/designs', authenticateToken, async (req, res) => {
    const { name, config, thumbnail_data } = req.body;
    if (!config) return res.status(400).json({ error: 'config required' });

    const cfgStr = JSON.stringify(config);
    if (cfgStr.length > 200 * 1024)              return res.status(413).json({ error: 'config too large' });
    if (thumbnail_data && String(thumbnail_data).length > 300 * 1024) return res.status(413).json({ error: 'thumbnail too large' });

    try {
        const result = await pool.query(
            'INSERT INTO saved_designs (user_id, name, config, thumbnail_data) VALUES ($1, $2, $3, $4) RETURNING id, name, created_at',
            [req.user.id, (name || 'My Design').slice(0, 100), cfgStr, thumbnail_data || null]
        );
        res.json({ design: result.rows[0] });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save design' });
    }
});

app.delete('/api/designs/:id', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ error: 'Invalid id' });
        await pool.query('DELETE FROM saved_designs WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete design' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// HTML page routes
// ─────────────────────────────────────────────────────────────────────────────
app.get('/design-studio', (req, res) => res.sendFile(path.join(__dirname, 'design-studio.html')));
app.get('/checkout',      (req, res) => res.sendFile(path.join(__dirname, 'purchase.html')));
app.get('/shop',          (req, res) => res.sendFile(path.join(__dirname, '../src/shop.html')));

// Product detail pages (slug-driven; the page reads location.pathname)
const PRODUCT_SLUGS = new Set(['clear', 'branded', 'custom']);
app.get('/product/:slug', (req, res, next) => {
    if (!PRODUCT_SLUGS.has(String(req.params.slug).toLowerCase())) return next();
    res.sendFile(path.join(__dirname, '../src/product.html'));
});
app.get('/login',         (req, res) => res.sendFile(path.join(__dirname, '../src/login.html')));
app.get('/register',      (req, res) => res.sendFile(path.join(__dirname, '../src/register.html')));
app.get('/cart',          (req, res) => res.sendFile(path.join(__dirname, '../src/cart.html')));
app.get('/dashboard',     (req, res) => res.sendFile(path.join(__dirname, '../src/dashboard.html')));

// SPA catch-all
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, '../src/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`\nBeautyBite running at http://localhost:${PORT}\n`);
});
