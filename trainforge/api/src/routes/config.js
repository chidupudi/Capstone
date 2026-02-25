// File: trainforge/api/src/routes/config.js
// Platform configuration endpoints — tunnel URL management

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { verifyToken, isAdmin } = require('../middleware/auth');

// In-memory tunnel URL (survives hot-reloads but not full restarts — good enough)
let tunnelUrl = process.env.TUNNEL_URL || '';

const ENV_PATH = path.join(__dirname, '../../.env');

// Helper: read .env file into key-value object
function readEnv() {
    try {
        const content = fs.readFileSync(ENV_PATH, 'utf8');
        const result = {};
        content.split('\n').forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#')) return;
            const idx = line.indexOf('=');
            if (idx === -1) return;
            result[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
        });
        return result;
    } catch {
        return {};
    }
}

// Helper: write key-value object back to .env
function writeEnv(data) {
    const lines = [];
    // Keep comment header
    lines.push('# TrainForge API Environment Configuration');
    lines.push('');
    for (const [key, value] of Object.entries(data)) {
        lines.push(`${key}=${value}`);
    }
    fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf8');
}

// ─────────────────────────────────────────────
// GET /api/config/tunnel  →  return current tunnel URL
// ─────────────────────────────────────────────
router.get('/tunnel', (req, res) => {
    res.json({
        success: true,
        tunnel_url: tunnelUrl,
        configured: !!tunnelUrl,
        message: tunnelUrl
            ? 'Tunnel URL is configured'
            : 'No tunnel URL set — paste your Cloudflare or ngrok URL in the dashboard'
    });
});

// ─────────────────────────────────────────────
// PUT /api/config/tunnel  →  save new tunnel URL
// ─────────────────────────────────────────────
router.put('/tunnel', verifyToken, isAdmin, (req, res) => {
    const { tunnel_url } = req.body;

    if (!tunnel_url || typeof tunnel_url !== 'string') {
        return res.status(400).json({ error: 'tunnel_url is required' });
    }

    const url = tunnel_url.trim().replace(/\/$/, ''); // strip trailing slash

    // Validate it looks like a URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return res.status(400).json({ error: 'tunnel_url must start with http:// or https://' });
    }

    // Save to memory
    tunnelUrl = url;

    // Persist to .env
    try {
        const env = readEnv();
        env['TUNNEL_URL'] = url;
        writeEnv(env);
        console.log(`✅ Tunnel URL saved: ${url}`);
    } catch (err) {
        console.warn('⚠️ Could not write to .env:', err.message);
        // Continue — in-memory save still works
    }

    res.json({
        success: true,
        message: 'Tunnel URL saved successfully',
        tunnel_url: url
    });
});

// ─────────────────────────────────────────────
// GET /api/config/platform  →  general platform info for dashboard
// ─────────────────────────────────────────────
router.get('/platform', (req, res) => {
    res.json({
        success: true,
        platform: {
            name: 'TrainForge',
            version: '0.1.0',
            api_url: `http://localhost:${process.env.PORT || 3000}`,
            tunnel_url: tunnelUrl || null,
            tunnel_configured: !!tunnelUrl,
            worker_connect_url: tunnelUrl ? `${tunnelUrl}/api/workers/register` : null
        }
    });
});

// ─────────────────────────────────────────────
// GET /api/config/worker-script?platform=colab|kaggle
// Returns the Python worker script as plain text so Colab/Kaggle can download it
// ─────────────────────────────────────────────
router.get('/worker-script', (req, res) => {
    const platform = (req.query.platform || 'colab').toLowerCase().trim();

    // Map platform → script filename
    const scriptMap = {
        colab: 'colab_worker.py',
        kaggle: 'kaggle_worker.py',
    };

    const filename = scriptMap[platform];
    if (!filename) {
        return res.status(400).json({
            error: `Unknown platform "${platform}". Use ?platform=colab or ?platform=kaggle`
        });
    }

    // Locate the script — it lives in external-gpu/ sibling to the api/ folder
    const scriptPath = path.resolve(__dirname, '../../../external-gpu', filename);

    if (!fs.existsSync(scriptPath)) {
        console.error(`❌ Worker script not found: ${scriptPath}`);
        return res.status(404).json({
            error: `Worker script not found: ${filename}`,
            expected_path: scriptPath
        });
    }

    try {
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        // Serve as plain Python text so urllib.request.urlretrieve saves it directly
        res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(scriptContent);

        console.log(`📥 Worker script served: ${filename} → ${req.ip}`);
    } catch (err) {
        console.error('❌ Error reading worker script:', err.message);
        res.status(500).json({ error: 'Failed to read worker script' });
    }
});

module.exports = router;
