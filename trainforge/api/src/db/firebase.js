// File: trainforge/api/src/db/firebase.js
// Firebase Admin SDK initialization — replaces mongodb.js

const admin = require('firebase-admin');
const path = require('path');

let initialized = false;
let db = null;

class FirebaseDB {
    constructor() {
        this.isConnected = false;
    }

    async connect() {
        if (initialized) {
            this.isConnected = true;
            return;
        }

        try {
            console.log('🔥 Initializing Firebase Admin SDK...');

            // Path to the service account key file
            // FIREBASE_KEY_PATH in .env is relative to the api/ root (process.cwd())
            const rawPath = process.env.FIREBASE_KEY_PATH ||
                './train-forge-firebase-adminsdk-fbsvc-cb9c09cc5e.json';

            // Resolve relative to process.cwd() (the api/ directory when you run npm start)
            const keyPath = path.isAbsolute(rawPath)
                ? rawPath
                : path.resolve(process.cwd(), rawPath);

            const serviceAccount = require(keyPath);

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id
            });

            db = admin.firestore();

            // Firestore settings for better performance
            db.settings({
                ignoreUndefinedProperties: true
            });

            initialized = true;
            this.isConnected = true;

            console.log(`✅ Firebase connected — project: ${serviceAccount.project_id}`);
            console.log(`📂 Firestore ready`);

        } catch (error) {
            console.error('❌ Firebase initialization failed:', error.message);
            this.isConnected = false;
            throw error;
        }
    }

    async disconnect() {
        try {
            if (admin.apps.length > 0) {
                await admin.app().delete();
            }
            this.isConnected = false;
            initialized = false;
            db = null;
            console.log('👋 Firebase disconnected');
        } catch (error) {
            console.error('❌ Firebase disconnect failed:', error.message);
        }
    }

    getFirestore() {
        if (!db) throw new Error('Firebase not initialized. Call connect() first.');
        return db;
    }
}

const firebaseDB = new FirebaseDB();

// Export the singleton and a helper to get Firestore
module.exports = firebaseDB;
module.exports.getDB = () => {
    if (!db) throw new Error('Firebase not initialized');
    return db;
};
