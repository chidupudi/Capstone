// File: trainforge/api/scripts/setup-firebase-simple.js
// Simplified Firebase setup script

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function setupFirebase() {
    console.log('🔥 Setting up Firebase for TrainForge...');
    
    try {
        // Check if service account file exists
        const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
        
        if (!fs.existsSync(serviceAccountPath)) {
            console.log('❌ Firebase service account file not found!');
            console.log('📋 Please place firebase-service-account.json in config/ directory');
            return;
        }

        // Initialize Firebase Admin
        const serviceAccount = require(serviceAccountPath);
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id
            });
        }

        const db = admin.firestore();
        
        console.log('✅ Firebase Admin SDK initialized');
        console.log(`🔗 Project ID: ${serviceAccount.project_id}`);
        
        // Test Firestore connection with a simple read
        console.log('🧪 Testing Firestore connection...');
        
        // Try to read from a collection (will create it if it doesn't exist)
        const testCollection = db.collection('_test');
        const testDoc = await testCollection.doc('connection-test').get();
        
        console.log('✅ Firestore connection successful!');
        
        // Create the training_jobs collection structure by writing a sample document
        console.log('📊 Setting up training_jobs collection...');
        
        const sampleJob = {
            job_id: 'setup-test-job',
            project_name: 'setup-test',
            status: 'completed',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            config: {
                project: { name: 'setup-test' },
                training: { script: 'train.py' },
                resources: { gpu: 1, cpu: 2, memory: '4Gi' }
            },
            progress: 100,
            logs: ['Setup test completed'],
            resources: { gpu: 1, cpu: 2, memory: '4Gi' },
            training_script: 'train.py',
            started_at: admin.firestore.FieldValue.serverTimestamp(),
            completed_at: admin.firestore.FieldValue.serverTimestamp(),
            error_message: null,
            gpu_id: null,
            worker_node: null,
            duration: '5 seconds'
        };
        
        await db.collection('training_jobs').doc('setup-test-job').set(sampleJob);
        console.log('✅ Sample training job created in Firestore');
        
        // Verify we can read it back
        const createdJob = await db.collection('training_jobs').doc('setup-test-job').get();
        if (createdJob.exists) {
            console.log('✅ Sample job verified - read back successfully');
        }
        
        // Clean up test documents
        await db.collection('training_jobs').doc('setup-test-job').delete();
        await db.collection('_test').doc('connection-test').delete();
        console.log('🧹 Cleaned up test data');
        
        console.log('🎉 Firebase setup completed successfully!');
        console.log('🚀 You can now start the API server with: npm start');
        
    } catch (error) {
        console.error('❌ Firebase setup failed:', error.message);
        
        if (error.message.includes('UNAUTHENTICATED')) {
            console.log('💡 Authentication failed. Please check:');
            console.log('   1. Firestore Database is created in Firebase Console');
            console.log('   2. Firestore rules allow read/write (test mode)');
            console.log('   3. Service account has proper permissions');
            console.log('   4. Project ID matches in service account file');
        }
        
        if (error.message.includes('PERMISSION_DENIED')) {
            console.log('💡 Permission denied. Please:');
            console.log('   1. Set Firestore rules to test mode');
            console.log('   2. Ensure service account has Editor role');
        }
    }
}

// Run setup if called directly
if (require.main === module) {
    setupFirebase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { setupFirebase };