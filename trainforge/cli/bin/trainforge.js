#!/usr/bin/env node

const { program } = require('commander');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const open = require('open');
const os = require('os');
const FormData = require('form-data');
const archiver = require('archiver');
const cors = require('cors');

// --- Configuration ---
const CONFIG_DIR = path.join(os.homedir(), '.trainforge');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
// Make sure to use the deployed dashboard URL when in production
const DASHBOARD_URL = process.env.TRAINFORGE_DASHBOARD || 'http://localhost:3001';
const API_URL = process.env.TRAINFORGE_API || 'http://localhost:3000';

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// --- Helpers ---
function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
    return {};
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getAuthToken() {
    const config = loadConfig();
    if (!config.token) {
        console.error('❌ Not authenticated. Please run `trainforge auth login` first.');
        process.exit(1);
    }
    return config.token;
}

// --- Commands ---

program
    .name('trainforge')
    .description('CLI to manage TrainForge distributed machine learning jobs')
    .version('1.0.0');

// ─── AUTHENTICATION ─────────────────────────────────────────────────────────────

const auth = program.command('auth').description('Authentication commands');

auth.command('login')
    .description('Log into TrainForge using Google via the dashboard')
    .action(async () => {
        console.log('🔄 Starting login process...');
        console.log('🌐 Opening browser to authenticate...');

        const port = 8080;
        const app = express();
        app.use(cors());

        // This endpoint will receive the Firebase ID token from the Dashboard
        app.get('/callback', (req, res) => {
            const token = req.query.token;
            if (!token) {
                res.status(400).send('❌ Authentication failed: No token received.');
                console.error('❌ Authentication failed: No token received.');
                process.exit(1);
            }

            // Save token
            const config = loadConfig();
            config.token = token;
            saveConfig(config);

            console.log('\n✅ Successfully logged into TrainForge!');
            res.send('✅ Authentication successful! You can close this window and return to your terminal.');

            // Close the server and exit gracefully
            setTimeout(() => {
                server.close(() => {
                    process.exit(0);
                });
            }, 1000);
        });

        const server = app.listen(port, async () => {
            // Open the dashboard's CLI login route pointing back to our local server
            const loginUrl = `${DASHBOARD_URL}/cli-login?port=${port}`;
            try {
                await open(loginUrl);
            } catch (err) {
                console.error(`❌ Failed to open browser. Please navigate to: ${loginUrl}`);
            }
        });

        // Set a timeout in case the user doesn't log in
        setTimeout(() => {
            console.error('\n⏳ Login timed out after 5 minutes.');
            server.close(() => {
                process.exit(1);
            });
        }, 5 * 60 * 1000);
    });

auth.command('logout')
    .description('Log out and clear stored credentials')
    .action(() => {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = loadConfig();
            delete config.token;
            saveConfig(config);
            console.log('✅ Logged out successfully.');
        } else {
            console.log('Already logged out.');
        }
    });

auth.command('status')
    .description('Check current authentication status')
    .action(async () => {
        const config = loadConfig();
        if (!config.token) {
            console.log('❌ Not logged in.');
            return;
        }

        try {
            // Verify token against the API health or dedicated 'me' endpoint
            // For now, we'll try to fetch jobs with a limit of 1 to verify the token is valid
            const response = await axios.get(`${API_URL}/api/jobs?limit=1`, {
                headers: { Authorization: `Bearer ${config.token}` }
            });
            console.log('✅ Logged in and token is valid.');
        } catch (error) {
            console.error('❌ Token is invalid or expired. Please run `trainforge auth login` again.');
        }
    });

// ─── JOBS ───────────────────────────────────────────────────────────────────────

program.command('submit <script>')
    .description('Submit a Python script as a training job')
    .option('-n, --name <name>', 'Name of the project', 'cli-project')
    .option('-r, --resources <resources>', 'Resources JSON (e.g. {"gpu": 1})', '{"gpu": 1}')
    .option('-w, --workers <count>', 'Number of workers for distributed training (0 for single node)', '0')
    .action(async (scriptPath, options) => {
        const token = getAuthToken();

        if (!fs.existsSync(scriptPath)) {
            console.error(`❌ Script file not found: ${scriptPath}`);
            process.exit(1);
        }

        console.log(`📦 Packaging ${scriptPath}...`);

        // Create a temporary zip file containing the script
        const zipPath = path.join(os.tmpdir(), `trainforge-job-${Date.now()}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', async () => {
            console.log(`📤 Submitting job to TrainForge API...`);

            const formData = new FormData();

            // Build configuration payload
            const config = {
                project: { name: options.name },
                training: { script: path.basename(scriptPath) },
                resources: JSON.parse(options.resources)
            };

            formData.append('config', JSON.stringify(config));
            formData.append('project_zip', fs.createReadStream(zipPath));

            const isDistributed = parseInt(options.workers) > 0;
            if (isDistributed) {
                formData.append('num_workers', options.workers);
            }

            const endpoint = isDistributed ? '/api/jobs/distributed' : '/api/jobs';

            try {
                const response = await axios.post(`${API_URL}${endpoint}`, formData, {
                    headers: {
                        ...formData.getHeaders(),
                        Authorization: `Bearer ${token}`
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });

                console.log('\n✅ Job Submitted Successfully!');
                console.log(`📊 Job ID: ${response.data.job_id}`);
                console.log(`ℹ️  Run \`trainforge status\` to check progress.`);

            } catch (error) {
                console.error('\n❌ Job submission failed:');
                if (error.response) {
                    console.error(error.response.data);
                } else {
                    console.error(error.message);
                }
            } finally {
                // Clean up temp zip
                if (fs.existsSync(zipPath)) {
                    fs.unlinkSync(zipPath);
                }
            }
        });

        archive.on('error', (err) => {
            console.error('❌ Error creating zip archive:', err);
            process.exit(1);
        });

        archive.pipe(output);
        // Add the target script to the zip
        archive.file(scriptPath, { name: path.basename(scriptPath) });
        archive.finalize();
    });

program.command('status')
    .description('List your active jobs')
    .option('-l, --limit <count>', 'Number of jobs to retrieve', '10')
    .action(async (options) => {
        const token = getAuthToken();

        try {
            const response = await axios.get(`${API_URL}/api/jobs?limit=${options.limit}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const jobs = response.data.jobs;

            if (!jobs || jobs.length === 0) {
                console.log('No jobs found.');
                return;
            }

            console.log('\n📋 Your TrainForge Jobs:\n');
            console.log('ID'.padEnd(38) + 'Project Name'.padEnd(20) + 'Status'.padEnd(15) + 'Created At');
            console.log('-'.repeat(95));

            jobs.forEach(job => {
                const name = (job.project_name || 'unknown').substring(0, 18).padEnd(20);
                const status = (job.status || 'unknown').padEnd(15);
                const id = job.job_id.padEnd(38);
                const date = new Date(job.created_at).toLocaleString();
                console.log(`${id}${name}${status}${date}`);
            });
            console.log('');

        } catch (error) {
            console.error('❌ Failed to retrieve jobs:');
            if (error.response) {
                console.error(error.response.data);
            } else {
                console.error(error.message);
            }
        }
    });

program.parse(process.argv);
