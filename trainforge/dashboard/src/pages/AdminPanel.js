// File: trainforge/dashboard/src/pages/AdminPanel.js
// Comprehensive Admin Panel for TrainForge

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

// ── tiny helpers ────────────────────────────────────────────────────────────
const fmt = (n) => (n === null || n === undefined ? '—' : n);
const ago = (ms) => {
    if (!ms) return '—';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ${m % 60}m ago`;
};

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusPill({ status }) {
    const map = {
        pending: { bg: '#1e3a5f', color: '#60a5fa', label: 'Pending' },
        running: { bg: '#1a2e0a', color: '#4ade80', label: 'Running' },
        completed: { bg: '#0d2b0d', color: '#22c55e', label: 'Completed' },
        failed: { bg: '#2d0a0a', color: '#f87171', label: 'Failed' },
        cancelled: { bg: '#1f1f1f', color: '#9ca3af', label: 'Cancelled' },
        idle: { bg: '#0d2b0d', color: '#4ade80', label: 'Idle' },
        busy: { bg: '#1e3a5f', color: '#818cf8', label: 'Busy' },
        offline: { bg: '#1f1f1f', color: '#6b7280', label: 'Offline' },
        disabled: { bg: '#2d1a00', color: '#fb923c', label: 'Disabled' },
        online: { bg: '#0d2b0d', color: '#4ade80', label: 'Online' },
    };
    const s = map[status] || { bg: '#1f1f1f', color: '#9ca3af', label: status };
    return (
        <span style={{
            background: s.bg, color: s.color,
            padding: '2px 10px', borderRadius: 999,
            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap'
        }}>{s.label}</span>
    );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = '#60a5fa', sub }) {
    return (
        <div style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: 12, padding: '18px 22px', flex: 1, minWidth: 130
        }}>
            <div style={{ fontSize: 28, fontWeight: 700, color }}>{fmt(value)}</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{label}</div>
            {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children, action }) {
    return (
        <div style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: 14, marginBottom: 24, overflow: 'hidden'
        }}>
            <div style={{
                background: '#162032', padding: '14px 20px',
                borderBottom: '1px solid #334155',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{title}</div>
                {action}
            </div>
            <div style={{ padding: '18px 20px' }}>{children}</div>
        </div>
    );
}

// ── Confirm dialog ─────────────────────────────────────────────────────────────
function ConfirmBtn({ label, message, onConfirm, danger, disabled }) {
    const handleClick = () => {
        if (window.confirm(message)) onConfirm();
    };
    return (
        <button
            onClick={handleClick}
            disabled={disabled}
            style={{
                padding: '5px 12px', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
                border: `1px solid ${danger ? '#b91c1c' : '#334155'}`,
                background: danger ? '#450a0a' : 'transparent',
                color: danger ? '#f87171' : '#94a3b8',
                fontSize: 12, fontWeight: 600,
                opacity: disabled ? 0.5 : 1
            }}
        >
            {label}
        </button>
    );
}

// ── Main AdminPanel ────────────────────────────────────────────────────────────
export default function AdminPanel({ onNavigate }) {
    const { user, isAdmin } = useAuth();

    const [stats, setStats] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [maintenance, setMaintenance] = useState({ enabled: false, message: '' });
    const [gpuConfig, setGpuConfig] = useState(null);
    const [gpuEdits, setGpuEdits] = useState({});
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);
    const [jobFilter, setJobFilter] = useState('');
    const [maintenanceMsg, setMaintenanceMsg] = useState('System is under maintenance. Please try again later.');

    const showToast = (msg, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3000);
    };

    // ── Fetch all data ─────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        try {
            const [statsRes, jobsRes, workersRes, maintRes, gpuRes] = await Promise.all([
                api.get('/api/admin/stats'),
                api.get('/api/admin/jobs?limit=200'),
                api.get('/api/admin/workers'),
                api.get('/api/admin/maintenance'),
                api.get('/api/admin/gpu/config'),
            ]);
            setStats(statsRes.data.stats);
            setJobs(jobsRes.data.jobs || []);
            setWorkers(workersRes.data.workers || []);
            setMaintenance(maintRes.data.maintenance || {});
            setMaintenanceMsg(maintRes.data.maintenance?.message || maintenanceMsg);
            const cfg = gpuRes.data.config || {};
            setGpuConfig(cfg);
            setGpuEdits(cfg);
            setError(null);
        } catch (e) {
            setError(e.response?.data?.error || e.message || 'Failed to load admin data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) {
            fetchAll();
            const iv = setInterval(fetchAll, 15000);
            return () => clearInterval(iv);
        }
    }, [isAdmin, fetchAll]);

    // ── Actions ───────────────────────────────────────────────────────────
    const toggleMaintenance = async () => {
        try {
            const res = await api.post('/api/admin/maintenance', {
                enabled: !maintenance.enabled,
                message: maintenanceMsg
            });
            setMaintenance(res.data.maintenance);
            showToast(`Maintenance mode ${res.data.maintenance.enabled ? 'ENABLED' : 'DISABLED'}`);
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed', false);
        }
    };

    const updateGpuConfig = async () => {
        try {
            const res = await api.put('/api/admin/gpu/config', gpuEdits);
            setGpuConfig(res.data.config);
            showToast('GPU configuration saved');
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to save', false);
        }
    };

    const disableWorker = async (id) => {
        try {
            await api.post(`/api/admin/workers/${id}/disable`);
            showToast(`Worker ${id} disabled`);
            fetchAll();
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed', false);
        }
    };

    const enableWorker = async (id) => {
        try {
            await api.post(`/api/admin/workers/${id}/enable`);
            showToast(`Worker ${id} enabled`);
            fetchAll();
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed', false);
        }
    };

    const deleteWorker = async (id) => {
        try {
            await api.delete(`/api/admin/workers/${id}`);
            showToast(`Worker ${id} removed`);
            fetchAll();
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed', false);
        }
    };

    const overrideJobStatus = async (jobId, status) => {
        try {
            await api.put(`/api/admin/jobs/${jobId}/status`, { status });
            showToast(`Job status set to ${status}`);
            fetchAll();
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed', false);
        }
    };

    const deleteJob = async (jobId) => {
        try {
            await api.delete(`/api/admin/jobs/${jobId}`);
            showToast(`Job deleted`);
            fetchAll();
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed', false);
        }
    };

    // ── Access guard ─────────────────────────────────────────────────────
    if (!isAdmin) {
        return (
            <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 48, textAlign: 'center', maxWidth: 400 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                    <h2 style={{ margin: '0 0 8px', color: '#f1f5f9' }}>Access Denied</h2>
                    <p style={{ color: '#64748b', margin: 0 }}>Admin access required.</p>
                    <button onClick={() => onNavigate?.('dashboard')} style={btnStyle}>Back to Dashboard</button>
                </div>
            </div>
        );
    }

    const filteredJobs = jobs.filter(j =>
        !jobFilter ||
        j.project_name?.toLowerCase().includes(jobFilter.toLowerCase()) ||
        j.user_id?.toLowerCase().includes(jobFilter.toLowerCase()) ||
        j.job_id?.toLowerCase().includes(jobFilter.toLowerCase()) ||
        j.status?.toLowerCase().includes(jobFilter.toLowerCase())
    );

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'jobs', label: `Jobs (${jobs.length})` },
        { id: 'workers', label: `Workers (${workers.length})` },
        { id: 'gpu', label: 'GPU Config' },
        { id: 'system', label: 'System' },
    ];

    return (
        <div style={{ background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', fontFamily: "'Inter',system-ui,sans-serif", padding: '24px 28px' }}>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 9999,
                    background: toast.ok ? '#052e16' : '#450a0a',
                    border: `1px solid ${toast.ok ? '#16a34a' : '#b91c1c'}`,
                    color: toast.ok ? '#4ade80' : '#f87171',
                    padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
                }}>
                    {toast.ok ? '✅' : '❌'} {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                <button onClick={() => onNavigate?.('dashboard')} style={backBtn}>← Dashboard</button>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: '#f1f5f9' }}>
                        ⚙️ Admin Panel
                    </h1>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                        Signed in as <strong style={{ color: '#f97316' }}>{user?.email}</strong>
                    </div>
                </div>
                {maintenance.enabled && (
                    <div style={{ background: '#450a0a', border: '1px solid #b91c1c', color: '#f87171', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                        🔧 MAINTENANCE ON
                    </div>
                )}
                <button onClick={fetchAll} style={backBtn}>🔄 Refresh</button>
            </div>

            {error && (
                <div style={{ background: '#450a0a', border: '1px solid #b91c1c', color: '#f87171', padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13 }}>
                    ❌ {error}
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        style={{
                            padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                            background: activeTab === t.id ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#1e293b',
                            color: activeTab === t.id ? '#fff' : '#94a3b8',
                            border: activeTab === t.id ? 'none' : '1px solid #334155',
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>Loading admin data…</div>
            )}

            {/* ── OVERVIEW ──────────────────────────────────────────────── */}
            {!loading && activeTab === 'overview' && stats && (
                <>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
                        <StatCard label="Total Jobs" value={stats.jobs.total} color="#60a5fa" />
                        <StatCard label="Running" value={stats.jobs.running} color="#34d399" />
                        <StatCard label="Completed" value={stats.jobs.completed} color="#22c55e" />
                        <StatCard label="Failed" value={stats.jobs.failed} color="#f87171" />
                        <StatCard label="Workers Online" value={stats.workers.online} color="#818cf8" sub={`${stats.workers.total} total`} />
                        <StatCard label="GPUs" value={stats.workers.gpu_count} color="#fb923c" />
                        <StatCard label="Active Users" value={stats.users.active_submitters} color="#e879f9" />
                    </div>

                    <Section title="System Info">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                            {[
                                ['Uptime', `${Math.floor(stats.system.uptime_seconds / 3600)}h ${Math.floor((stats.system.uptime_seconds % 3600) / 60)}m`],
                                ['Heap Used', `${stats.system.memory.heap_used_mb} MB`],
                                ['Heap Total', `${stats.system.memory.heap_total_mb} MB`],
                                ['RSS Memory', `${stats.system.memory.rss_mb} MB`],
                                ['Node.js', stats.system.node_version],
                                ['Maintenance', stats.system.maintenance ? 'ENABLED' : 'Off'],
                            ].map(([k, v]) => (
                                <div key={k} style={{ background: '#0f172a', borderRadius: 8, padding: '12px 16px', border: '1px solid #1e293b' }}>
                                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>{k}</div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{v}</div>
                                </div>
                            ))}
                        </div>
                    </Section>

                    <Section title="Recent Activity" action={
                        <button onClick={() => setActiveTab('jobs')} style={linkBtn}>View all jobs →</button>
                    }>
                        {jobs.slice(0, 8).map(j => (
                            <div key={j.job_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #1e293b' }}>
                                <StatusPill status={j.status} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {j.project_name}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>{j.user_id || 'unknown user'}</div>
                                </div>
                                <div style={{ fontSize: 11, color: '#475569' }}>{j.created_at ? new Date(j.created_at).toLocaleString() : '—'}</div>
                            </div>
                        ))}
                        {jobs.length === 0 && <div style={{ color: '#64748b', textAlign: 'center', padding: '20px 0' }}>No jobs yet</div>}
                    </Section>
                </>
            )}

            {/* ── JOBS ──────────────────────────────────────────────────── */}
            {!loading && activeTab === 'jobs' && (
                <Section title="All Jobs" action={
                    <input
                        placeholder="Filter by name / user / status…"
                        value={jobFilter}
                        onChange={e => setJobFilter(e.target.value)}
                        style={filterInput}
                    />
                }>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #334155' }}>
                                    {['Status', 'Project', 'User', 'Created', 'Actions'].map(h => (
                                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredJobs.map(j => (
                                    <tr key={j.job_id} style={{ borderBottom: '1px solid #1e293b' }}>
                                        <td style={{ padding: '9px 10px' }}><StatusPill status={j.status} /></td>
                                        <td style={{ padding: '9px 10px' }}>
                                            <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{j.project_name}</div>
                                            <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>{j.job_id?.slice(0, 16)}…</div>
                                        </td>
                                        <td style={{ padding: '9px 10px', color: '#94a3b8', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {j.user_id || '—'}
                                        </td>
                                        <td style={{ padding: '9px 10px', color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>
                                            {j.created_at ? new Date(j.created_at).toLocaleString() : '—'}
                                        </td>
                                        <td style={{ padding: '9px 10px' }}>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {j.status !== 'cancelled' && (
                                                    <ConfirmBtn
                                                        label="Cancel"
                                                        message={`Cancel job "${j.project_name}"?`}
                                                        onConfirm={() => overrideJobStatus(j.job_id, 'cancelled')}
                                                    />
                                                )}
                                                {j.status === 'failed' && (
                                                    <ConfirmBtn
                                                        label="Retry"
                                                        message={`Reset job "${j.project_name}" to pending?`}
                                                        onConfirm={() => overrideJobStatus(j.job_id, 'pending')}
                                                    />
                                                )}
                                                <ConfirmBtn
                                                    label="Delete"
                                                    message={`Permanently delete job "${j.project_name}"? This cannot be undone.`}
                                                    onConfirm={() => deleteJob(j.job_id)}
                                                    danger
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredJobs.length === 0 && (
                                    <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No jobs match filter</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Section>
            )}

            {/* ── WORKERS ───────────────────────────────────────────────── */}
            {!loading && activeTab === 'workers' && (
                <Section title="Connected Workers" action={
                    <span style={{ fontSize: 12, color: '#64748b' }}>{workers.filter(w => w.is_online).length} online</span>
                }>
                    {workers.length === 0 ? (
                        <div style={{ color: '#64748b', textAlign: 'center', padding: '40px 0' }}>No workers registered</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #334155' }}>
                                        {['Status', 'Worker ID', 'Platform', 'GPU', 'Jobs', 'Actions'].map(h => (
                                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {workers.map(w => (
                                        <tr key={w.worker_id} style={{ borderBottom: '1px solid #1e293b' }}>
                                            <td style={{ padding: '9px 10px' }}>
                                                <StatusPill status={w.disabled ? 'disabled' : (w.is_online ? (w.status || 'idle') : 'offline')} />
                                            </td>
                                            <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {w.worker_id}
                                            </td>
                                            <td style={{ padding: '9px 10px', color: '#64748b' }}>{w.platform || '—'}</td>
                                            <td style={{ padding: '9px 10px', color: '#e2e8f0' }}>
                                                {w.gpu_available ? `⚡ ${w.gpu_name || 'GPU'} ${w.gpu_memory_gb ? `(${w.gpu_memory_gb}GB)` : ''}` : 'CPU'}
                                            </td>
                                            <td style={{ padding: '9px 10px', color: '#64748b', fontSize: 12 }}>
                                                {w.active_jobs || 0} active · {w.total_jobs_completed || 0} done
                                            </td>
                                            <td style={{ padding: '9px 10px' }}>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {w.disabled ? (
                                                        <ConfirmBtn
                                                            label="Enable"
                                                            message={`Enable worker ${w.worker_id}?`}
                                                            onConfirm={() => enableWorker(w.worker_id)}
                                                        />
                                                    ) : (
                                                        <ConfirmBtn
                                                            label="Disable"
                                                            message={`Disable worker ${w.worker_id}? It won't receive new jobs.`}
                                                            onConfirm={() => disableWorker(w.worker_id)}
                                                        />
                                                    )}
                                                    <ConfirmBtn
                                                        label="Remove"
                                                        message={`Permanently remove worker ${w.worker_id}?`}
                                                        onConfirm={() => deleteWorker(w.worker_id)}
                                                        danger
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Section>
            )}

            {/* ── GPU CONFIG ────────────────────────────────────────────── */}
            {!loading && activeTab === 'gpu' && gpuConfig && (
                <>
                    <Section title="GPU & Worker Configuration">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                            <Field
                                label="Max GPUs per Job"
                                type="number"
                                value={gpuEdits.max_gpu_per_job ?? ''}
                                onChange={v => setGpuEdits(p => ({ ...p, max_gpu_per_job: parseInt(v) || 1 }))}
                                min={1} max={16}
                            />
                            <Field
                                label="Min GPU Memory (GB)"
                                type="number"
                                value={gpuEdits.gpu_memory_threshold_gb ?? ''}
                                onChange={v => setGpuEdits(p => ({ ...p, gpu_memory_threshold_gb: parseFloat(v) || 0 }))}
                                min={0} max={80}
                            />
                            <Field
                                label="Max Concurrent Jobs"
                                type="number"
                                value={gpuEdits.max_concurrent_jobs ?? ''}
                                onChange={v => setGpuEdits(p => ({ ...p, max_concurrent_jobs: parseInt(v) || 1 }))}
                                min={1} max={100}
                            />
                            <Field
                                label="Worker Timeout (minutes)"
                                type="number"
                                value={gpuEdits.worker_timeout_minutes ?? ''}
                                onChange={v => setGpuEdits(p => ({ ...p, worker_timeout_minutes: parseInt(v) || 60 }))}
                                min={5} max={1440}
                            />
                            <div>
                                <label style={labelStyle}>Load Balancing Strategy</label>
                                <select
                                    value={gpuEdits.load_balancing_strategy || 'least_loaded'}
                                    onChange={e => setGpuEdits(p => ({ ...p, load_balancing_strategy: e.target.value }))}
                                    style={selectStyle}
                                >
                                    <option value="round_robin">Round Robin</option>
                                    <option value="least_loaded">Least Loaded (default)</option>
                                    <option value="gpu_priority">GPU Priority</option>
                                    <option value="platform_specific">Platform Specific</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Auto Scale Workers</label>
                                <select
                                    value={gpuEdits.auto_scale ? 'true' : 'false'}
                                    onChange={e => setGpuEdits(p => ({ ...p, auto_scale: e.target.value === 'true' }))}
                                    style={selectStyle}
                                >
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                            <label style={labelStyle}>Allowed Platforms (comma-separated)</label>
                            <input
                                value={(gpuEdits.allowed_platforms || []).join(', ')}
                                onChange={e => setGpuEdits(p => ({ ...p, allowed_platforms: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                                style={inputStyle}
                                placeholder="colab, kaggle, aws, local"
                            />
                        </div>

                        <button onClick={updateGpuConfig} style={saveBtn}>
                            💾 Save GPU Configuration
                        </button>
                    </Section>

                    <Section title="Current Active Config">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
                            {Object.entries(gpuConfig).map(([k, v]) => (
                                <div key={k} style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', border: '1px solid #1e293b' }}>
                                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>{k.replace(/_/g, ' ')}</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                                        {Array.isArray(v) ? v.join(', ') : String(v)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>
                </>
            )}

            {/* ── SYSTEM ────────────────────────────────────────────────── */}
            {!loading && activeTab === 'system' && (
                <>
                    <Section title="Maintenance Mode" action={
                        <StatusPill status={maintenance.enabled ? 'failed' : 'completed'} />
                    }>
                        <div style={{ marginBottom: 16 }}>
                            <label style={labelStyle}>Maintenance Message</label>
                            <textarea
                                value={maintenanceMsg}
                                onChange={e => setMaintenanceMsg(e.target.value)}
                                rows={3}
                                style={{ ...inputStyle, resize: 'vertical', height: 'auto' }}
                                placeholder="Message shown to users during maintenance..."
                            />
                        </div>
                        {maintenance.enabled && (
                            <div style={{ background: '#1e3a0a', border: '1px solid #166534', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#4ade80' }}>
                                ⚠️ Maintenance enabled by <strong>{maintenance.enabled_by}</strong> at {maintenance.started_at ? new Date(maintenance.started_at).toLocaleString() : '—'}
                            </div>
                        )}
                        <button
                            onClick={toggleMaintenance}
                            style={{
                                padding: '10px 22px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: maintenance.enabled
                                    ? 'linear-gradient(135deg,#16a34a,#15803d)'
                                    : 'linear-gradient(135deg,#dc2626,#b91c1c)',
                                color: '#fff', fontWeight: 700, fontSize: 14
                            }}
                        >
                            {maintenance.enabled ? '✅ Disable Maintenance Mode' : '🔧 Enable Maintenance Mode'}
                        </button>
                    </Section>

                    {stats && (
                        <Section title="Live System Stats">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                                {[
                                    ['Server Uptime', `${Math.floor(stats.system.uptime_seconds / 3600)}h ${Math.floor((stats.system.uptime_seconds % 3600) / 60)}m`],
                                    ['Heap Used', `${stats.system.memory.heap_used_mb} MB`],
                                    ['Heap Total', `${stats.system.memory.heap_total_mb} MB`],
                                    ['RSS', `${stats.system.memory.rss_mb} MB`],
                                    ['Node.js', stats.system.node_version],
                                    ['Timestamp', new Date(stats.system.timestamp).toLocaleTimeString()],
                                ].map(([k, v]) => (
                                    <div key={k} style={{ background: '#0f172a', borderRadius: 8, padding: '12px 16px', border: '1px solid #1e293b' }}>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>{k}</div>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{v}</div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}
                </>
            )}
        </div>
    );
}

// ── Field components ─────────────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, min, max, placeholder }) {
    return (
        <div>
            <label style={labelStyle}>{label}</label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                min={min}
                max={max}
                placeholder={placeholder}
                style={inputStyle}
            />
        </div>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6
};

const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
    padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none',
    fontFamily: "'Inter',system-ui,sans-serif"
};

const selectStyle = {
    ...inputStyle, cursor: 'pointer'
};

const saveBtn = {
    marginTop: 20, padding: '10px 24px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer'
};

const backBtn = {
    background: 'transparent', border: '1px solid #334155',
    color: '#94a3b8', borderRadius: 8, padding: '8px 14px',
    cursor: 'pointer', fontSize: 13
};

const linkBtn = {
    background: 'transparent', border: 'none',
    color: '#818cf8', fontSize: 12, cursor: 'pointer', fontWeight: 600
};

const btnStyle = {
    marginTop: 20, padding: '10px 24px', borderRadius: 8,
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer'
};

const filterInput = {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
    padding: '6px 12px', color: '#e2e8f0', fontSize: 12, outline: 'none', width: 240
};
