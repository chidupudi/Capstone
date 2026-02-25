// File: trainforge/api/src/routes/admin.js
// Admin-only API routes for TrainForge

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const { JobModel } = require('../db/models');
const { loadBalancer } = require('../services/loadBalancer');

// ── In-memory state ────────────────────────────────────────────────────────
let maintenanceMode = {
    enabled: false,
    message: 'System is under maintenance. Please try again later.',
    started_at: null,
    enabled_by: null
};

let gpuConfig = {
    max_gpu_per_job: 4,
    gpu_memory_threshold_gb: 8,
    allowed_platforms: ['colab', 'kaggle', 'aws', 'local'],
    load_balancing_strategy: 'least_loaded',
    auto_scale: true,
    worker_timeout_minutes: 60,
    max_concurrent_jobs: 10
};

// Apply auth to ALL admin routes
router.use(verifyToken, isAdmin);

// ── GET /api/admin/stats ───────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const jobs = await JobModel.listJobs(500);
        const workers = Array.from(loadBalancer.workers.values());
        const now = Date.now();

        const uniqueUsers = [...new Set(jobs.filter(j => j.user_id).map(j => j.user_id))];

        const stats = {
            jobs: {
                total: jobs.length,
                pending: jobs.filter(j => j.status === 'pending').length,
                running: jobs.filter(j => j.status === 'running').length,
                completed: jobs.filter(j => j.status === 'completed').length,
                failed: jobs.filter(j => j.status === 'failed').length,
                cancelled: jobs.filter(j => j.status === 'cancelled').length,
            },
            workers: {
                total: workers.length,
                online: workers.filter(w => now - (w.last_heartbeat || 0) < 60000).length,
                busy: workers.filter(w => w.status === 'busy').length,
                idle: workers.filter(w => w.status === 'idle').length,
                gpu_count: workers.filter(w => w.gpu_available).length,
                disabled: workers.filter(w => w.disabled).length,
            },
            system: {
                uptime_seconds: Math.floor(process.uptime()),
                memory: {
                    rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100,
                    heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
                    heap_total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
                },
                maintenance: maintenanceMode.enabled,
                node_version: process.version,
                timestamp: new Date().toISOString(),
            },
            users: {
                active_submitters: uniqueUsers.length,
                user_ids: uniqueUsers,
            }
        };

        res.json({ success: true, stats });
    } catch (error) {
        console.error('❌ Admin stats error:', error);
        res.status(500).json({ error: 'Failed to get stats', message: error.message });
    }
});

// ── GET /api/admin/jobs ────────────────────────────────────────────────────
router.get('/jobs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 200;
        const status = req.query.status;
        const userId = req.query.user_id;

        let jobs = await JobModel.listJobs(limit);

        if (status) {
            jobs = jobs.filter(j => j.status === status);
        }
        if (userId) {
            jobs = jobs.filter(j => j.user_id === userId);
        }

        res.json({ success: true, jobs, count: jobs.length });
    } catch (error) {
        console.error('❌ Admin list jobs error:', error);
        res.status(500).json({ error: 'Failed to list jobs', message: error.message });
    }
});

// ── PUT /api/admin/jobs/:jobId/status ──────────────────────────────────────
router.put('/jobs/:jobId/status', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { status, message } = req.body;

        const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const updates = { status };
        if (message) updates.error_message = message;
        if (status === 'completed') updates.completed_at = new Date().toISOString();
        if (status === 'failed') {
            updates.error_message = message || 'Manually failed by admin';
            updates.completed_at = new Date().toISOString();
        }

        const updated = await JobModel.updateJob(jobId, updates);
        console.log(`⚙️ Admin updated job ${jobId} status to ${status}`);

        res.json({ success: true, message: 'Job status updated', job: updated });
    } catch (error) {
        console.error('❌ Admin update job status error:', error);
        res.status(500).json({ error: 'Failed to update job status', message: error.message });
    }
});

// ── DELETE /api/admin/jobs/:jobId ─────────────────────────────────────────
router.delete('/jobs/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        await JobModel.deleteJob(jobId);
        console.log(`🗑️ Admin deleted job: ${jobId}`);
        res.json({ success: true, message: `Job ${jobId} permanently deleted` });
    } catch (error) {
        console.error('❌ Admin delete job error:', error);
        res.status(500).json({ error: 'Failed to delete job', message: error.message });
    }
});

// ── GET /api/admin/workers ─────────────────────────────────────────────────
router.get('/workers', (req, res) => {
    try {
        const now = Date.now();
        const workerList = Array.from(loadBalancer.workers.values()).map(w => ({
            ...w,
            is_online: now - (w.last_heartbeat || 0) < 60000,
            uptime_ms: now - (w.registered_at || now),
            disabled: w.disabled || false,
        }));
        res.json({ success: true, workers: workerList, count: workerList.length });
    } catch (error) {
        console.error('❌ Admin get workers error:', error);
        res.status(500).json({ error: 'Failed to get workers', message: error.message });
    }
});

// ── POST /api/admin/workers/:workerId/disable ──────────────────────────────
router.post('/workers/:workerId/disable', (req, res) => {
    try {
        const { workerId } = req.params;
        const worker = loadBalancer.workers.get(workerId);
        if (!worker) return res.status(404).json({ error: 'Worker not found' });

        worker.disabled = true;
        worker.disabled_at = Date.now();
        worker.disabled_by = req.user.email;
        worker.status = 'disabled';
        loadBalancer.workers.set(workerId, worker);

        console.log(`⏸️ Worker ${workerId} disabled by admin ${req.user.email}`);
        res.json({ success: true, message: `Worker ${workerId} has been disabled` });
    } catch (error) {
        console.error('❌ Admin disable worker error:', error);
        res.status(500).json({ error: 'Failed to disable worker', message: error.message });
    }
});

// ── POST /api/admin/workers/:workerId/enable ───────────────────────────────
router.post('/workers/:workerId/enable', (req, res) => {
    try {
        const { workerId } = req.params;
        const worker = loadBalancer.workers.get(workerId);
        if (!worker) return res.status(404).json({ error: 'Worker not found' });

        worker.disabled = false;
        worker.disabled_at = null;
        worker.disabled_by = null;
        worker.status = 'idle';
        loadBalancer.workers.set(workerId, worker);

        console.log(`▶️ Worker ${workerId} enabled by admin ${req.user.email}`);
        res.json({ success: true, message: `Worker ${workerId} has been enabled` });
    } catch (error) {
        console.error('❌ Admin enable worker error:', error);
        res.status(500).json({ error: 'Failed to enable worker', message: error.message });
    }
});

// ── DELETE /api/admin/workers/:workerId ───────────────────────────────────
router.delete('/workers/:workerId', (req, res) => {
    try {
        const { workerId } = req.params;
        if (!loadBalancer.workers.has(workerId)) {
            return res.status(404).json({ error: 'Worker not found' });
        }
        loadBalancer.workers.delete(workerId);
        console.log(`🗑️ Admin permanently disconnected worker: ${workerId}`);
        res.json({ success: true, message: `Worker ${workerId} disconnected and removed` });
    } catch (error) {
        console.error('❌ Admin delete worker error:', error);
        res.status(500).json({ error: 'Failed to delete worker', message: error.message });
    }
});

// ── GET /api/admin/maintenance ─────────────────────────────────────────────
router.get('/maintenance', (req, res) => {
    res.json({ success: true, maintenance: maintenanceMode });
});

// ── POST /api/admin/maintenance ────────────────────────────────────────────
router.post('/maintenance', (req, res) => {
    try {
        const { enabled, message } = req.body;

        maintenanceMode.enabled = Boolean(enabled);
        maintenanceMode.message = message || 'System is under maintenance. Please try again later.';
        maintenanceMode.started_at = enabled ? new Date().toISOString() : null;
        maintenanceMode.enabled_by = enabled ? req.user.email : null;

        console.log(`🔧 Maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'} by ${req.user.email}`);
        res.json({ success: true, maintenance: maintenanceMode });
    } catch (error) {
        console.error('❌ Admin maintenance toggle error:', error);
        res.status(500).json({ error: 'Failed to update maintenance mode', message: error.message });
    }
});

// ── GET /api/admin/gpu/config ──────────────────────────────────────────────
router.get('/gpu/config', (req, res) => {
    res.json({ success: true, config: gpuConfig });
});

// ── PUT /api/admin/gpu/config ──────────────────────────────────────────────
router.put('/gpu/config', (req, res) => {
    try {
        const updates = req.body;
        const allowedFields = [
            'max_gpu_per_job', 'gpu_memory_threshold_gb', 'allowed_platforms',
            'load_balancing_strategy', 'auto_scale', 'worker_timeout_minutes',
            'max_concurrent_jobs'
        ];

        for (const key of Object.keys(updates)) {
            if (allowedFields.includes(key)) {
                gpuConfig[key] = updates[key];
            }
        }

        // Sync load balancing strategy with load balancer
        if (updates.load_balancing_strategy) {
            try {
                loadBalancer.setStrategy(updates.load_balancing_strategy);
            } catch (e) {
                console.warn('Could not sync strategy to load balancer:', e.message);
            }
        }

        console.log(`⚙️ GPU config updated by ${req.user.email}`);
        res.json({ success: true, config: gpuConfig, message: 'GPU configuration updated' });
    } catch (error) {
        console.error('❌ Admin GPU config update error:', error);
        res.status(500).json({ error: 'Failed to update GPU config', message: error.message });
    }
});

// Export getMaintenanceMode for health checks
module.exports = router;
module.exports.getMaintenanceMode = () => maintenanceMode;
