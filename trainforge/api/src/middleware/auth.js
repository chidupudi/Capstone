const { getAuth } = require('firebase-admin/auth');

const ADMIN_EMAIL = 'rupesh@trainforge.com';

/**
 * Simple token storage for admin auth (in production, use database)
 * Format: { token: { email, isAdmin, createdAt } }
 */
const tokenStore = new Map();

/**
 * Middleware to verify authentication tokens (Firebase OR custom admin tokens).
 * Supports both Firebase ID tokens and custom admin tokens.
 */
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'No token provided. Format: Authorization: Bearer <token>'
        });
    }

    const token = authHeader.split('Bearer ')[1]?.trim();

    if (!token || token === 'null' || token === 'undefined') {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or missing token'
        });
    }

    // FIRST: Try custom admin token
    const adminUser = tokenStore.get(token);
    if (adminUser) {
        req.user = {
            email: adminUser.email,
            isAdmin: adminUser.isAdmin,
            uid: `admin-${adminUser.email}`,
            token: token,
            authType: 'admin'
        };
        return next();
    }

    // SECOND: Try Firebase token
    if (token.split('.').length !== 3) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid token format'
        });
    }

    try {
        const decodedToken = await getAuth().verifyIdToken(token);
        req.user = {
            ...decodedToken,
            isAdmin: decodedToken.email === ADMIN_EMAIL,
            token: token,
            authType: 'firebase'
        };
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired token',
            details: error.message
        });
    }
};

/**
 * Middleware to ensure the user is an admin.
 * Requires verifyToken to have been run first.
 */
const isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required'
        });
    }

    if (req.user.email === ADMIN_EMAIL || req.user.isAdmin) {
        next();
    } else {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin access required. Only administrators can access this resource.'
        });
    }
};

/**
 * Optional authentication (doesn't fail if no token)
 * Used for endpoints that work better with auth but don't require it
 */
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // No auth, continue anyway
    }

    const token = authHeader.split('Bearer ')[1]?.trim();

    if (!token || token === 'null' || token === 'undefined') {
        return next(); // No valid token, proceed without auth
    }

    // Try custom admin token first
    const adminUser = tokenStore.get(token);
    if (adminUser) {
        req.user = {
            email: adminUser.email,
            isAdmin: adminUser.isAdmin,
            uid: `admin-${adminUser.email}`,
            token: token,
            authType: 'admin'
        };
        return next();
    }

    // Try Firebase token
    if (token.split('.').length === 3) {
        try {
            const decodedToken = await getAuth().verifyIdToken(token);
            req.user = {
                ...decodedToken,
                isAdmin: decodedToken.email === ADMIN_EMAIL,
                token: token,
                authType: 'firebase'
            };
        } catch (error) {
            // Silently fail for optional auth
            console.log('Optional auth: Invalid token, continuing without auth');
        }
    }

    next();
};

/**
 * Store a new admin token
 */
function storeToken(token, email, isAdmin) {
    tokenStore.set(token, {
        email,
        isAdmin,
        createdAt: new Date().toISOString()
    });
    console.log(`✅ Token stored for ${email} (Admin: ${isAdmin})`);
}

/**
 * Remove a token
 */
function removeToken(token) {
    const wasDeleted = tokenStore.delete(token);
    if (wasDeleted) {
        console.log('✅ Token removed');
    }
    return wasDeleted;
}

/**
 * Get user by token
 */
function getUserByToken(token) {
    return tokenStore.get(token);
}

/**
 * Check if email is admin
 */
function isAdminEmail(email) {
    return email === ADMIN_EMAIL;
}

/**
 * Get all stored tokens (for debugging)
 */
function getAllTokens() {
    return Array.from(tokenStore.entries()).map(([token, data]) => ({
        token: token.substring(0, 10) + '...',
        email: data.email,
        isAdmin: data.isAdmin,
        createdAt: data.createdAt
    }));
}

module.exports = {
    verifyToken,
    isAdmin,
    optionalAuth,
    storeToken,
    removeToken,
    getUserByToken,
    isAdminEmail,
    getAllTokens,
    ADMIN_EMAIL
};
