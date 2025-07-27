// File: trainforge/api/scripts/enable-firestore.js
// Script to enable Firestore using Firebase Admin SDK

const admin = require('firebase-admin');
const path = require('path');

async function enableFirestore() {
    console.log('🔥 Attempting to enable Firestore...');
    
    try {
        // Load service account
        const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
        const serviceAccount = require(serviceAccountPath);
        
        console.log(`📋 Project ID: ${serviceAccount.project_id}`);
        
        // Initialize Firebase Admin with explicit project
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id,
                databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com/`
            });
        }
        
        console.log('✅ Firebase Admin SDK initialized');
        
        // Try to get Firestore instance (this will trigger creation if possible)
        console.log('🔄 Attempting to access Firestore...');
        
        const db = admin.firestore();
        
        // Try a very simple operation
        const settings = {
            ignoreUndefinedProperties: true
        };
        db.settings(settings);
        
        // Test with a minimal operation
        console.log('🧪 Testing minimal Firestore operation...');
        
        // This should either work or give us a more specific error
        try {
            await db.runTransaction(async (transaction) => {
                // Just try to create a transaction - this tests if Firestore is accessible
                return Promise.resolve('test');
            });
            console.log('✅ Firestore is working!');
        } catch (transactionError) {
            console.log('❌ Transaction test failed:', transactionError.message);
            
            if (transactionError.message.includes('UNAUTHENTICATED')) {
                console.log('\n💡 Solution: Enable Firestore in Firebase Console');
                console.log('   1. Go to: https://console.firebase.google.com');
                console.log('   2. Select your project: train-forge');
                console.log('   3. Click "Firestore Database" in sidebar');
                console.log('   4. Click "Create database"');
                console.log('   5. Choose "Start in test mode"');
                console.log('   6. Select a location and click "Done"');
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

enableFirestore();