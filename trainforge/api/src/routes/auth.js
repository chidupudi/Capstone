// File: trainforge/api/src/routes/auth.js
// Authentication routes for TrainForge API

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { storeToken, removeToken, verifyToken, ADMIN_EMAIL } = require('../middleware/auth');

// Admin credentials (in production, use database with hashed passwords!)
const ADMIN_CREDENTIALS = {
    email: ADMIN_EMAIL,
    password: 'rupesh@',
    isAdmin: true
};

/**
 * POST /api/auth/login
 * Authenticate user (admin or normal) via Firebase
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const isAdminCreds = email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password;

        if (isAdminCreds) {
            // Bypass Firebase entirely for the hardcoded admin
            const token = crypto.randomBytes(32).toString('hex') + '.admin.token'; // Force 3-part format just in case

            storeToken(token, email, true);
            console.log(`✅ Admin login successful via hardcoded credentials: ${email}`);

            return res.status(200).json({
                success: true,
                token: token,
                email: email,
                is_admin: true,
                uid: `admin-${email}`,
                login_time: new Date().toISOString(),
                message: 'Authenticated successfully as Admin'
            });
        }

        const apiKey = process.env.FIREBASE_API_KEY;
        if (!apiKey) {
            console.error('FIREBASE_API_KEY is not set in environment variables');
            return res.status(500).json({ success: false, message: 'Server configuration error' });
        }

        // Authenticate with Firebase REST API
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true })
        });

        const data = await response.json();

        if (!response.ok) {
            console.warn(`⚠️ Failed login attempt: ${email} - ${data.error?.message}`);
            return res.status(401).json({
                success: false,
                message: data.error?.message || 'Invalid email or password'
            });
        }

        const token = data.idToken;
        const isAdmin = email === ADMIN_CREDENTIALS.email; // If an admin logged in with Firebase credentials instead

        // Optionally store the token if it's an admin, to support the legacy custom admin token path
        if (isAdmin) {
            storeToken(token, email, true);
            console.log(`✅ Admin login successful via Firebase: ${email}`);
        } else {
            console.log(`✅ User login successful via Firebase: ${email}`);
        }

        return res.status(200).json({
            success: true,
            token: token,
            email: email,
            is_admin: isAdmin,
            uid: data.localId,
            login_time: new Date().toISOString(),
            message: 'Authenticated successfully'
        });

    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication failed',
            error: error.message
        });
    }
});

/**
 * POST /api/auth/verify
 * Verify authentication token
 */
router.post('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        // In production, verify token from database
        // For now, just return success
        return res.status(200).json({
            success: true,
            message: 'Token is valid'
        });

    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Token verification failed'
        });
    }
});

/**
 * POST /api/auth/logout
 * Log out user
 */
router.post('/logout', async (req, res) => {
    try {
        // In production, invalidate token in database
        return res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
});

module.exports = router;
