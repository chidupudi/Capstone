// File: trainforge/api/src/routes/jobs.js
// Job management API routes with Firebase backend

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { JobModel } = require('../db/models');
const { FileStorage } = require('../services/storage');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    }
});

// POST /api/jobs - Submit new training job
router.post('/', upload.single('project_zip'), async (req, res) => {
    try {
        console.log('📤 Received job submission');
        
        // Parse job configuration
        const config = JSON.parse(req.body.config);
        console.log('📋 Job config:', config.project?.name);

        // Validate required fields
        if (!config.project?.name) {
            return res.status(400).json({
                error: 'Project name is required'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                error: 'Project files are required'
            });
        }

        // Create job in database
        const job = await JobModel.createJob(config);
        console.log(`✅ Job created: ${job.job_id}`);

        // Store project files (for now, just keep the uploaded zip)
        const projectPath = `projects/${job.job_id}`;
        await FileStorage.storeProjectFiles(req.file.path, projectPath);
        
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        // TODO: Add job to processing queue
        console.log('📋 Job queued for processing');

        res.status(201).json({
            success: true,
            message: 'Job submitted successfully',
            job_id: job.job_id,
            project_name: job.project_name,
            status: job.status,
            resources: job.resources,
            created_at: job.created_at
        });

    } catch (error) {
        console.error('❌ Job submission failed:', error);
        
        // Clean up uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: 'Job submission failed',
            message: error.message
        });
    }
});

// GET /api/jobs - List all jobs
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const jobs = await JobModel.listJobs(limit);

        res.json({
            success: true,
            jobs: jobs,
            count: jobs.length
        });

    } catch (error) {
        console.error('❌ Failed to list jobs:', error);
        res.status(500).json({
            error: 'Failed to list jobs',
            message: error.message
        });
    }
});

// GET /api/jobs/:jobId - Get specific job status
router.get('/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await JobModel.getJob(jobId);

        res.json({
            success: true,
            ...job
        });

    } catch (error) {
        console.error('❌ Failed to get job:', error);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Job not found',
                message: `Job ${req.params.jobId} does not exist`
            });
        }

        res.status(500).json({
            error: 'Failed to get job',
            message: error.message
        });
    }
});

// PUT /api/jobs/:jobId - Update job status
router.put('/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const updates = req.body;

        // Validate status transitions
        const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];
        if (updates.status && !validStatuses.includes(updates.status)) {
            return res.status(400).json({
                error: 'Invalid status',
                message: `Status must be one of: ${validStatuses.join(', ')}`
            });
        }

        const updatedJob = await JobModel.updateJob(jobId, updates);

        res.json({
            success: true,
            message: 'Job updated successfully',
            ...updatedJob
        });

    } catch (error) {
        console.error('❌ Failed to update job:', error);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Job not found',
                message: `Job ${req.params.jobId} does not exist`
            });
        }

        res.status(500).json({
            error: 'Failed to update job',
            message: error.message
        });
    }
});

// POST /api/jobs/:jobId/logs - Add log entry
router.post('/:jobId/logs', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                error: 'Log message is required'
            });
        }

        await JobModel.addJobLog(jobId, message);

        res.json({
            success: true,
            message: 'Log added successfully'
        });

    } catch (error) {
        console.error('❌ Failed to add log:', error);
        res.status(500).json({
            error: 'Failed to add log',
            message: error.message
        });
    }
});

// DELETE /api/jobs/:jobId - Cancel/delete job
router.delete('/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        
        // Update job status to cancelled
        await JobModel.updateJob(jobId, { 
            status: 'cancelled',
            completed_at: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Job cancelled successfully'
        });

    } catch (error) {
        console.error('❌ Failed to cancel job:', error);
        res.status(500).json({
            error: 'Failed to cancel job',
            message: error.message
        });
    }
});

module.exports = router;