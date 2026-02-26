// File: trainforge/api/src/services/loadBalancer.js
// Intelligent Load Balancer for distributing jobs across cloud GPU providers

const { JobModel } = require('../db/models');

/**
 * Load Balancer Strategy Types
 */
const LoadBalancingStrategy = {
    ROUND_ROBIN: 'round_robin',           // Distribute evenly
    LEAST_LOADED: 'least_loaded',         // Choose worker with fewest active jobs
    GPU_PRIORITY: 'gpu_priority',         // Prefer workers with better GPUs
    PLATFORM_SPECIFIC: 'platform_specific' // Route based on job requirements
};

/**
 * Worker Platform Types
 */
const WorkerPlatform = {
    COLAB: 'colab',
    KAGGLE: 'kaggle',
    AWS: 'aws',
    LOCAL: 'local'
};

/**
 * GPU Performance Tiers (higher is better)
 */
const GPU_PERFORMANCE = {
    'Tesla V100': 10,
    'Tesla P100': 9,
    'Tesla T4': 8,
    'Tesla K80': 6,
    'CPU': 1
};

class LoadBalancer {
    constructor() {
        this.workers = new Map(); // worker_id -> worker info
        this.jobAssignments = new Map(); // job_id -> worker_id
        this.lastRoundRobinIndex = 0;
        this.strategy = LoadBalancingStrategy.LEAST_LOADED; // Default strategy
    }

    /**
     * Register a worker
     */
    registerWorker(workerData) {
        const workerId = workerData.worker_id;

        this.workers.set(workerId, {
            ...workerData,
            status: workerData.status || 'idle',
            platform: workerData.platform || 'unknown',
            gpu_available: workerData.gpu_available || false,
            gpu_name: workerData.gpu_name || 'CPU',
            gpu_memory_gb: workerData.gpu_memory_gb || 0,
            active_jobs: 0,
            total_jobs_completed: 0,
            last_heartbeat: Date.now(),
            registered_at: Date.now()
        });

        console.log(`✅ Worker registered: ${workerId} (${workerData.platform})`);
        this.logWorkerStats();
    }

    /**
     * Update worker heartbeat
     */
    updateHeartbeat(workerId) {
        const worker = this.workers.get(workerId);
        if (worker) {
            worker.last_heartbeat = Date.now();
            worker.status = worker.active_jobs > 0 ? 'busy' : 'idle';
        }
    }

    /**
     * Remove stale workers (no heartbeat in 2 minutes)
     */
    removeStaleWorkers() {
        const now = Date.now();
        const staleThreshold = 2 * 60 * 1000; // 2 minutes

        for (const [workerId, worker] of this.workers.entries()) {
            if (now - worker.last_heartbeat > staleThreshold) {
                console.log(`🗑️ Removing stale worker: ${workerId}`);
                this.workers.delete(workerId);
            }
        }
    }

    /**
     * Get all active workers
     */
    getActiveWorkers(platform = null) {
        this.removeStaleWorkers();

        let workers = Array.from(this.workers.values());

        // Filter by platform if specified
        if (platform) {
            workers = workers.filter(w => w.platform === platform);
        }

        // Only return workers that are available
        return workers.filter(w =>
            w.status === 'idle' || w.active_jobs === 0
        );
    }

    /**
     * Get worker statistics
     */
    getWorkerStats() {
        this.removeStaleWorkers();

        const stats = {
            total_workers: this.workers.size,
            by_platform: {},
            by_status: { idle: 0, busy: 0 },
            total_active_jobs: 0,
            gpu_workers: 0,
            cpu_workers: 0,
            gpu_details: [] // e.g., [{ name: 'Tesla T4', memory: 15.0, count: 1 }]
        };

        for (const worker of this.workers.values()) {
            // Count by platform
            stats.by_platform[worker.platform] = (stats.by_platform[worker.platform] || 0) + 1;

            // Count by status
            const status = worker.active_jobs > 0 ? 'busy' : 'idle';
            stats.by_status[status]++;

            // Count total active jobs
            stats.total_active_jobs += worker.active_jobs;

            // Count GPU vs CPU
            if (worker.gpu_available) {
                stats.gpu_workers++;
                const gpuName = worker.gpu_name || 'Unknown GPU';
                const gpuMem = worker.gpu_memory_gb || 0;

                const existingGpu = stats.gpu_details.find(g => g.name === gpuName && g.memory === gpuMem);
                if (existingGpu) {
                    existingGpu.count++;
                } else {
                    stats.gpu_details.push({ name: gpuName, memory: gpuMem, count: 1 });
                }
            } else {
                stats.cpu_workers++;
            }
        }

        return stats;
    }

    /**
     * Select best worker for a job using current strategy
     */
    selectWorker(jobRequirements = {}) {
        const availableWorkers = this.getActiveWorkers();

        if (availableWorkers.length === 0) {
            console.log('⚠️ No available workers');
            return null;
        }

        let selectedWorker = null;

        switch (this.strategy) {
            case LoadBalancingStrategy.ROUND_ROBIN:
                selectedWorker = this.selectRoundRobin(availableWorkers);
                break;

            case LoadBalancingStrategy.LEAST_LOADED:
                selectedWorker = this.selectLeastLoaded(availableWorkers);
                break;

            case LoadBalancingStrategy.GPU_PRIORITY:
                selectedWorker = this.selectGPUPriority(availableWorkers, jobRequirements);
                break;

            case LoadBalancingStrategy.PLATFORM_SPECIFIC:
                selectedWorker = this.selectPlatformSpecific(availableWorkers, jobRequirements);
                break;

            default:
                selectedWorker = this.selectLeastLoaded(availableWorkers);
        }

        if (selectedWorker) {
            console.log(`🎯 Selected worker: ${selectedWorker.worker_id} (${selectedWorker.platform})`);
            console.log(`   Strategy: ${this.strategy}`);
            console.log(`   GPU: ${selectedWorker.gpu_name}`);
        }

        return selectedWorker;
    }

    /**
     * Select multiple workers for a distributed job
     * Checks if enough workers are available, then selects them.
     */
    selectMultipleWorkers(count, jobRequirements = {}) {
        const availableWorkers = this.getActiveWorkers();

        // If job specifies GPU requirement, filter for GPU workers first
        let candidates = availableWorkers;
        if (jobRequirements.requires_gpu) {
            candidates = availableWorkers.filter(w => w.gpu_available);
        }

        if (candidates.length < count) {
            console.log(`⚠️ Not enough workers available for distributed job. Requested: ${count}, Available: ${candidates.length}`);
            return null;
        }

        // Ideally we select workers with similar GPUs, but for simplicity, 
        // we'll just sort them by performance and pick top 'count' workers
        candidates.sort((a, b) => {
            return this.calculateGPUScore(b) - this.calculateGPUScore(a);
        });

        const selectedWorkers = candidates.slice(0, count);

        console.log(`🤝 Selected ${count} workers for distributed job:`);
        selectedWorkers.forEach((w, idx) => {
            console.log(`   Rank ${idx}: ${w.worker_id} (${w.gpu_name})`);
        });

        return selectedWorkers;
    }

    /**
     * Round Robin Strategy - Distribute evenly
     */
    selectRoundRobin(workers) {
        if (workers.length === 0) return null;

        const worker = workers[this.lastRoundRobinIndex % workers.length];
        this.lastRoundRobinIndex++;
        return worker;
    }

    /**
     * Least Loaded Strategy - Choose worker with fewest active jobs
     */
    selectLeastLoaded(workers) {
        if (workers.length === 0) return null;

        return workers.reduce((least, current) => {
            if (!least) return current;
            return current.active_jobs < least.active_jobs ? current : least;
        }, null);
    }

    /**
     * GPU Priority Strategy - Prefer workers with better GPUs
     */
    selectGPUPriority(workers, jobRequirements) {
        if (workers.length === 0) return null;

        // First, filter for GPU workers if job requires GPU
        let candidates = workers;
        if (jobRequirements.requires_gpu) {
            candidates = workers.filter(w => w.gpu_available);
            if (candidates.length === 0) {
                console.log('⚠️ No GPU workers available, falling back to CPU');
                candidates = workers;
            }
        }

        // Sort by GPU performance score
        candidates.sort((a, b) => {
            const scoreA = this.calculateGPUScore(a);
            const scoreB = this.calculateGPUScore(b);
            return scoreB - scoreA; // Higher score first
        });

        return candidates[0];
    }

    /**
     * Platform Specific Strategy - Route based on job requirements
     */
    selectPlatformSpecific(workers, jobRequirements) {
        if (workers.length === 0) return null;

        // If job specifies preferred platform
        if (jobRequirements.preferred_platform) {
            const platformWorkers = workers.filter(
                w => w.platform === jobRequirements.preferred_platform
            );
            if (platformWorkers.length > 0) {
                return this.selectLeastLoaded(platformWorkers);
            }
        }

        // Smart routing based on job characteristics
        const jobPriority = jobRequirements.priority || 'normal';
        const estimatedTime = jobRequirements.estimated_time_minutes || 60;

        // Long jobs → Kaggle (more stable, longer sessions)
        if (estimatedTime > 120) {
            const kaggleWorkers = workers.filter(w => w.platform === WorkerPlatform.KAGGLE);
            if (kaggleWorkers.length > 0) {
                console.log('📊 Routing long job to Kaggle (more stable)');
                return this.selectLeastLoaded(kaggleWorkers);
            }
        }

        // High priority → Best available GPU
        if (jobPriority === 'high') {
            console.log('⚡ High priority job - selecting best GPU');
            return this.selectGPUPriority(workers, jobRequirements);
        }

        // Default: Least loaded
        return this.selectLeastLoaded(workers);
    }

    /**
     * Calculate GPU performance score
     */
    calculateGPUScore(worker) {
        if (!worker.gpu_available) return 0;

        let score = 0;

        // Base score from GPU model
        const gpuName = worker.gpu_name || 'CPU';
        score += GPU_PERFORMANCE[gpuName] || 1;

        // Bonus for available memory
        score += (worker.gpu_memory_gb || 0) / 10; // 1 point per 10GB

        // Penalty for active jobs
        score -= worker.active_jobs * 2;

        // Platform bonuses
        if (worker.platform === WorkerPlatform.KAGGLE) {
            score += 1; // Kaggle has 2x T4, more stable
        }

        return score;
    }

    /**
     * Assign job to worker
     */
    assignJob(jobId, workerId) {
        const worker = this.workers.get(workerId);
        if (worker) {
            worker.active_jobs++;
            worker.status = 'busy';
            this.jobAssignments.set(jobId, workerId);

            console.log(`📋 Job ${jobId} assigned to worker ${workerId}`);
            console.log(`   Worker now has ${worker.active_jobs} active job(s)`);
        }
    }

    /**
     * Mark job as complete and free worker
     */
    completeJob(jobId) {
        const workerId = this.jobAssignments.get(jobId);
        if (workerId) {
            const worker = this.workers.get(workerId);
            if (worker) {
                worker.active_jobs = Math.max(0, worker.active_jobs - 1);
                worker.total_jobs_completed++;
                worker.status = worker.active_jobs === 0 ? 'idle' : 'busy';

                console.log(`✅ Job ${jobId} completed by worker ${workerId}`);
                console.log(`   Worker now has ${worker.active_jobs} active job(s)`);
                console.log(`   Total completed: ${worker.total_jobs_completed}`);
            }
            this.jobAssignments.delete(jobId);
        }
    }

    /**
     * Set load balancing strategy
     */
    setStrategy(strategy) {
        if (Object.values(LoadBalancingStrategy).includes(strategy)) {
            this.strategy = strategy;
            console.log(`📊 Load balancing strategy set to: ${strategy}`);
        } else {
            console.log(`⚠️ Invalid strategy: ${strategy}`);
        }
    }

    /**
     * Log worker statistics
     */
    logWorkerStats() {
        const stats = this.getWorkerStats();
        console.log('\n📊 Worker Statistics:');
        console.log(`   Total Workers: ${stats.total_workers}`);
        console.log(`   Platforms: ${JSON.stringify(stats.by_platform)}`);
        console.log(`   Status: ${stats.by_status.idle} idle, ${stats.by_status.busy} busy`);
        console.log(`   GPUs: ${stats.gpu_workers} GPU workers, ${stats.cpu_workers} CPU workers`);
        console.log(`   Active Jobs: ${stats.total_active_jobs}`);
        console.log('');
    }

    /**
     * Get recommended worker for a specific job
     */
    async getRecommendedWorker(job) {
        // Parse job requirements
        const jobRequirements = {
            requires_gpu: job.resources?.gpu || false,
            preferred_platform: job.resources?.platform,
            priority: job.priority || 'normal',
            estimated_time_minutes: job.resources?.estimated_time || 60
        };

        // Select best worker
        const worker = this.selectWorker(jobRequirements);

        return worker;
    }
}

// Singleton instance
const loadBalancer = new LoadBalancer();

module.exports = {
    loadBalancer,
    LoadBalancingStrategy,
    WorkerPlatform
};
