// File: trainforge/api/src/routes/workers.js
// API routes for external worker management

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const mongoDB = require('../db/mongodb');

// In-memory storage for workers (could be moved to database later)
const workers = new Map();

// Register a new worker
router.post('/register', async (req, res) => {
    try {
        const { worker_id, status, worker_type, capabilities, location } = req.body;

        if (!worker_id) {
            return res.status(400).json({ error: 'worker_id is required' });
        }

        const worker = {
            worker_id,
            status: status || 'available',
            worker_type: worker_type || 'external',
            capabilities: capabilities || {},
            location: location || 'unknown',
            registered_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            jobs_completed: 0,
            jobs_failed: 0
        };

        // Store worker in memory
        workers.set(worker_id, worker);

        console.log(`✅ Worker registered: ${worker_id} (${worker_type}) at ${location}`);

        res.json({
            message: 'Worker registered successfully',
            worker_id,
            status: 'registered'
        });

    } catch (error) {
        console.error('❌ Worker registration error:', error);
        res.status(500).json({ error: 'Failed to register worker' });
    }
});

// Get all workers
router.get('/', (req, res) => {
    try {
        const workerList = Array.from(workers.values());
        res.json(workerList);
    } catch (error) {
        console.error('❌ Error fetching workers:', error);
        res.status(500).json({ error: 'Failed to fetch workers' });
    }
});

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
        const worker = workers.get(worker_id);

        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }

        worker.last_seen = new Date().toISOString();
        workers.set(worker_id, worker);

        res.json({ message: 'Heartbeat received', timestamp: worker.last_seen });
    } catch (error) {
        console.error('❌ Heartbeat error:', error);
        res.status(500).json({ error: 'Failed to process heartbeat' });
    }
});

// Unregister worker
router.delete('/:worker_id', (req, res) => {
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
            uptime: new Date() - new Date(worker.registered_at),
            jobs_completed: worker.jobs_completed,
            jobs_failed: worker.jobs_failed,
            success_rate: worker.jobs_completed + worker.jobs_failed > 0
                ? (worker.jobs_completed / (worker.jobs_completed + worker.jobs_failed) * 100).toFixed(2) + '%'
                : 'N/A',
            capabilities: worker.capabilities,
            location: worker.location
        };

        res.json(stats);
    } catch (error) {
        console.error('❌ Error fetching worker stats:', error);
        res.status(500).json({ error: 'Failed to fetch worker stats' });
    }
});

module.exports = router;