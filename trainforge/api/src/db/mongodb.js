// File: trainforge/api/src/db/mongodb.js
// MongoDB connection and configuration

const mongoose = require('mongoose');
require('dotenv').config();

class MongoDB {
    constructor() {
        this.isConnected = false;
    }

    async connect() {
        try {
            const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trainforge';

            console.log('🍃 Connecting to MongoDB...');
            console.log(`📍 Database URI: ${mongoUri}`);

            // Enhanced connection options to prevent freezing (compatible with newer Mongoose)
            await mongoose.connect(mongoUri, {
                maxPoolSize: 10,          // Maintain up to 10 socket connections
                serverSelectionTimeoutMS: 5000,  // Keep trying to send operations for 5 seconds
                socketTimeoutMS: 45000,   // Close sockets after 45 seconds of inactivity
                family: 4,                // Use IPv4, skip trying IPv6
                connectTimeoutMS: 10000,  // Give up initial connection after 10 seconds
                heartbeatFrequencyMS: 10000, // Send a ping every 10 seconds
            });

            // Set up connection event handlers
            this.setupConnectionHandlers();

            this.isConnected = true;
            console.log('✅ MongoDB connected successfully');

            // Log database info
            const dbName = mongoose.connection.db.databaseName;
            console.log(`📊 Connected to database: ${dbName}`);

        } catch (error) {
            console.error('❌ MongoDB connection failed:', error.message);
            this.isConnected = false;
            throw error;
        }
    }

    setupConnectionHandlers() {
        const connection = mongoose.connection;

        connection.on('connected', () => {
            console.log('🔗 MongoDB connection established');
            this.isConnected = true;
        });

        connection.on('error', (error) => {
            console.error('❌ MongoDB connection error:', error);
            this.isConnected = false;
        });

        connection.on('disconnected', () => {
            console.log('⚠️ MongoDB disconnected');
            this.isConnected = false;
        });

        connection.on('reconnected', () => {
            console.log('🔄 MongoDB reconnected');
            this.isConnected = true;
        });

        // Handle connection timeout
        connection.on('timeout', () => {
            console.error('⏰ MongoDB connection timeout');
            this.isConnected = false;
        });

        // Handle server selection timeout
        connection.on('serverSelectionError', (error) => {
            console.error('❌ MongoDB server selection error:', error.message);
            this.isConnected = false;
        });
    }

    async disconnect() {
        try {
            await mongoose.disconnect();
            this.isConnected = false;
            console.log('👋 MongoDB disconnected');
        } catch (error) {
            console.error('❌ MongoDB disconnect failed:', error.message);
        }
    }

    getConnection() {
        if (!this.isConnected) {
            throw new Error('MongoDB not connected. Call connect() first.');
        }
        return mongoose.connection;
    }
}

// Create singleton instance
const mongoDB = new MongoDB();

module.exports = mongoDB;