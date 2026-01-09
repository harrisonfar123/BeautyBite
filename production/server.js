// Complete Express server for BeautyBite authentication
// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('./db'); // Database connection pool

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// CORS for development (frontend on localhost any port)
app.use(cors({
    origin: /^http:\/\/localhost(:\d+)?$/,
    credentials: true
}));

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
