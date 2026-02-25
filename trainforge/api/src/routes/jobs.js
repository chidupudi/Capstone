// File: trainforge/api/src/routes/jobs.js
// Job management API routes with Firebase backend and intelligent load balancing

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { JobModel } = require('../db/models');
const { FileStorage } = require('../services/storage');
const { loadBalancer } = require('../services/loadBalancer');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    }
});

// Configure multer for results upload
const resultsUpload = multer({
    dest: 'uploads/results/',
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB limit for model files
    }
});

// POST /api/jobs - Submit new training job
router.post('/', verifyToken, upload.single('project_zip'), async (req, res) => {
    try {
        console.log('📤 Received job submission from user:', req.user.uid);

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

        // Attach user to config
        config.user_id = req.user.uid;

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
router.get('/', verifyToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        // Notice: This lists ALL jobs currently. In a real multi-tenant app, 
        // you would filter by req.user.uid here in JobModel.listUserJobs(req.user.uid, limit)
        // For TrainForge's admin perspective or single-user focus, we'll keep it simple or implement filtering

        const jobs = await JobModel.listJobs(limit);

        // Admin can see all jobs, otherwise filter for the current user
        let userJobs = jobs;
        if (req.user.email !== 'rupesh@trainforge.com') {
            userJobs = jobs.filter(job => job.user_id === req.user.uid);
        }

        res.json({
            success: true,
            jobs: userJobs,
            count: userJobs.length
        });

    } catch (error) {
        console.error('❌ Failed to list jobs:', error);
        res.status(500).json({
            error: 'Failed to list jobs',
            message: error.message
        });
    }
});

// GET /api/jobs/pending - Get pending jobs for workers (MUST BE BEFORE /:jobId)
router.get('/pending', async (req, res) => {
    try {
        // Get jobs with status 'pending'
        const jobs = await JobModel.listJobs(100); // Get more jobs for filtering
        const pendingJobs = jobs.filter(job => job.status === 'pending');

        res.json(pendingJobs);

    } catch (error) {
        console.error('❌ Failed to get pending jobs:', error);
        res.status(500).json({
            error: 'Failed to get pending jobs',
            message: error.message
        });
    }
});

// GET /api/jobs/:jobId - Get specific job status
router.get('/:jobId', verifyToken, async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await JobModel.getJob(jobId);

        if (req.user.email !== 'rupesh@trainforge.com' && job.user_id !== req.user.uid) {
            return res.status(403).json({ error: 'Access denied: You do not own this job' });
        }

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
router.put('/:jobId', verifyToken, async (req, res) => {
    try {
        const { jobId } = req.params;
        const updates = req.body;

        // Verify ownership
        const currentJob = await JobModel.getJob(jobId);
        if (req.user.email !== 'rupesh@trainforge.com' && currentJob.user_id && currentJob.user_id !== req.user.uid) {
            return res.status(403).json({ error: 'Access denied: You do not own this job' });
        }

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
router.delete('/:jobId', verifyToken, async (req, res) => {
    try {
        const { jobId } = req.params;

        // Verify ownership (admin can cancel any job)
        const currentJob = await JobModel.getJob(jobId);
        if (!req.user.isAdmin && currentJob.user_id && currentJob.user_id !== req.user.uid) {
            return res.status(403).json({ error: 'Access denied: You do not own this job' });
        }

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

// POST /api/jobs/:jobId/claim - Claim a job for processing
router.post('/:jobId/claim', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { worker_id } = req.body;

        if (!worker_id) {
            return res.status(400).json({ error: 'worker_id is required' });
        }

        // Update job status to running and assign worker
        const updatedJob = await JobModel.updateJob(jobId, {
            status: 'running',
            worker_id: worker_id,
            started_at: new Date().toISOString()
        });

        // Track job assignment in load balancer
        loadBalancer.assignJob(jobId, worker_id);

        console.log(`🎯 Job ${jobId} claimed by worker ${worker_id}`);

        res.json({
            success: true,
            message: 'Job claimed successfully',
            job_id: jobId,
            worker_id: worker_id
        });

    } catch (error) {
        console.error('❌ Failed to claim job:', error);
        res.status(500).json({
            error: 'Failed to claim job',
            message: error.message
        });
    }
});

// PUT /api/jobs/:jobId/status - Update job status (simplified endpoint)
router.put('/:jobId/status', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { status, message } = req.body;

        const updates = { status };
        if (message) {
            updates.message = message;
        }

        if (status === 'completed') {
            updates.completed_at = new Date().toISOString();
            // Notify load balancer that job is complete
            loadBalancer.completeJob(jobId);
        } else if (status === 'failed') {
            updates.failed_at = new Date().toISOString();
            updates.error_message = message;
            // Also mark as complete in load balancer (frees worker)
            loadBalancer.completeJob(jobId);
        }

        const updatedJob = await JobModel.updateJob(jobId, updates);

        console.log(`📊 Job ${jobId} status updated to ${status}`);

        res.json({
            success: true,
            job_id: jobId,
            status: status
        });

    } catch (error) {
        console.error('❌ Failed to update job status:', error);
        res.status(500).json({
            error: 'Failed to update job status',
            message: error.message
        });
    }
});

// POST /api/jobs/:jobId/logs - Add log entry for job
router.post('/:jobId/logs', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { message, timestamp } = req.body;

        // For now, just log to console (could be stored in database)
        const logTime = timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();
        console.log(`📝 [${jobId}] ${logTime}: ${message}`);

        res.json({
            success: true,
            message: 'Log entry added'
        });

    } catch (error) {
        console.error('❌ Failed to add log:', error);
        res.status(500).json({
            error: 'Failed to add log',
            message: error.message
        });
    }
});

// GET /api/jobs/:jobId/files - Download job files
router.get('/:jobId/files', async (req, res) => {
    try {
        const { jobId } = req.params;

        console.log(`📦 File download requested for job ${jobId}`);

        // Get job to verify it exists
        const job = await JobModel.getJob(jobId);

        // Path to project files
        const projectPath = path.join(__dirname, '../../storage/projects/projects', jobId);
        const zipPath = path.join(projectPath, 'project.zip');

        // Check if zip file exists
        if (!fs.existsSync(zipPath)) {
            console.error(`❌ Project zip not found at: ${zipPath}`);
            return res.status(404).json({
                error: 'Project files not found',
                message: 'Project zip file does not exist'
            });
        }

        console.log(`✅ Sending project zip: ${zipPath}`);

        // Send the zip file
        res.download(zipPath, 'project.zip', (err) => {
            if (err) {
                console.error('❌ Error sending file:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Failed to send file',
                        message: err.message
                    });
                }
            } else {
                console.log(`✅ Project files sent for job ${jobId}`);
            }
        });

    } catch (error) {
        console.error('❌ Failed to get job files:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Job not found',
                message: error.message
            });
        }

        res.status(500).json({
            error: 'Failed to get job files',
            message: error.message
        });
    }
});

// POST /api/jobs/:jobId/results - Upload training results
router.post('/:jobId/results', resultsUpload.single('results_zip'), async (req, res) => {
    try {
        const { jobId } = req.params;

        console.log(`📤 Results upload requested for job ${jobId}`);

        // Verify job exists
        const job = await JobModel.getJob(jobId);

        if (!req.file) {
            return res.status(400).json({
                error: 'No results file provided',
                message: 'results_zip file is required'
            });
        }

        // Create results directory for this job
        const resultsDir = path.join(__dirname, '../../storage/results', jobId);
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }

        // Move uploaded file to results directory
        const resultsZipPath = path.join(resultsDir, 'results.zip');
        fs.renameSync(req.file.path, resultsZipPath);

        console.log(`✅ Results ZIP saved for job ${jobId}`);

        // Extract ZIP file for easy browsing
        const extractedDir = path.join(resultsDir, 'extracted');
        if (!fs.existsSync(extractedDir)) {
            fs.mkdirSync(extractedDir, { recursive: true });
        }

        try {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(resultsZipPath);
            zip.extractAllTo(extractedDir, true);
            console.log(`✅ Results extracted to ${extractedDir}`);
        } catch (extractError) {
            console.error('⚠️ Failed to extract results:', extractError.message);
            // Continue even if extraction fails - ZIP is still available
        }

        // Update job metadata with results info
        await JobModel.updateJob(jobId, {
            results_uploaded: true,
            results_uploaded_at: new Date().toISOString(),
            results_size: req.file.size
        });

        res.json({
            success: true,
            message: 'Results uploaded successfully',
            job_id: jobId,
            size: req.file.size,
            path: resultsZipPath
        });

    } catch (error) {
        console.error('❌ Failed to upload results:', error);

        // Clean up uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Job not found',
                message: error.message
            });
        }

        res.status(500).json({
            error: 'Failed to upload results',
            message: error.message
        });
    }
});

// GET /api/jobs/:jobId/results - Download training results
router.get('/:jobId/results', async (req, res) => {
    try {
        const { jobId } = req.params;

        console.log(`📥 Results download requested for job ${jobId}`);

        // Verify job exists
        const job = await JobModel.getJob(jobId);

        // Path to results
        const resultsDir = path.join(__dirname, '../../storage/results', jobId);
        const resultsZipPath = path.join(resultsDir, 'results.zip');

        // Check if results exist
        if (!fs.existsSync(resultsZipPath)) {
            console.error(`❌ Results not found at: ${resultsZipPath}`);
            return res.status(404).json({
                error: 'Results not found',
                message: 'Training results have not been uploaded yet'
            });
        }

        console.log(`✅ Sending results: ${resultsZipPath}`);

        // Send the results file
        res.download(resultsZipPath, 'results.zip', (err) => {
            if (err) {
                console.error('❌ Error sending results:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Failed to send results',
                        message: err.message
                    });
                }
            } else {
                console.log(`✅ Results sent for job ${jobId}`);
            }
        });

    } catch (error) {
        console.error('❌ Failed to get results:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Job not found',
                message: error.message
            });
        }

        res.status(500).json({
            error: 'Failed to get results',
            message: error.message
        });
    }
});

// GET /api/jobs/:jobId/results/files - List all result files
router.get('/:jobId/results/files', async (req, res) => {
    try {
        const { jobId } = req.params;

        console.log(`📋 Listing result files for job ${jobId}`);

        // Verify job exists
        const job = await JobModel.getJob(jobId);

        // Path to extracted results
        const extractedDir = path.join(__dirname, '../../storage/results', jobId, 'extracted');

        // Check if results exist
        if (!fs.existsSync(extractedDir)) {
            console.log(`⚠️ No extracted results found for job ${jobId}`);
            return res.json({
                success: true,
                job_id: jobId,
                files: [],
                message: 'Results not yet uploaded or extracted'
            });
        }

        // Recursively get all files
        const getFilesRecursively = (dir, basePath = '') => {
            const files = [];
            const items = fs.readdirSync(dir);

            for (const item of items) {
                const fullPath = path.join(dir, item);
                const relativePath = path.join(basePath, item);
                const stats = fs.statSync(fullPath);

                if (stats.isDirectory()) {
                    files.push(...getFilesRecursively(fullPath, relativePath));
                } else {
                    files.push({
                        name: item,
                        path: relativePath.replace(/\\/g, '/'), // Normalize path separators
                        size: stats.size,
                        modified: stats.mtime,
                        type: path.extname(item).substring(1) || 'file'
                    });
                }
            }

            return files;
        };

        const files = getFilesRecursively(extractedDir);

        console.log(`✅ Found ${files.length} result files for job ${jobId}`);

        res.json({
            success: true,
            job_id: jobId,
            files: files,
            count: files.length,
            total_size: files.reduce((sum, f) => sum + f.size, 0)
        });

    } catch (error) {
        console.error('❌ Failed to list result files:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Job not found',
                message: error.message
            });
        }

        res.status(500).json({
            error: 'Failed to list result files',
            message: error.message
        });
    }
});

// GET /api/jobs/:jobId/results/file/:filename - Download individual result file
router.get('/:jobId/results/file/*', async (req, res) => {
    try {
        const { jobId } = req.params;
        // Get filename from wildcard (everything after /file/)
        const filename = req.params[0];

        console.log(`📥 Download requested for file: ${filename} from job ${jobId}`);

        // Verify job exists
        const job = await JobModel.getJob(jobId);

        // Path to extracted results
        const extractedDir = path.join(__dirname, '../../storage/results', jobId, 'extracted');
        const filePath = path.join(extractedDir, filename);

        // Security check: ensure file path is within extractedDir
        const resolvedPath = path.resolve(filePath);
        const resolvedBase = path.resolve(extractedDir);

        if (!resolvedPath.startsWith(resolvedBase)) {
            console.error(`🚨 Security: Path traversal attempt detected`);
            return res.status(403).json({
                error: 'Access denied',
                message: 'Invalid file path'
            });
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error(`❌ File not found: ${filePath}`);
            return res.status(404).json({
                error: 'File not found',
                message: `File ${filename} does not exist in results`
            });
        }

        // Check if it's a file (not directory)
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Path is not a file'
            });
        }

        console.log(`✅ Sending file: ${filename}`);

        // Send the file
        res.download(filePath, path.basename(filename), (err) => {
            if (err) {
                console.error('❌ Error sending file:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Failed to send file',
                        message: err.message
                    });
                }
            } else {
                console.log(`✅ File sent: ${filename}`);
            }
        });

    } catch (error) {
        console.error('❌ Failed to download file:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Job not found',
                message: error.message
            });
        }

        res.status(500).json({
            error: 'Failed to download file',
            message: error.message
        });
    }
});

// ============================================================
// DISTRIBUTED TRAINING SUPPORT
// ============================================================

// In-memory store for distributed job tracking
const distributedJobs = new Map();

// POST /api/jobs/distributed - Create a distributed training job
router.post('/distributed', upload.single('project_zip'), async (req, res) => {
    try {
        console.log('📤 Received DISTRIBUTED job submission');

        const config = JSON.parse(req.body.config);
        const numWorkers = parseInt(req.body.num_workers) || 4;

        console.log(`📋 Distributed job: ${config.project?.name} with ${numWorkers} workers`);

        if (!config.project?.name) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        // Create the main job
        const job = await JobModel.createJob({
            ...config,
            distributed: true,
            num_workers: numWorkers
        });

        console.log(`✅ Distributed job created: ${job.job_id}`);

        // Store project files
        if (req.file) {
            const projectPath = `projects/${job.job_id}`;
            await FileStorage.storeProjectFiles(req.file.path, projectPath);
            fs.unlinkSync(req.file.path);
        }

        // Initialize distributed tracking
        distributedJobs.set(job.job_id, {
            job_id: job.job_id,
            num_workers: numWorkers,
            workers_completed: 0,
            worker_results: {},
            status: 'pending',
            created_at: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Distributed job created',
            job_id: job.job_id,
            num_workers: numWorkers,
            status: 'pending'
        });

    } catch (error) {
        console.error('❌ Distributed job creation failed:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to create distributed job', message: error.message });
    }
});

// GET /api/jobs/:jobId/distributed/status - Get distributed job status
router.get('/:jobId/distributed/status', async (req, res) => {
    try {
        const { jobId } = req.params;
        const distJob = distributedJobs.get(jobId);

        if (!distJob) {
            // Check if it's a regular job
            const job = await JobModel.getJob(jobId);
            return res.json({
                job_id: jobId,
                distributed: false,
                status: job.status
            });
        }

        res.json({
            job_id: jobId,
            distributed: true,
            num_workers: distJob.num_workers,
            workers_completed: distJob.workers_completed,
            worker_results: Object.keys(distJob.worker_results),
            status: distJob.status,
            progress: Math.round((distJob.workers_completed / distJob.num_workers) * 100)
        });

    } catch (error) {
        console.error('❌ Failed to get distributed status:', error);
        res.status(500).json({ error: 'Failed to get status', message: error.message });
    }
});

// POST /api/jobs/:jobId/distributed/worker-complete - Report worker completion
router.post('/:jobId/distributed/worker-complete', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { shard_id, worker_id, accuracy, metrics } = req.body;

        console.log(`📥 Worker ${shard_id} completed for job ${jobId}`);

        let distJob = distributedJobs.get(jobId);

        if (!distJob) {
            // Initialize if not exists
            distJob = {
                job_id: jobId,
                num_workers: 4,
                workers_completed: 0,
                worker_results: {},
                status: 'running',
                created_at: new Date()
            };
            distributedJobs.set(jobId, distJob);
        }

        // Record worker result
        distJob.worker_results[shard_id] = {
            worker_id,
            shard_id,
            accuracy,
            metrics,
            completed_at: new Date()
        };
        distJob.workers_completed = Object.keys(distJob.worker_results).length;

        // Check if all workers done
        if (distJob.workers_completed >= distJob.num_workers) {
            distJob.status = 'aggregating';
            console.log(`✅ All ${distJob.num_workers} workers completed for job ${jobId}`);

            // Update main job status
            await JobModel.updateJobStatus(jobId, 'completed', 'All workers completed');
        }

        res.json({
            success: true,
            workers_completed: distJob.workers_completed,
            total_workers: distJob.num_workers,
            all_complete: distJob.workers_completed >= distJob.num_workers
        });

    } catch (error) {
        console.error('❌ Failed to record worker completion:', error);
        res.status(500).json({ error: 'Failed to record completion', message: error.message });
    }
});

// GET /api/jobs/:jobId/distributed/results - Get all worker results
router.get('/:jobId/distributed/results', async (req, res) => {
    try {
        const { jobId } = req.params;

        // Get distributed job tracking
        const distJob = distributedJobs.get(jobId);

        // Get all result files from storage
        const resultsDir = path.join(__dirname, '../../storage/results', jobId);
        let resultFiles = [];

        if (fs.existsSync(resultsDir)) {
            const files = fs.readdirSync(resultsDir);
            resultFiles = files.filter(f => f.includes('worker_')).map(f => ({
                name: f,
                path: path.join(resultsDir, f),
                size: fs.statSync(path.join(resultsDir, f)).size
            }));
        }

        res.json({
            success: true,
            job_id: jobId,
            distributed: distJob ? true : false,
            workers_completed: distJob ? distJob.workers_completed : 0,
            num_workers: distJob ? distJob.num_workers : 0,
            worker_results: distJob ? distJob.worker_results : {},
            result_files: resultFiles,
            status: distJob ? distJob.status : 'unknown'
        });

    } catch (error) {
        console.error('❌ Failed to get distributed results:', error);
        res.status(500).json({ error: 'Failed to get results', message: error.message });
    }
});

module.exports = router;