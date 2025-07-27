// File: trainforge/api/src/db/models.js
// Database models and operations using Firebase Firestore

const firebaseDB = require('./firebase');
const { v4: uuidv4 } = require('uuid');

class JobModel {
    constructor() {
        this.collection = 'training_jobs';
    }

    async createJob(jobData) {
        try {
            const db = firebaseDB.getDB();
            const jobId = uuidv4();
            
            const job = {
                job_id: jobId,
                project_name: jobData.project?.name || 'untitled-project',
                training_script: jobData.training?.script || 'train.py',
                status: 'pending',
                progress: 0,
                resources: jobData.resources || { gpu: 1, cpu: 2, memory: '4Gi' },
                config: jobData,
                created_at: firebaseDB.getServerTimestamp(),
                updated_at: firebaseDB.getServerTimestamp(),
                started_at: null,
                completed_at: null,
                logs: [],
                error_message: null,
                gpu_id: null,
                worker_node: null,
                duration: null
            };

            await db.collection(this.collection).doc(jobId).set(job);
            
            // Return job with timestamp converted for client
            return {
                ...job,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error creating job:', error);
            throw new Error(`Failed to create job: ${error.message}`);
        }
    }

    async getJob(jobId) {
        try {
            const db = firebaseDB.getDB();
            const doc = await db.collection(this.collection).doc(jobId).get();
            
            if (!doc.exists) {
                throw new Error('Job not found');
            }

            const jobData = doc.data();
            
            // Convert Firestore timestamps to ISO strings
            return this.formatJob(jobData);

        } catch (error) {
            console.error('Error getting job:', error);
            throw new Error(`Failed to get job: ${error.message}`);
        }
    }

    async updateJob(jobId, updates) {
        try {
            const db = firebaseDB.getDB();
            
            const updateData = {
                ...updates,
                updated_at: firebaseDB.getServerTimestamp()
            };

            await db.collection(this.collection).doc(jobId).update(updateData);
            
            // Return updated job
            return await this.getJob(jobId);

        } catch (error) {
            console.error('Error updating job:', error);
            throw new Error(`Failed to update job: ${error.message}`);
        }
    }

    async listJobs(limit = 50) {
        try {
            const db = firebaseDB.getDB();
            const snapshot = await db.collection(this.collection)
                .orderBy('created_at', 'desc')
                .limit(limit)
                .get();
            
            const jobs = [];
            snapshot.forEach(doc => {
                jobs.push(this.formatJob(doc.data()));
            });

            return jobs;

        } catch (error) {
            console.error('Error listing jobs:', error);
            throw new Error(`Failed to list jobs: ${error.message}`);
        }
    }

    async addJobLog(jobId, logEntry) {
        try {
            const db = firebaseDB.getDB();
            
            const logData = {
                timestamp: new Date().toISOString(),
                message: logEntry
            };

            await db.collection(this.collection).doc(jobId).update({
                logs: firebaseDB.getDB().FieldValue.arrayUnion(logData),
                updated_at: firebaseDB.getServerTimestamp()
            });

        } catch (error) {
            console.error('Error adding job log:', error);
            throw new Error(`Failed to add job log: ${error.message}`);
        }
    }

    async getJobsByStatus(status) {
        try {
            const db = firebaseDB.getDB();
            const snapshot = await db.collection(this.collection)
                .where('status', '==', status)
                .orderBy('created_at', 'asc')
                .get();
            
            const jobs = [];
            snapshot.forEach(doc => {
                jobs.push(this.formatJob(doc.data()));
            });

            return jobs;

        } catch (error) {
            console.error('Error getting jobs by status:', error);
            throw new Error(`Failed to get jobs by status: ${error.message}`);
        }
    }

    formatJob(jobData) {
        // Convert Firestore timestamps to ISO strings for API response
        const formatted = { ...jobData };
        
        if (jobData.created_at && jobData.created_at.toDate) {
            formatted.created_at = jobData.created_at.toDate().toISOString();
        }
        if (jobData.updated_at && jobData.updated_at.toDate) {
            formatted.updated_at = jobData.updated_at.toDate().toISOString();
        }
        if (jobData.started_at && jobData.started_at.toDate) {
            formatted.started_at = jobData.started_at.toDate().toISOString();
        }
        if (jobData.completed_at && jobData.completed_at.toDate) {
            formatted.completed_at = jobData.completed_at.toDate().toISOString();
        }

        return formatted;
    }
}

// Create singleton instance
const jobModel = new JobModel();

module.exports = {
    JobModel: jobModel
};