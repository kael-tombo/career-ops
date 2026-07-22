import http from 'http';
import fs from 'fs';
import { join, extname } from 'path';
import { execSync, exec } from 'child_process';
import yaml from 'js-yaml';
import { JobQueue } from './lib/queue.mjs';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = process.cwd();
const DASHBOARD_DIR = join(ROOT, 'dashboard/web/dist');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

/**
 * Parses applications.md into JSON
 */
function getApplications() {
    const file = join(ROOT, 'data/applications.md');
    if (!fs.existsSync(file)) return [];
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n').slice(4).filter(l => l.trim().startsWith('|'));
    return lines.map(l => {
        const cols = l.split('|').map(c => c.trim());
        let url = '';
        const reportMatch = cols[8]?.match(/\(([^)]+)\)/);
        if (reportMatch) {
            const reportPath = join(ROOT, reportMatch[1]);
            try {
                const reportContent = fs.readFileSync(reportPath, 'utf-8');
                const urlMatch = reportContent.match(/\*\*URL:\*\* (.+)/);
                if (urlMatch) url = urlMatch[1].trim();
            } catch {}
        }
        return {
            id: cols[1],
            date: cols[2],
            company: cols[3],
            role: cols[4],
            score: cols[5],
            status: cols[6],
            pdf: cols[7],
            report: cols[8],
            notes: cols[9],
            url
        };
    });
}

/**
 * Updates an application status in applications.md
 */
function updateApplication(id, newStatus, newNotes) {
    const file = join(ROOT, 'data/applications.md');
    if (!fs.existsSync(file)) return false;
    let content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    const index = lines.findIndex(l => {
        const cols = l.split('|').map(c => c.trim());
        return cols[1] === id;
    });

    if (index === -1) return false;

    const cols = lines[index].split('|');
    if (newStatus) cols[6] = ` ${newStatus} `;
    if (newNotes) cols[9] = ` ${newNotes} `;
    
    lines[index] = cols.join('|');
    fs.writeFileSync(file, lines.join('\n'));
    return true;
}

/**
 * Parses pipeline.md into JSON (extracts tables)
 */
function getPipeline() {
    const file = join(ROOT, 'data/pipeline.md');
    if (!fs.existsSync(file)) return { content: '', items: [] };
    const content = fs.readFileSync(file, 'utf-8');
    
    // Parse table format: | # | Company | Role | PDF | Score | Action |
    const lines = content.split('\n');
    const items = [];
    const extractUrl = (text) => {
        const m = text.match(/\(([^)]+)\)/);
        return m ? m[1] : text;
    };
    lines.forEach(line => {
        if (line.startsWith('|') && !line.includes('---') && !line.includes('| # |')) {
            const cols = line.split('|').map(c => c.trim()).filter(Boolean);
            if (cols.length >= 4) {
                const hasAction = cols.length >= 6;
                items.push({
                    id: cols[0],
                    company: cols[1].replace(/\*\*/g, ''),
                    role: cols[2],
                    url: hasAction ? extractUrl(cols[5]) : (cols.length >= 5 ? cols[4] : ''),
                    pdf: hasAction ? cols[3] : '',
                    score: cols.length >= 5 ? (hasAction ? cols[4] : cols[3]) : '-',
                    action: hasAction ? cols[5] : '',
                    tag: null
                });
            }
        }
        // Parse checklist format: - [ ] url | Company | Title [TAG] → ...
        else {
            const cm = line.match(/^- \[ \] (.+?) \| (.+?) \| (.+)$/);
            if (cm) {
                const rawTitle = cm[3].trim();
                const tm = rawTitle.match(/\[([A-Z-]+)\]/);
                items.push({
                    id: cm[1].trim(),
                    company: cm[2].trim(),
                    role: rawTitle.replace(/→.*$/, '').trim(),
                    url: cm[1].trim(),
                    pdf: '',
                    score: '-',
                    action: '',
                    tag: tm ? tm[1] : null
                });
            }
        }
    });

    return { content, items };
}

function serveStatic(res, filePath) {
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    try {
        const content = fs.readFileSync(filePath);
        res.setHeader('Content-Type', contentType);
        res.end(content);
    } catch {
        return false;
    }
    return true;
}

const queue = new JobQueue({ maxConcurrency: 2 });

const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    try {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const path = url.pathname;

        // Serve dashboard static files for non-API routes
        if (!path.startsWith('/api/')) {
            let filePath;
            if (path === '/') {
                filePath = join(DASHBOARD_DIR, 'index.html');
            } else {
                filePath = join(DASHBOARD_DIR, path);
            }
            if (serveStatic(res, filePath)) return;
            // SPA fallback — serve index.html for unrecognized paths
            if (serveStatic(res, join(DASHBOARD_DIR, 'index.html'))) return;
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        if (path === '/api/applications') {
            if (req.method === 'GET') {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(getApplications()));
            }
        } else if (path.startsWith('/api/applications/')) {
            if (req.method === 'PUT') {
                const id = path.split('/').pop();
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', () => {
                    const params = JSON.parse(body);
                    const success = updateApplication(id, params.status, params.notes);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success }));
                });
                return;
            }
        } else if (path === '/api/pipeline') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(getPipeline()));
        } else if (path === '/api/profile') {
            const profilePath = join(ROOT, 'config/profile.yml');
            if (fs.existsSync(profilePath)) {
                const doc = yaml.load(fs.readFileSync(profilePath, 'utf-8'));
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(doc));
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Profile not found' }));
            }
        } else if (path === '/api/interview-prep') {
            const dir = join(ROOT, 'interview-prep');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir);
            const files = fs.readdirSync(dir)
                .filter(f => f.endsWith('.md') && f !== 'story-bank.md')
                .map(f => ({ name: f, stats: fs.statSync(join(dir, f)) }));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(files));
        } else if (path.startsWith('/api/interview-prep/')) {
            const filename = decodeURIComponent(req.url.split('/').pop());
            const filePath = join(ROOT, 'interview-prep', filename);
            if (fs.existsSync(filePath)) {
                res.setHeader('Content-Type', 'text/markdown');
                res.end(fs.readFileSync(filePath, 'utf-8'));
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Prep file not found' }));
            }
        } else if (path === '/api/story-bank') {
            const filePath = join(ROOT, 'interview-prep/story-bank.md');
            if (fs.existsSync(filePath)) {
                res.setHeader('Content-Type', 'text/markdown');
                res.end(fs.readFileSync(filePath, 'utf-8'));
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Story bank not found' }));
            }
        } else if (path.startsWith('/api/tailor/')) {
            const id = path.split('/').pop();
            console.log(`⚡ Tailoring assets for [${id}]...`);
            try {
                // Return a stream or just execute and wait
                execSync(`node tailor-assets.mjs ${id}`, { stdio: 'inherit' });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, message: 'Assets generated in /output' }));
            } catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message }));
            }
        } else if (path.startsWith('/api/prep-form/')) {
            const id = path.split('/').pop();
            console.log(`🤖 Starting Autonomous Form Prep for [${id}]...`);
            try {
                // Execute in background (don't wait for completion as it keeps browser open)
                const child = exec(`node prep-form.mjs ${id}`, (error, stdout, stderr) => {
                    if (error) console.error(`❌ Prep Error [${id}]:`, error.message);
                });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, message: 'Agent launched. Check your desktop.' }));
            } catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message }));
            }
        } else if (path === '/api/diagnostics') {
            const checks = {
                env: process.env.ANTHROPIC_API_KEY ? 'OK' : 'MISSING_KEY',
                cv: fs.existsSync(join(ROOT, 'cv.md')),
                profile: fs.existsSync(join(ROOT, 'config/profile.yml')),
                node_modules: fs.existsSync(join(ROOT, 'node_modules')),
                portals: fs.existsSync(join(ROOT, 'portals.yml')),
                queue: queue.getStatus()
            };
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(checks));
        } else if (path === '/api/reports') {
            res.setHeader('Content-Type', 'application/json');
            const reports = fs.readdirSync(join(ROOT, 'reports'))
                .filter(f => f.endsWith('.md'))
                .map(f => ({ name: f }));
            res.end(JSON.stringify(reports));
        } else if (path.startsWith('/api/reports/')) {
            const filename = decodeURIComponent(path.split('/').pop());
            const filePath = join(ROOT, 'reports', filename);
            if (fs.existsSync(filePath)) {
                res.setHeader('Content-Type', 'text/markdown');
                res.end(fs.readFileSync(filePath, 'utf-8'));
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Report not found' }));
            }
        } else if (path.startsWith('/api/pdf/')) {
            const filename = decodeURIComponent(path.split('/').pop());
            const filePath = join(ROOT, 'output', filename);
            if (fs.existsSync(filePath)) {
                res.setHeader('Content-Type', 'application/pdf');
                res.end(fs.readFileSync(filePath));
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'PDF not found' }));
            }
        } else if (path === '/api/evaluate' && req.method === 'POST') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, message: 'Evaluation logic coming soon' }));
        } else if (path === '/api/jobs' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const { type, payload } = JSON.parse(body);
                    const jobId = queue.addJob(type, payload || {});
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ jobId }));
                } catch (e) {
                    res.writeHead(400);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
        } else if (path === '/api/jobs' && req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                history: queue.getHistory(),
                active: queue.getActiveJobs()
            }));
        } else if (path.startsWith('/api/jobs/') && req.method === 'GET') {
            const jobId = path.split('/').pop();
            const job = queue.getJobStatus(jobId);
            if (job) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(job));
            } else {
                res.writeHead(404);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Job not found' }));
            }
        } else if (path === '/api/scan' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const params = body ? JSON.parse(body) : {};
                    const jobId = queue.addJob('scan', { region: params.region || '' });
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ jobId }));
                } catch (e) {
                    res.writeHead(400);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
        } else if (path === '/api/tailor' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const params = JSON.parse(body);
                    const jobId = queue.addJob('tailor', { id: params.id });
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ jobId }));
                } catch (e) {
                    res.writeHead(400);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
        } else if (path === '/api/prep-form' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const params = JSON.parse(body);
                    const jobId = queue.addJob('prep-form', { id: params.id });
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ jobId }));
                } catch (e) {
                    res.writeHead(400);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
        } else if (path === '/api/liveness' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const params = JSON.parse(body);
                    const jobId = queue.addJob('liveness-check', { urls: params.urls || [] });
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ jobId }));
                } catch (e) {
                    res.writeHead(400);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: e.message }));
                }
            });
        } else if (path === '/api/events' && req.method === 'GET') {
            queue.subscribe(req, res);
        } else if (path === '/api/scan-history' && req.method === 'GET') {
            const historyPath = join(ROOT, 'data/scan-history.tsv');
            if (fs.existsSync(historyPath)) {
                const content = fs.readFileSync(historyPath, 'utf-8');
                const lines = content.split('\n').filter(l => l.trim());
                const rows = lines.map(line => {
                    const cols = line.split('\t');
                    return { url: cols[0], date: cols[1], portal: cols[2], title: cols[3], company: cols[4], status: cols[5] };
                });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(rows));
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify([]));
            }
        } else {
            res.writeHead(404);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Not Found' }));
        }
    } catch (err) {
        console.error(err);
        res.writeHead(500);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message }));
    }
});

server.listen(PORT, HOST, () => {
    console.log(`🚀 Career-Ops Elite Server (v2.0) running on port ${PORT}`);
});
