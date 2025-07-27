// File: trainforge/api/scripts/setup-firebase.js
// Firebase project setup script for development

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
            console.log('📋 To setup Firebase:');
            console.log('1. Go to Firebase Console: https://console.firebase.google.com');
            console.log('2. Create a new project or select existing one');
            console.log('3. Go to Project Settings > Service Accounts');
            console.log('4. Click "Generate new private key"');
            console.log('5. Save the JSON file as: trainforge/api/config/firebase-service-account.json');
            console.log('6. Create .env file from .env.example');
            console.log('7. Run this script again');
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
        
        // Create sample collections and setup indexes
        console.log('📊 Setting up Firestore collections...');
        
        // Create a sample job document to initialize collection
        const sampleJob = {
            job_id: 'sample-job-12345',
            project_name: 'sample-project',
            status: 'completed',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            config: {
                project: { name: 'sample-project' },
                training: { script: 'train.py' },
                resources: { gpu: 1, cpu: 2, memory: '4Gi' }
            }
        };
        
        await db.collection('training_jobs').doc('sample-job-12345').set(sampleJob);
        console.log('✅ Sample job document created');
        
        // Create indexes (Firestore will auto-create these, but good to document)
        console.log('📝 Required Firestore indexes:');
        console.log('   - training_jobs: status (ASC), created_at (ASC)');
        console.log('   - training_jobs: created_at (DESC)');
        
        console.log('✅ Firebase setup completed successfully!');
        console.log(`🔗 Project ID: ${serviceAccount.project_id}`);
        console.log('🚀 You can now start the API server with: npm start');
        
        // Clean up sample document
        await db.collection('training_jobs').doc('sample-job-12345').delete();
        console.log('🧹 Cleaned up sample data');
        
    } catch (error) {
        console.error('❌ Firebase setup failed:', error.message);
        
        if (error.code === 'auth/invalid-service-account') {
            console.log('💡 The service account file seems invalid. Please check:');
            console.log('   - File is valid JSON');
            console.log('   - Downloaded from correct Firebase project');
            console.log('   - Has necessary permissions');
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