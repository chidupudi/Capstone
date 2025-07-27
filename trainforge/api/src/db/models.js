// File: trainforge/api/src/db/models.js
// MongoDB models using Mongoose

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Training Job Schema
const TrainingJobSchema = new mongoose.Schema({
    job_id: {
        type: String,
        unique: true,
        default: () => uuidv4()
    },
    project_name: {
        type: String,
        required: true,
        trim: true
    },
    training_script: {
        type: String,
        required: true,
        default: 'train.py'
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    resources: {
        gpu: { type: Number, default: 1 },
        cpu: { type: Number, default: 2 },
        memory: { type: String, default: '4Gi' }
    },
    config: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    logs: [{
        timestamp: { type: Date, default: Date.now },
        message: String
    }],
    error_message: String,
    gpu_id: String,
    worker_node: String,
    duration: Number, // in seconds
    started_at: Date,
    completed_at: Date
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Index for efficient queries
TrainingJobSchema.index({ status: 1, createdAt: 1 });
TrainingJobSchema.index({ job_id: 1 }, { unique: true });

const TrainingJob = mongoose.model('TrainingJob', TrainingJobSchema);

class JobModel {
    async createJob(jobData) {
        try {
            const job = new TrainingJob({
                project_name: jobData.project?.name || 'untitled-project',
                training_script: jobData.training?.script || 'train.py',
                resources: jobData.resources || { gpu: 1, cpu: 2, memory: '4Gi' },
                config: jobData
            });

            const savedJob = await job.save();
            console.log(`✅ Job created: ${savedJob.job_id}`);
            
            return this.formatJob(savedJob);

        } catch (error) {
            console.error('❌ Error creating job:', error);
            throw new Error(`Failed to create job: ${error.message}`);
        }
    }

    async getJob(jobId) {
        try {
            const job = await TrainingJob.findOne({ job_id: jobId });
            
            if (!job) {
                throw new Error('Job not found');
            }

            return this.formatJob(job);

        } catch (error) {
            console.error('❌ Error getting job:', error);
            throw new Error(`Failed to get job: ${error.message}`);
        }
    }

    async updateJob(jobId, updates) {
        try {
            const job = await TrainingJob.findOneAndUpdate(
                { job_id: jobId },
                { $set: updates },
                { new: true, runValidators: true }
            );

            if (!job) {
                throw new Error('Job not found');
            }

            console.log(`📝 Job updated: ${jobId}`);
            return this.formatJob(job);

        } catch (error) {
            console.error('❌ Error updating job:', error);
            throw new Error(`Failed to update job: ${error.message}`);
        }
    }

    async listJobs(limit = 50) {
        try {
            const jobs = await TrainingJob.find()
                .sort({ createdAt: -1 })
                .limit(limit);

            return jobs.map(job => this.formatJob(job));

        } catch (error) {
            console.error('❌ Error listing jobs:', error);
            throw new Error(`Failed to list jobs: ${error.message}`);
        }
    }

    async addJobLog(jobId, logEntry) {
        try {
            const job = await TrainingJob.findOneAndUpdate(
                { job_id: jobId },
                { 
                    $push: { 
                        logs: { 
                            message: logEntry,
                            timestamp: new Date()
                        } 
                    } 
                },
                { new: true }
            );

            if (!job) {
                throw new Error('Job not found');
            }

            console.log(`📝 Log added to job: ${jobId}`);

        } catch (error) {
            console.error('❌ Error adding job log:', error);
            throw new Error(`Failed to add job log: ${error.message}`);
        }
    }

    async getJobsByStatus(status) {
        try {
            const jobs = await TrainingJob.find({ status })
                .sort({ createdAt: 1 });

            return jobs.map(job => this.formatJob(job));

        } catch (error) {
            console.error('❌ Error getting jobs by status:', error);
            throw new Error(`Failed to get jobs by status: ${error.message}`);
        }
    }

    formatJob(job) {
        // Convert MongoDB document to plain object with ISO dates
        const jobObj = job.toObject ? job.toObject() : job;
        
        return {
            job_id: jobObj.job_id,
            project_name: jobObj.project_name,
            training_script: jobObj.training_script,
            status: jobObj.status,
            progress: jobObj.progress,
            resources: jobObj.resources,
            config: jobObj.config,
            logs: jobObj.logs || [],
            error_message: jobObj.error_message,
            gpu_id: jobObj.gpu_id,
            worker_node: jobObj.worker_node,
            duration: jobObj.duration,
            created_at: jobObj.createdAt?.toISOString(),
            updated_at: jobObj.updatedAt?.toISOString(),
            started_at: jobObj.started_at?.toISOString(),
            completed_at: jobObj.completed_at?.toISOString()
        };
    }

    async deleteJob(jobId) {
        try {
            const job = await TrainingJob.findOneAndDelete({ job_id: jobId });
            
            if (!job) {
                throw new Error('Job not found');
            }

            console.log(`🗑️ Job deleted: ${jobId}`);
            return this.formatJob(job);

        } catch (error) {
            console.error('❌ Error deleting job:', error);
            throw new Error(`Failed to delete job: ${error.message}`);
        }
    }
}

// Create singleton instance
const jobModel = new JobModel();

module.exports = {
    JobModel: jobModel,
    TrainingJob
};