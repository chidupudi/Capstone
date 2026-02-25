// File: trainforge/api/src/db/models.js
// Firestore-backed JobModel — drop-in replacement for the Mongoose version

const { v4: uuidv4 } = require('uuid');
const { getDB } = require('./firebase');

const JOBS_COLLECTION = 'jobs';

class JobModel {

    // ─── helpers ──────────────────────────────────────────────────────────────
    _col() {
        return getDB().collection(JOBS_COLLECTION);
    }

    /** Convert a Firestore doc snapshot to a plain job object */
    _format(docSnap) {
        if (!docSnap.exists) throw new Error('Job not found');
        const d = docSnap.data();
        return {
            job_id: d.job_id,
            user_id: d.user_id ?? null,
            project_name: d.project_name,
            training_script: d.training_script,
            status: d.status,
            progress: d.progress ?? 0,
            resources: d.resources,
            config: d.config,
            logs: d.logs ?? [],
            error_message: d.error_message ?? null,
            gpu_id: d.gpu_id ?? null,
            worker_node: d.worker_node ?? null,
            duration: d.duration ?? null,
            created_at: d.created_at?.toDate?.()?.toISOString() ?? d.created_at ?? null,
            updated_at: d.updated_at?.toDate?.()?.toISOString() ?? d.updated_at ?? null,
            started_at: d.started_at?.toDate?.()?.toISOString() ?? d.started_at ?? null,
            completed_at: d.completed_at?.toDate?.()?.toISOString() ?? d.completed_at ?? null,
        };
    }

    // ─── CRUD ─────────────────────────────────────────────────────────────────

    async createJob(jobData) {
        try {
            const job_id = uuidv4();
            const now = new Date();

            const doc = {
                job_id,
                user_id: jobData.user_id || null,
                project_name: jobData.project?.name || 'untitled-project',
                training_script: jobData.training?.script || 'train.py',
                status: 'pending',
                progress: 0,
                resources: jobData.resources || { gpu: 1, cpu: 2, memory: '4Gi' },
                config: jobData,
                logs: [],
                error_message: null,
                gpu_id: null,
                worker_node: null,
                duration: null,
                created_at: now,
                updated_at: now,
                started_at: null,
                completed_at: null,
            };

            await this._col().doc(job_id).set(doc);
            console.log(`✅ Job created in Firestore: ${job_id}`);

            return this._format({ exists: true, data: () => doc });

        } catch (error) {
            console.error('❌ Error creating job:', error);
            throw new Error(`Failed to create job: ${error.message}`);
        }
    }

    async getJob(jobId) {
        try {
            const snap = await this._col().doc(jobId).get();
            if (!snap.exists) throw new Error('Job not found');
            return this._format(snap);
        } catch (error) {
            console.error('❌ Error getting job:', error);
            throw new Error(`Failed to get job: ${error.message}`);
        }
    }

    async updateJob(jobId, updates) {
        try {
            const ref = this._col().doc(jobId);
            const snap = await ref.get();
            if (!snap.exists) throw new Error('Job not found');

            const payload = { ...updates, updated_at: new Date() };
            await ref.update(payload);

            const updated = await ref.get();
            console.log(`📝 Job updated in Firestore: ${jobId}`);
            return this._format(updated);

        } catch (error) {
            console.error('❌ Error updating job:', error);
            throw new Error(`Failed to update job: ${error.message}`);
        }
    }

    async listJobs(limit = 50) {
        try {
            const snap = await this._col()
                .orderBy('created_at', 'desc')
                .limit(limit)
                .get();

            return snap.docs.map(doc => this._format(doc));

        } catch (error) {
            console.error('❌ Error listing jobs:', error);
            throw new Error(`Failed to list jobs: ${error.message}`);
        }
    }

    async addJobLog(jobId, logEntry) {
        try {
            const ref = this._col().doc(jobId);
            const snap = await ref.get();
            if (!snap.exists) throw new Error('Job not found');

            const existing = snap.data().logs || [];
            existing.push({ message: logEntry, timestamp: new Date().toISOString() });

            // Keep last 200 log entries to avoid doc size limit
            const trimmed = existing.slice(-200);

            await ref.update({ logs: trimmed, updated_at: new Date() });
            console.log(`📝 Log added to job: ${jobId}`);

        } catch (error) {
            console.error('❌ Error adding job log:', error);
            throw new Error(`Failed to add job log: ${error.message}`);
        }
    }

    async getJobsByStatus(status) {
        try {
            const snap = await this._col()
                .where('status', '==', status)
                .orderBy('created_at', 'asc')
                .get();

            return snap.docs.map(doc => this._format(doc));

        } catch (error) {
            // Firestore requires a composite index for where+orderBy — fall back gracefully
            console.warn('⚠️ getJobsByStatus fallback (index may be missing):', error.message);
            const all = await this.listJobs(200);
            return all.filter(j => j.status === status);
        }
    }

    async deleteJob(jobId) {
        try {
            const ref = this._col().doc(jobId);
            const snap = await ref.get();
            if (!snap.exists) throw new Error('Job not found');

            const formatted = this._format(snap);
            await ref.delete();

            console.log(`🗑️ Job deleted from Firestore: ${jobId}`);
            return formatted;

        } catch (error) {
            console.error('❌ Error deleting job:', error);
            throw new Error(`Failed to delete job: ${error.message}`);
        }
    }
}

// Singleton
const jobModel = new JobModel();

module.exports = {
    JobModel: jobModel,
};