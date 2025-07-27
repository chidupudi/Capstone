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

            await mongoose.connect(mongoUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });

            this.isConnected = true;
            console.log('✅ MongoDB connected successfully');
            
            // Log database info
            const dbName = mongoose.connection.db.databaseName;
            console.log(`📊 Connected to database: ${dbName}`);

        } catch (error) {
            console.error('❌ MongoDB connection failed:', error.message);
            throw error;
        }
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