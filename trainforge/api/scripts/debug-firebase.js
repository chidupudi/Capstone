// File: trainforge/api/scripts/debug-firebase.js
// Debug Firebase connection issues

const admin = require('firebase-admin');
const path = require('path');

async function debugFirebase() {
    console.log('🔍 Debugging Firebase connection...');
    
    try {
        // Load service account
        const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
        const serviceAccount = require(serviceAccountPath);
        
        console.log('📋 Service Account Info:');
        console.log(`   Project ID: ${serviceAccount.project_id}`);
        console.log(`   Client Email: ${serviceAccount.client_email}`);
        console.log(`   Type: ${serviceAccount.type}`);
        
        // Initialize Firebase
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id
            });
        }
        
        console.log('✅ Firebase Admin SDK initialized');
        
        // Test different operations
        const db = admin.firestore();
        
        console.log('🧪 Testing Firestore operations...');
        
        // Test 1: List collections (should work even if empty)
        try {
            const collections = await db.listCollections();
            console.log(`✅ Collections found: ${collections.length}`);
            collections.forEach(col => console.log(`   - ${col.id}`));
        } catch (error) {
            console.log(`❌ List collections failed: ${error.message}`);
        }
        
        // Test 2: Simple write operation
        try {
            const testRef = db.collection('_debug').doc('test');
            await testRef.set({ test: true, timestamp: new Date() });
            console.log('✅ Write operation successful');
            
            // Test 3: Read operation
            const snapshot = await testRef.get();
            if (snapshot.exists) {
                console.log('✅ Read operation successful');
                console.log(`   Data: ${JSON.stringify(snapshot.data())}`);
            }
            
            // Clean up
            await testRef.delete();
            console.log('✅ Delete operation successful');
            
        } catch (error) {
            console.log(`❌ Firestore operations failed: ${error.message}`);
            
            if (error.code === 7) {
                console.log('💡 This is a PERMISSION_DENIED error');
                console.log('   Solution: Set Firestore rules to test mode in Firebase Console');
            }
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
    }
}

debugFirebase();