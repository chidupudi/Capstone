// File: trainforge/dashboard/src/pages/GPUConnect.js
// GPU Connect Admin Portal — PIN-gated, resilient Colab/Kaggle management

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api as API } from '../services/api';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const TUNNEL = 'https://trainforge.datenwork.in';

// ─── tiny inline icon ──────────────────────────────────────────────────────
const Ico = ({ d, s = 16 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
    </svg>
);

// ─── Copy block ───────────────────────────────────────────────────────────
function CopyBlock({ code, label }) {
    const [copied, setCopied] = useState(false);
    const doCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div style={css.codeWrap}>
            {label && <div style={css.codeLabel}>{label}</div>}
            <pre style={css.codePre}>{code}</pre>
            <button onClick={doCopy} style={css.copyBtn}>
                {copied ? '✅ Copied' : '📋 Copy'}
            </button>
        </div>
    );
}

// ─── Status badge ─────────────────────────────────────────────────────────
function Badge({ status }) {
    const map = {
        idle: ['#052e16', '#4ade80', '● Idle'],
        training: ['#1e1b4b', '#818cf8', '⚡ Training'],
        offline: ['#1f2937', '#6b7280', '○ Offline'],
        error: ['#450a0a', '#f87171', '✕ Error'],
    };
    const [bg, fg, label] = map[status] || map.offline;
    return (
        <span style={{
            background: bg, color: fg, padding: '2px 10px',
            borderRadius: 999, fontSize: 11, fontWeight: 700
        }}>{label}</span>
    );
}

// ─── Worker card ──────────────────────────────────────────────────────────
function WorkerCard({ w }) {
    const isKaggle = w.location === 'kaggle' || w.worker_type === 'external_kaggle';
    const gpu = w.capabilities?.gpu_info?.name || w.gpu_name || 'Unknown GPU';
    const memG = w.capabilities?.gpu_info?.memory_gb || w.gpu_memory_gb || 0;
    const ago = w.last_heartbeat
        ? `${Math.round((Date.now() / 1000 - w.last_heartbeat) / 60)} min ago`
        : 'just now';
    return (
        <div style={css.wCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{isKaggle ? '📊' : '🔬'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 12, fontWeight: 600, color: '#e2e8f0',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                        {w.worker_id}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{isKaggle ? 'Kaggle' : 'Google Colab'}</div>
                </div>
                <Badge status={w.status || 'offline'} />
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                🖥 {gpu} · {memG} GB
            </div>
            {w.current_job_id && (
                <div style={{ fontSize: 11, color: '#818cf8', marginBottom: 4 }}>
                    ⚡ Job: {String(w.current_job_id).slice(0, 20)}…
                </div>
            )}
            <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>🕒 {ago}</div>
        </div>
    );
}



// ─── Colab wizard ─────────────────────────────────────────────────────────
function ColabWizard({ tunnelUrl }) {
    const url = tunnelUrl || TUNNEL;
    const cell1 = `!pip install requests torch torchvision -q`;
    const cell2 =
        `import os, urllib.request

API_URL = '${url}'
os.environ['TRAINFORGE_API_URL'] = API_URL

# Download + run the resilient worker
req = urllib.request.Request(
    API_URL + '/api/config/worker-script?platform=colab',
    headers={'User-Agent': 'TrainForge/2.0'}
)
with urllib.request.urlopen(req) as r:
    exec(compile(r.read().decode(), 'colab_worker.py', 'exec'))`;

    return (
        <div style={css.wizard}>
            <Step n={1} title="Open a Colab notebook with GPU runtime"
                desc="Runtime → Change runtime type → T4 GPU (free tier)" />
            <Step n={2} title="Cell 1 — Install dependencies">
                <CopyBlock code={cell1} />
            </Step>
            <Step n={3} title="Cell 2 — Start the worker (copy this entire cell)">
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                    The worker auto-reconnects if the API restarts. Keep the cell running.
                </div>
                <CopyBlock code={cell2} />
            </Step>
            <Step n={4} title="Worker appears in Live Fleet below"
                desc="Status goes Offline → Idle within ~15 seconds. It will reconnect automatically if dropped." />
        </div>
    );
}

// ─── Kaggle wizard ────────────────────────────────────────────────────────
function KaggleWizard({ tunnelUrl }) {
    const url = tunnelUrl || TUNNEL;
    const cell =
        `import os, urllib.request

API_URL = '${url}'
os.environ['TRAINFORGE_API_URL'] = API_URL

req = urllib.request.Request(
    API_URL + '/api/config/worker-script?platform=kaggle',
    headers={'User-Agent': 'TrainForge/2.0'}
)
with urllib.request.urlopen(req) as r:
    exec(compile(r.read().decode(), 'kaggle_worker.py', 'exec'))`;

    return (
        <div style={css.wizard}>
            <Step n={1} title="Create a Kaggle notebook"
                desc="Settings → Accelerator → GPU T4 x2 (30 h/week free)" />
            <Step n={2} title="Run this cell">
                <CopyBlock code={cell} />
            </Step>
            <Step n={3} title="GPU shows up in fleet below"
                desc="Worker registers automatically. Keep the notebook running." />
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function GPUConnect({ onNavigate }) {
    const { isAdmin } = useAuth();

    const [tunnelUrl, setTunnelUrl] = useState(TUNNEL);
    const [savedUrl, setSavedUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [testStatus, setTestStatus] = useState(null);
    const [platform, setPlatform] = useState('colab');
    const [workers, setWorkers] = useState([]);
    const [fleetErr, setFleetErr] = useState(null);
    const [tick, setTick] = useState('—');
    const timerRef = useRef(null);

    const loadTunnel = useCallback(async () => {
        try {
            const r = await API.get('/api/config/tunnel');
            const u = r.data.tunnel_url || TUNNEL;
            setSavedUrl(u);
            setTunnelUrl(u);
        } catch { }
    }, []);

    const fetchWorkers = useCallback(async () => {
        try {
            const r = await API.get('/api/workers/distributed/status');
            const list = r.data.workers || r.data || [];
            setWorkers(Array.isArray(list) ? list : []);
            setFleetErr(null);
            setTick(new Date().toLocaleTimeString());
        } catch {
            setFleetErr('API unreachable — make sure the server is running');
        }
    }, []);

    useEffect(() => {
        if (!isAdmin) return;
        loadTunnel();
        fetchWorkers();
        timerRef.current = setInterval(fetchWorkers, 5000);
        return () => clearInterval(timerRef.current);
    }, [isAdmin, loadTunnel, fetchWorkers]);

    const saveTunnel = async () => {
        setSaving(true);
        try {
            const r = await API.put('/api/config/tunnel', { tunnel_url: tunnelUrl });
            setSavedUrl(r.data.tunnel_url || tunnelUrl);
        } catch (e) {
            alert('Failed: ' + (e.response?.data?.error || e.message));
        } finally { setSaving(false); }
    };

    const testTunnel = async () => {
        setTestStatus('testing');
        try {
            await axios.get(`${tunnelUrl}/health`, {
                timeout: 6000,
                headers: { 'User-Agent': 'TrainForge/2.0' }
            });
            setTestStatus('ok');
        } catch { setTestStatus('fail'); }
    };

    // Auth Gate
    if (!isAdmin) {
        return (
            <div style={css.page}>
                <div style={{ ...css.pinBox, margin: '100px auto' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
                    <h2 style={{ margin: '0 0 6px', color: '#f1f5f9', fontSize: 20 }}>Access Denied</h2>
                    <p style={{ color: '#64748b', fontSize: 13, margin: '0' }}>You do not have permission to access the admin portal.</p>
                </div>
            </div>
        );
    }

    const idle = workers.filter(w => w.status === 'idle').length;
    const training = workers.filter(w => w.status === 'training').length;

    return (
        <div style={css.page}>
            {/* Header */}
            <div style={css.header}>
                <button onClick={() => onNavigate?.('dashboard')} style={css.back}>
                    ← Back
                </button>
                <div>
                    <h1 style={css.h1}>⚡ GPU Connect Admin</h1>
                    <div style={css.sub}>Manage your distributed training fleet · <strong>{savedUrl || TUNNEL}</strong></div>
                </div>
            </div>

            {/* ── Section 1: Tunnel URL ──────────────────────────────────────── */}
            <Card title="1 · Public Tunnel URL"
                desc="Workers use this URL to reach your local API from anywhere.">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <input style={css.input} value={tunnelUrl}
                        onChange={e => setTunnelUrl(e.target.value)}
                        placeholder="https://trainforge.datenwork.in" />
                    <Btn onClick={saveTunnel} disabled={saving || !tunnelUrl}>
                        {saving ? 'Saving…' : '💾 Save'}
                    </Btn>
                    <Btn secondary onClick={testTunnel} disabled={testStatus === 'testing' || !tunnelUrl}>
                        {testStatus === 'testing' ? 'Testing…' : '🔗 Test'}
                    </Btn>
                </div>
                {testStatus === 'ok' && <Alert ok>✅ Reachable! Workers can connect.</Alert>}
                {testStatus === 'fail' && <Alert>❌ Cannot reach tunnel. Is <code>cloudflared tunnel run trainforge</code> running?</Alert>}
                <div style={css.tip}>
                    <strong>Your permanent domain:</strong> <code>https://trainforge.datenwork.in</code>
                    <br />To start: <code>cloudflared tunnel run trainforge</code>
                </div>
            </Card>

            {/* ── Section 2: Connect wizard ─────────────────────────────────── */}
            <Card title="2 · Connect a GPU Worker"
                desc="Follow the steps in your notebook. Workers auto-reconnect if dropped.">
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    {['colab', 'kaggle'].map(p => (
                        <button key={p} onClick={() => setPlatform(p)}
                            style={platform === p ? css.tabOn : css.tabOff}>
                            {p === 'colab' ? '🔬 Google Colab' : '📊 Kaggle Kernel'}
                        </button>
                    ))}
                </div>
                {platform === 'colab'
                    ? <ColabWizard tunnelUrl={savedUrl} />
                    : <KaggleWizard tunnelUrl={savedUrl} />}
            </Card>

            {/* ── Section 3: Live Fleet ─────────────────────────────────────── */}
            <Card title="3 · Live GPU Fleet"
                desc={`Auto-refreshes every 5 s · ${tick}`}>
                <div style={css.statsRow}>
                    <Stat label="Total" val={workers.length} col="#94a3b8" />
                    <Stat label="Idle" val={idle} col="#4ade80" />
                    <Stat label="Training" val={training} col="#818cf8" />
                    <Stat label="Offline" val={workers.length - idle - training} col="#6b7280" />
                </div>

                {fleetErr && <Alert>{fleetErr}</Alert>}

                {!fleetErr && workers.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b' }}>
                        🖥️ No workers connected yet. Follow the guide above.
                    </div>
                )}

                <div style={css.grid}>
                    {workers.map(w => <WorkerCard key={w.worker_id} w={w} />)}
                </div>

                <button onClick={fetchWorkers}
                    style={{ ...css.back, marginTop: 12 }}>🔄 Refresh</button>
            </Card>
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function Card({ title, desc, children }) {
    return (
        <div style={css.card}>
            <div style={css.cardHead}>
                <div style={css.cardTitle}>{title}</div>
                {desc && <div style={css.cardDesc}>{desc}</div>}
            </div>
            <div style={css.cardBody}>{children}</div>
        </div>
    );
}
function Step({ n, title, desc, children }) {
    return (
        <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <span style={css.stepN}>{n}</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>{title}</div>
                {desc && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{desc}</div>}
                {children}
            </div>
        </div>
    );
}
function Btn({ children, onClick, disabled, secondary }) {
    return (
        <button onClick={onClick} disabled={disabled} style={secondary ? css.btnSec : css.btnPrimary}>
            {children}
        </button>
    );
}
function Alert({ children, ok }) {
    return (
        <div style={{
            background: ok ? '#052e16' : '#1c0a0a',
            border: `1px solid ${ok ? '#16a34a' : '#b91c1c'}`,
            borderRadius: 8, padding: '10px 14px', fontSize: 12,
            color: ok ? '#4ade80' : '#f87171', marginBottom: 10
        }}>
            {children}
        </div>
    );
}
function Stat({ label, val, col }) {
    return (
        <div style={{
            background: '#0f172a', border: '1px solid #1e293b',
            borderRadius: 10, padding: '10px 18px', textAlign: 'center'
        }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: col }}>{val}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
        </div>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const css = {
    page: {
        minHeight: '100vh', background: '#0f172a', color: '#e2e8f0',
        fontFamily: "'Inter',system-ui,sans-serif",
        padding: '24px 28px', maxWidth: 860, margin: '0 auto',
    },
    header: { display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28 },
    h1: { fontSize: 24, fontWeight: 700, margin: 0, color: '#f1f5f9' },
    sub: { fontSize: 12, color: '#64748b', marginTop: 4 },
    back: {
        background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
        borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13
    },
    lockBtn: {
        marginLeft: 'auto', background: 'transparent', border: '1px solid #334155',
        color: '#94a3b8', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12
    },

    card: {
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: 14, marginBottom: 20, overflow: 'hidden'
    },
    cardHead: { background: '#162032', padding: '16px 22px', borderBottom: '1px solid #334155' },
    cardTitle: { fontSize: 16, fontWeight: 600, color: '#f1f5f9' },
    cardDesc: { fontSize: 12, color: '#64748b', marginTop: 3 },
    cardBody: { padding: '18px 22px' },

    input: {
        flex: 1, minWidth: 200, background: '#0f172a', border: '1px solid #334155',
        borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none'
    },
    btnPrimary: {
        padding: '9px 18px', borderRadius: 8,
        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
        border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer'
    },
    btnSec: {
        padding: '9px 16px', borderRadius: 8, background: 'transparent',
        border: '1px solid #334155', color: '#94a3b8', fontSize: 13, cursor: 'pointer'
    },
    tip: {
        background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 8,
        padding: '12px 16px', fontSize: 12, color: '#94a3b8', lineHeight: 1.8
    },

    codeWrap: {
        background: '#0d1117', border: '1px solid #21262d',
        borderRadius: 8, position: 'relative', marginTop: 6
    },
    codeLabel: {
        padding: '5px 12px', fontSize: 11, color: '#6b7280',
        borderBottom: '1px solid #21262d'
    },
    codePre: {
        margin: 0, padding: '10px 12px',
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
        fontSize: 12, color: '#a5f3fc', lineHeight: 1.6,
        overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
    },
    copyBtn: {
        position: 'absolute', top: 6, right: 6, background: '#21262d',
        border: '1px solid #30363d', borderRadius: 6, padding: '3px 10px',
        color: '#8b949e', fontSize: 11, cursor: 'pointer'
    },

    tabOn: {
        padding: '8px 20px', borderRadius: 8,
        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
        border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer'
    },
    tabOff: {
        padding: '8px 20px', borderRadius: 8, background: 'transparent',
        border: '1px solid #334155', color: '#94a3b8', fontSize: 13, cursor: 'pointer'
    },

    wizard: { display: 'flex', flexDirection: 'column' },
    stepN: {
        width: 26, height: 26, borderRadius: '50%', background: '#334155',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 12, color: '#94a3b8', flexShrink: 0, marginTop: 2
    },

    statsRow: { display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 },
    wCard: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14 },

    // PIN gate
    pinPage: {
        minHeight: '100vh', background: '#0f172a', display: 'flex',
        alignItems: 'center', justifyContent: 'center'
    },
    pinBox: {
        background: '#1e293b', border: '1px solid #334155', borderRadius: 16,
        padding: '40px 36px', textAlign: 'center', width: 320
    },
    pinInput: {
        width: '100%', boxSizing: 'border-box', background: '#0f172a',
        border: '2px solid #334155', borderRadius: 10, padding: '12px 16px',
        color: '#e2e8f0', fontSize: 20, letterSpacing: 8, textAlign: 'center', outline: 'none'
    },
};
