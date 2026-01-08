// server.js - Complete Express backend for BeautyBite authentication
// Features: Register, Login, Verify JWT, Logout (client-side)
// DB: PostgreSQL via pg pool, bcrypt for hashing, JWT for tokens
// Validation: Email regex, password length
// Error handling: 400, 401, 409, 500 with messages
// CORS: All origins for development

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');  // PostgreSQL pool

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' }));  // Allow all origins in development; restrict in production
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Simple email validation regex
const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

// POST /api/auth/register
// Body: { name, email, password }
// Creates user if email unique, hashes password (10 rounds), returns user without pw
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Missing required fields: name, email, password' });
        }
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        // Hash password with 10 salt rounds
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user with prepared statement (prevents SQL injection)
        const result = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
            [name, email, hashedPassword]
        );

        console.log('✅ New user registered:', result.rows[0].email);
        res.status(201).json({
            message: 'User created successfully',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Register error:', error);
        // PostgreSQL unique violation error code
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Email already exists' });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
});

// POST /api/auth/login
// Body: { email, password }
// Verifies credentials, signs JWT (7 days), returns token and user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password required' });
        }

        // Find user by email
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        // Verify password hash
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Sign JWT with user id and email, expires in 7 days
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log('✅ User logged in:', user.email);
        res.status(200).json({
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /api/auth/verify
// Header: Authorization: Bearer <token>
// Verifies JWT, returns user if valid
app.get('/api/auth/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];  // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ message: 'Authorization token required' });
        }

        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch fresh user data
        const result = await pool.query(
            'SELECT id, name, email FROM users WHERE id = $1',
            [decoded.id]
        );
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        console.log('✅ Token verified for user:', user.email);
        res.status(200).json({ valid: true, user });
    } catch (error) {
        console.error('❌ Verify error:', error.message);
        res.status(401).json({ message: 'Invalid or expired token' });
    }
});

// POST /api/auth/logout
// Client-side only: clears token in frontend
app.post('/api/auth/logout', (req, res) => {
    console.log('👋 Logout requested');
    res.status(200).json({ message: 'Logged out successfully (token cleared client-side)' });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Global error handler (optional)
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Health: http://localhost:${PORT}/health`);
});

module.exports = app;  // For testing if needed
