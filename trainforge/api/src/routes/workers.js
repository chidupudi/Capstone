// File: trainforge/api/src/routes/workers.js
// API routes for external worker management with intelligent load balancing

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const mongoDB = require('../db/mongodb');
const { loadBalancer, LoadBalancingStrategy } = require('../services/loadBalancer');
const { verifyToken, isAdmin } = require('../middleware/auth');

// In-memory storage for workers (now managed by load balancer)
const workers = loadBalancer.workers;

// In-memory store for distributed worker tracking
const distributedWorkerState = {
    shardAssignments: new Map(),
    lastUpdate: Date.now()
};

// Helper to extract shard ID from worker_id
function extractShardId(workerId) {
    if (!workerId) return null;
    const match = workerId.match(/worker-(\d+)/);
    return match ? parseInt(match[1]) : null;
}

// ============================================================
// STATIC ROUTES (must come BEFORE parameterized routes)
// ============================================================

// Register a new worker
router.post('/register', async (req, res) => {
    try {
        const workerData = req.body;

        if (!workerData.worker_id) {
            return res.status(400).json({ error: 'worker_id is required' });
        }

        loadBalancer.registerWorker(workerData);

        console.log(`✅ Worker registered: ${workerData.worker_id} (${workerData.platform || 'unknown'})`);

        res.status(201).json({
            success: true,
            message: 'Worker registered successfully',
            worker_id: workerData.worker_id,
            platform: workerData.platform || 'unknown'
        });

    } catch (error) {
        console.error('❌ Worker registration error:', error);
        res.status(500).json({ error: 'Failed to register worker' });
    }
});

// Get all workers (Admin only)
router.get('/', verifyToken, isAdmin, (req, res) => {
    try {
        const workerList = Array.from(workers.values());
        res.json(workerList);
    } catch (error) {
        console.error('❌ Error fetching workers:', error);
        res.status(500).json({ error: 'Failed to fetch workers' });
    }
});

// GET /api/workers/distributed/status - Get all distributed workers status (Admin only)
router.get('/distributed/status', verifyToken, isAdmin, (req, res) => {
    try {
        const now = Date.now();
        const workerList = Array.from(workers.values());

        // Filter for distributed/colab workers
        const distributedWorkers = workerList.filter(w =>
            w.worker_type === 'distributed_colab' ||
            w.worker_type === 'external_colab' ||
            w.platform === 'colab' ||
            w.location === 'google_colab'
        );

        // Enrich with real-time status
        const enrichedWorkers = distributedWorkers.map(worker => {
            const timeSinceHeartbeat = now - (worker.last_heartbeat || worker.registered_at || now);
            const isOnline = timeSinceHeartbeat < 60000;

            return {
                worker_id: worker.worker_id,
                shard_id: worker.shard_id ?? extractShardId(worker.worker_id),
                status: isOnline ? (worker.status || 'idle') : 'offline',
                is_online: isOnline,
                platform: worker.platform || 'colab',
                location: worker.location || 'google_colab',
                gpu: {
                    available: worker.gpu_available || worker.capabilities?.gpu_count > 0,
                    name: worker.gpu_name || worker.capabilities?.gpu_info?.name || 'Unknown',
                    memory_gb: worker.gpu_memory_gb || worker.capabilities?.gpu_info?.memory_gb || 0
                },
                jobs: {
                    active: worker.active_jobs || 0,
                    completed: worker.total_jobs_completed || 0,
                    current_job_id: worker.current_job_id || null
                },
                timing: {
                    registered_at: worker.registered_at,
                    last_heartbeat: worker.last_heartbeat,
                    time_since_heartbeat_ms: timeSinceHeartbeat,
                    uptime_ms: now - (worker.registered_at || now)
                },
                progress: {
                    current: worker.current_progress || 0,
                    message: worker.current_message || null,
                    epoch: worker.current_epoch || null,
                    accuracy: worker.current_accuracy || null
                },
                last_message: worker.last_message || null
            };
        });

        enrichedWorkers.sort((a, b) => (a.shard_id || 0) - (b.shard_id || 0));

        const summary = {
            total_workers: enrichedWorkers.length,
            online_workers: enrichedWorkers.filter(w => w.is_online).length,
            offline_workers: enrichedWorkers.filter(w => !w.is_online).length,
            busy_workers: enrichedWorkers.filter(w => w.status === 'busy').length,
            idle_workers: enrichedWorkers.filter(w => w.status === 'idle' && w.is_online).length,
            total_gpus: enrichedWorkers.filter(w => w.gpu.available).length,
            active_jobs: enrichedWorkers.reduce((sum, w) => sum + w.jobs.active, 0),
            completed_jobs: enrichedWorkers.reduce((sum, w) => sum + w.jobs.completed, 0)
        };

        res.json({
            success: true,
            timestamp: now,
            summary,
            workers: enrichedWorkers
        });

    } catch (error) {
        console.error('❌ Error fetching distributed status:', error);
        res.status(500).json({ error: 'Failed to fetch distributed status' });
    }
});

// GET /api/workers/distributed/shards - Get shard assignments (Admin only)
router.get('/distributed/shards', verifyToken, isAdmin, (req, res) => {
    try {
        const shards = [];
        for (let i = 0; i < 4; i++) {
            const workerId = distributedWorkerState.shardAssignments.get(i);
            const worker = workerId ? workers.get(workerId) : null;

            shards.push({
                shard_id: i,
                assigned_worker: workerId || null,
                status: worker ? worker.status : 'unassigned',
                worker_online: worker ? (Date.now() - worker.last_heartbeat < 60000) : false
            });
        }

        res.json({
            success: true,
            total_shards: 4,
            assigned_shards: shards.filter(s => s.assigned_worker).length,
            shards
        });
    } catch (error) {
        console.error('❌ Error fetching shard assignments:', error);
        res.status(500).json({ error: 'Failed to fetch shard assignments' });
    }
});

// GET /api/workers/realtime - Get real-time worker data for UI polling (Admin only)
router.get('/realtime', verifyToken, isAdmin, (req, res) => {
    try {
        const now = Date.now();
        const workerList = Array.from(workers.values());

        const realtimeData = {
            timestamp: now,
            total_connected: workerList.length,
            online: workerList.filter(w => now - (w.last_heartbeat || 0) < 60000).length,
            busy: workerList.filter(w => w.status === 'busy').length,
            idle: workerList.filter(w => w.status === 'idle').length,
            gpus_available: workerList.filter(w => w.gpu_available || w.capabilities?.gpu_count > 0).length,
            workers: workerList.map(w => ({
                id: w.worker_id,
                shard: w.shard_id ?? extractShardId(w.worker_id),
                status: now - (w.last_heartbeat || 0) < 60000 ? w.status : 'offline',
                gpu: w.gpu_name || w.capabilities?.gpu_info?.name || 'CPU',
                job: w.current_job_id || null,
                progress: w.current_progress || 0,
                accuracy: w.current_accuracy || null
            }))
        };

        res.json(realtimeData);
    } catch (error) {
        console.error('❌ Error fetching realtime data:', error);
        res.status(500).json({ error: 'Failed to fetch realtime data' });
    }
});

// GET /api/workers/stats/all - Get all workers statistics
router.get('/stats/all', (req, res) => {
    try {
        const stats = loadBalancer.getWorkerStats();

        res.json({
            success: true,
            ...stats
        });
    } catch (error) {
        console.error('❌ Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// PUT /api/workers/strategy/set - Set load balancing strategy
router.put('/strategy/set', (req, res) => {
    try {
        const { strategy } = req.body;

        if (!strategy) {
            return res.status(400).json({ error: 'Strategy is required' });
        }

        loadBalancer.setStrategy(strategy);

        res.json({
            success: true,
            message: 'Load balancing strategy updated',
            strategy: strategy
        });
    } catch (error) {
        console.error('❌ Error setting strategy:', error);
        res.status(500).json({ error: 'Failed to set strategy' });
    }
});

// GET /api/workers/strategy/options - Get available strategies
router.get('/strategy/options', (req, res) => {
    try {
        res.json({
            success: true,
            strategies: Object.values(LoadBalancingStrategy),
            current: loadBalancer.strategy,
            descriptions: {
                round_robin: 'Distribute jobs evenly across all workers',
                least_loaded: 'Assign to worker with fewest active jobs (default)',
                gpu_priority: 'Prefer workers with better GPUs',
                platform_specific: 'Smart routing based on job requirements'
            }
        });
    } catch (error) {
        console.error('❌ Error fetching strategies:', error);
        res.status(500).json({ error: 'Failed to fetch strategies' });
    }
});

// ============================================================
// PARAMETERIZED ROUTES (must come AFTER static routes)
// ============================================================

// Get specific worker
router.get('/:worker_id', (req, res) => {
    try {
        const { worker_id } = req.params;
        const worker = workers.get(worker_id);

        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        res.json(worker);
    } catch (error) {
        console.error('❌ Error fetching worker:', error);
        res.status(500).json({ error: 'Failed to fetch worker' });
    }
});

// Update worker status
router.put('/:worker_id/status', (req, res) => {
    try {
        const { worker_id } = req.params;
        const { status, message } = req.body;

        const worker = workers.get(worker_id);
        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        worker.status = status;
        worker.last_seen = new Date().toISOString();
        if (message) {
            worker.last_message = message;
        }

        workers.set(worker_id, worker);

        res.json({ message: 'Worker status updated', worker_id, status });
    } catch (error) {
        console.error('❌ Error updating worker status:', error);
        res.status(500).json({ error: 'Failed to update worker status' });
    }
});

// Worker heartbeat
router.post('/:worker_id/heartbeat', (req, res) => {
    try {
        const { worker_id } = req.params;

        loadBalancer.updateHeartbeat(worker_id);

        res.json({
            success: true,
            message: 'Heartbeat received',
            worker_id: worker_id,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('❌ Heartbeat error:', error);
        res.status(500).json({ error: 'Failed to process heartbeat' });
    }
});

// Unregister worker (workers can self-unregister; admins can also call this)
router.delete('/:worker_id', (req, res) => {
    // Skip auth for self-unregister (worker calling with its own ID)
    // Admin-level forced disconnection is handled by /api/admin/workers/:id
    try {
        const { worker_id } = req.params;

        if (workers.has(worker_id)) {
            workers.delete(worker_id);
            console.log(`🗑️ Worker unregistered: ${worker_id}`);
            res.json({ message: 'Worker unregistered successfully', worker_id });
        } else {
            res.status(404).json({ error: 'Worker not found' });
        }
    } catch (error) {
        console.error('❌ Error unregistering worker:', error);
        res.status(500).json({ error: 'Failed to unregister worker' });
    }
});

// Get worker statistics
router.get('/:worker_id/stats', (req, res) => {
    try {
        const { worker_id } = req.params;
        const worker = workers.get(worker_id);

        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        const stats = {
            worker_id,
            status: worker.status,
            platform: worker.platform,
            uptime: new Date() - new Date(worker.registered_at),
            jobs_completed: worker.total_jobs_completed || 0,
            jobs_failed: worker.jobs_failed || 0,
            active_jobs: worker.active_jobs || 0,
            success_rate: worker.total_jobs_completed + worker.jobs_failed > 0
                ? (worker.total_jobs_completed / (worker.total_jobs_completed + worker.jobs_failed) * 100).toFixed(2) + '%'
                : 'N/A',
            gpu_available: worker.gpu_available,
            gpu_name: worker.gpu_name,
            gpu_memory_gb: worker.gpu_memory_gb
        };

        res.json(stats);
    } catch (error) {
        console.error('❌ Error fetching worker stats:', error);
        res.status(500).json({ error: 'Failed to fetch worker stats' });
    }
});

// POST /api/workers/:worker_id/job-started - Worker reports job start
router.post('/:worker_id/job-started', (req, res) => {
    try {
        const { worker_id } = req.params;
        const { job_id, shard_id } = req.body;

        const worker = workers.get(worker_id);
        if (worker) {
            worker.status = 'busy';
            worker.current_job_id = job_id;
            worker.current_shard = shard_id;
            worker.job_started_at = Date.now();
            worker.active_jobs = (worker.active_jobs || 0) + 1;
            workers.set(worker_id, worker);
        }

        if (shard_id !== undefined) {
            distributedWorkerState.shardAssignments.set(shard_id, worker_id);
        }

        console.log(`🚀 Worker ${worker_id} started job ${job_id} (shard ${shard_id})`);

        res.json({ success: true, message: 'Job start recorded' });
    } catch (error) {
        console.error('❌ Error recording job start:', error);
        res.status(500).json({ error: 'Failed to record job start' });
    }
});

// POST /api/workers/:worker_id/job-completed - Worker reports job completion
router.post('/:worker_id/job-completed', (req, res) => {
    try {
        const { worker_id } = req.params;
        const { job_id, shard_id, success, accuracy, metrics } = req.body;

        const worker = workers.get(worker_id);
        if (worker) {
            worker.status = 'idle';
            worker.current_job_id = null;
            worker.current_progress = 0;
            worker.active_jobs = Math.max(0, (worker.active_jobs || 1) - 1);
            worker.total_jobs_completed = (worker.total_jobs_completed || 0) + 1;
            worker.last_job_id = job_id;
            worker.last_job_accuracy = accuracy;
            worker.last_job_completed_at = Date.now();
            workers.set(worker_id, worker);
        }

        if (shard_id !== undefined) {
            distributedWorkerState.shardAssignments.delete(shard_id);
        }

        console.log(`✅ Worker ${worker_id} completed job ${job_id} (accuracy: ${accuracy}%)`);

        res.json({ success: true, message: 'Job completion recorded' });
    } catch (error) {
        console.error('❌ Error recording job completion:', error);
        res.status(500).json({ error: 'Failed to record job completion' });
    }
});

// PUT /api/workers/:worker_id/progress - Update worker progress
router.put('/:worker_id/progress', (req, res) => {
    try {
        const { worker_id } = req.params;
        const { progress, message, epoch, loss, accuracy } = req.body;

        const worker = workers.get(worker_id);
        if (worker) {
            worker.current_progress = progress;
            worker.current_message = message;
            worker.current_epoch = epoch;
            worker.current_loss = loss;
            worker.current_accuracy = accuracy;
            worker.last_progress_update = Date.now();
            workers.set(worker_id, worker);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

module.exports = router;
