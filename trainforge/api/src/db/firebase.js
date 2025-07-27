// File: trainforge/api/src/db/firebase.js
// Firebase Admin SDK configuration and initialization

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

class FirebaseDB {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            // Initialize Firebase Admin SDK
            if (!admin.apps.length) {
                // For local development, use service account key
                const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
                    path.join(__dirname, '../../config/firebase-service-account.json');
                
                let credential;
                
                if (process.env.NODE_ENV === 'production') {
                    // In production, use environment variables
                    credential = admin.credential.cert({
                        projectId: process.env.FIREBASE_PROJECT_ID,
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
                    });
                } else {
                    // In development, use service account file
                    try {
                        credential = admin.credential.cert(require(serviceAccountPath));
                    } catch (error) {
                        console.warn('Service account file not found, using default credentials');
                        credential = admin.credential.applicationDefault();
                    }
                }

                admin.initializeApp({
                    credential: credential,
                    projectId: process.env.FIREBASE_PROJECT_ID || 'trainforge-dev'
                });
            }

            this.db = admin.firestore();
            this.initialized = true;
            console.log('✅ Firebase initialized successfully');
            
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error.message);
            throw error;
        }
    }

    getDB() {
        if (!this.initialized) {
            throw new Error('Firebase not initialized. Call initialize() first.');
        }
        return this.db;
    }

    // Helper method to generate server timestamp
    getServerTimestamp() {
        return admin.firestore.FieldValue.serverTimestamp();
    }

    // Helper method to generate document ID
    generateId() {
        return this.db.collection('temp').doc().id;
    }
}

// Create singleton instance
const firebaseDB = new FirebaseDB();

module.exports = firebaseDB;