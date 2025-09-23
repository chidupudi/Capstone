// File: trainforge/api/src/index_improved.js
// Improved Express server for TrainForge API with better error handling and monitoring

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import MongoDB and routes
const mongoDB = require('./db/mongodb');
const jobRoutes = require('./routes/jobs');
const workerRoutes = require('./routes/workers');

const app = express();
const PORT = process.env.PORT || 3000;

// Process monitoring
let requestCount = 0;
let lastHealthCheck = Date.now();

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting with better configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased limit for external workers
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request tracking and timeout middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const requestId = ++requestCount;

    console.log(`[${timestamp}] ${requestId}: ${req.method} ${req.path}`);

    // Set request timeout to prevent hanging
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            console.error(`⏰ Request ${requestId} timeout: ${req.method} ${req.path}`);
            res.status(408).json({ error: 'Request timeout' });
        }
    }, 30000);

    // Clear timeout when response finishes
    res.on('finish', () => {
        clearTimeout(timeout);
    });

    // Store request ID for debugging
    req.requestId = requestId;

    next();
});

// Health check endpoint with detailed information
app.get('/health', async (req, res) => {
    try {
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();

        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '0.1.0',
            service: 'trainforge-api',
            database: mongoDB.isConnected ? 'connected' : 'disconnected',
            uptime: Math.floor(uptime),
            memory: {
                rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100
            },
            requests: requestCount
        };

        lastHealthCheck = Date.now();
        res.json(healthData);

    } catch (error) {
        console.error('❌ Health check error:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// API routes
app.use('/api/jobs', jobRoutes);
app.use('/api/workers', workerRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'TrainForge API Server',
        version: '0.1.0',
        database: 'MongoDB',
        status: mongoDB.isConnected ? 'healthy' : 'database_disconnected',
        endpoints: {
            health: '/health',
            jobs: '/api/jobs',
            workers: '/api/workers'
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.warn(`🔍 404: ${req.method} ${req.originalUrl} (Request ${req.requestId})`);
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
        requestId: req.requestId
    });
});

// Enhanced global error handler
app.use((error, req, res, next) => {
    console.error(`❌ Unhandled error (Request ${req.requestId}):`, error);

    // Don't send error response if headers already sent
    if (res.headersSent) {
        return next(error);
    }

    const errorResponse = {
        error: 'Internal server error',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
    };

    if (process.env.NODE_ENV === 'development') {
        errorResponse.message = error.message;
        errorResponse.stack = error.stack;
    }

    res.status(error.status || 500).json(errorResponse);
});

// Memory monitoring function
function logMemoryUsage() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    const usage = {
        rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
    };

    console.log(`📊 [${Math.floor(uptime)}s] Memory: RSS ${usage.rss}MB | Heap ${usage.heapUsed}/${usage.heapTotal}MB | External ${usage.external}MB | Requests: ${requestCount}`);

    // Warning if memory usage is high
    if (usage.heapUsed > 500) {
        console.warn(`⚠️ High memory usage detected: ${usage.heapUsed}MB`);

        // Force garbage collection if available
        if (global.gc) {
            console.log('🗑️ Running garbage collection...');
            global.gc();
        }
    }

    // Check for memory leaks (continuously growing heap)
    if (usage.heapUsed > usage.heapTotal * 0.9) {
        console.error('🚨 Potential memory leak detected!');
    }
}

// Database connection health monitoring
function monitorDatabase() {
    if (!mongoDB.isConnected) {
        console.warn('⚠️ Database connection lost, attempting to reconnect...');

        // Attempt reconnection
        mongoDB.connect()
            .then(() => {
                console.log('🔄 Database reconnected successfully');
            })
            .catch((error) => {
                console.error('❌ Database reconnection failed:', error.message);
            });
    }
}

// Initialize MongoDB and start server
async function startServer() {
    try {
        console.log('🚀 Starting TrainForge API Server...');
        console.log(`📝 Process ID: ${process.pid}`);
        console.log(`💾 Node.js version: ${process.version}`);

        // Connect to MongoDB
        await mongoDB.connect();

        // Start the server
        const server = app.listen(PORT, () => {
            console.log(`✅ Server running on http://localhost:${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log('🍃 MongoDB connected successfully');
        });

        // Set server timeouts to prevent hanging connections
        server.timeout = 60000; // 60 seconds
        server.keepAliveTimeout = 65000; // 65 seconds
        server.headersTimeout = 66000; // 66 seconds

        // Start monitoring
        console.log('📊 Starting monitoring...');

        // Memory monitoring every 30 seconds
        setInterval(logMemoryUsage, 30000);

        // Database connection monitoring every 60 seconds
        setInterval(monitorDatabase, 60000);

        // Setup graceful shutdown handlers
        setupGracefulShutdown(server);

        return server;

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown setup
function setupGracefulShutdown(server) {
    // Graceful shutdown function
    async function gracefulShutdown(signal) {
        console.log(`\n🛑 ${signal} received, graceful shutdown initiated...`);

        // Stop accepting new connections
        server.close((err) => {
            if (err) {
                console.error('❌ Error closing HTTP server:', err);
            } else {
                console.log('🚪 HTTP server closed');
            }

            // Close MongoDB connection
            mongoDB.disconnect()
                .then(() => {
                    console.log('✅ Graceful shutdown completed');
                    process.exit(0);
                })
                .catch((error) => {
                    console.error('❌ Error during shutdown:', error);
                    process.exit(1);
                });
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
            console.error('⏰ Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    }

    // Handle different shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('❌ Uncaught Exception:', error);
        gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
        // Log but don't exit - this might be recoverable
    });

    // Handle warnings
    process.on('warning', (warning) => {
        console.warn('⚠️ Process warning:', warning.name, warning.message);
    });
}

// Start the server
if (require.main === module) {
    startServer().catch((error) => {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    });
}

module.exports = { app, startServer };