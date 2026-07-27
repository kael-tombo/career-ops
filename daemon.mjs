#!/usr/bin/env node

/**
 * daemon.mjs — Career-OPS 24/7 Autonomous Daemon
 *
 * Runs continuously in the background:
 *  - Schedules scan→eval→apply pipeline runs
 *  - Manages worker pool for concurrent job processing
 *  - Exposes SSE endpoint for real-time dashboard updates
 *  - Self-healing with crash recovery and health checks
 *
 * Usage:
 *   node daemon.mjs                    # Interactive mode (foreground)
 *   node daemon.mjs --daemon           # Daemon mode (background)
 *   node daemon.mjs --run-once         # Single pipeline run, then exit
 *   node daemon.mjs --status           # Check daemon status
 *   node daemon.mjs --stop             # Stop running daemon
 */

import { existsSync, appendFileSync, writeFileSync, readFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

const PID_PATH = join(ROOT, 'data', 'daemon.pid');
const STATE_PATH = join(ROOT, 'data', 'daemon-state.json');
const LOG_PATH = join(ROOT, 'data', 'daemon.log');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const DAEMON_DEFAULTS = {
  scanInterval: parseInt(process.env.SCAN_INTERVAL || '180') * 1000,
  evalInterval: parseInt(process.env.EVAL_INTERVAL || '300') * 1000,
  applyInterval: parseInt(process.env.APPLY_INTERVAL || '600') * 1000,
  fullPipelineInterval: parseInt(process.env.PIPELINE_INTERVAL || '3600') * 1000,
  webPort: parseInt(process.env.DAEMON_PORT || '4173'),
  maxApplyPerRun: parseInt(process.env.MAX_APPLY_PER_RUN || '10'),
  workers: parseInt(process.env.PIPELINE_WORKERS || '3'),
  minScore: parseFloat(process.env.MIN_SCORE || '3.5'),
  dryRun: process.env.SAFE_MODE !== 'false',
};

let running = false;
let pulseInterval = null;
let pipelineInterval = null;
let scanInterval = null;
let applyInterval = null;
const eventClients = new Set();
const pipelineModule = null;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    const dir = join(ROOT, 'data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendToFile(LOG_PATH, line + '\n');
  } catch { /* ignore */ }
}

function appendToFile(path, content) {
  try {
    appendFileSync(path, content);
  } catch { /* ignore */ }
}

function saveState(state) {
  try {
    const dir = join(ROOT, 'data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(STATE_PATH, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2));
  } catch { /* ignore */ }
}

function loadState() {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { runs: 0, totalJobsScanned: 0, totalApplied: 0, startedAt: null };
}

function loadCvInfo() {
  const cvPath = join(ROOT, 'cv.md');
  if (!existsSync(cvPath)) return null;
  try {
    const content = readFileSync(cvPath, 'utf-8');
    const nameMatch = content.match(/^#\s+(.+)/m);
    const titleMatch = content.match(/\*\*(.+?)\*\*/);
    return {
      name: nameMatch ? nameMatch[1].trim() : 'Unknown',
      title: titleMatch ? titleMatch[1].trim() : '',
      cvExists: true,
    };
  } catch {
    return { cvExists: true, name: 'Unknown' };
  }
}

function emitEvent(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of eventClients) {
    try {
      client.write(msg);
    } catch {
      eventClients.delete(client);
    }
  }
}

function handleSSE(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });

  res.write('event: connected\ndata: {"status":"ok","daemon":"career-ops"}\n\n');
  res.write(`event: status\ndata: ${JSON.stringify(getStatus())}\n\n`);

  eventClients.add(res);
  log(`SSE client connected (${eventClients.size} total)`);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      eventClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventClients.delete(res);
    log(`SSE client disconnected (${eventClients.size} remaining)`);
  });
}

function handleStatusAPI(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(getStatus(), null, 2));
}

function handlePipelineAPI(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ message: 'Pipeline triggered', timestamp: new Date().toISOString() }));
  setImmediate(() => runPipeline());
}

function handleConfigAPI(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(DAEMON_DEFAULTS, null, 2));
}

function getStatus() {
  const state = loadState();
  const cv = loadCvInfo();
  return {
    daemon: 'career-ops',
    version: '3.0.0',
    running,
    pid: process.pid,
    uptime: running ? Math.floor((Date.now() - new Date(state.startedAt || Date.now()).getTime()) / 1000) : 0,
    state,
    cv,
    config: DAEMON_DEFAULTS,
    eventClients: eventClients.size,
    intervals: {
      pipeline: pipelineInterval !== null,
      scan: scanInterval !== null,
      apply: applyInterval !== null,
      pulse: pulseInterval !== null,
    },
  };
}

function sendEvent(event, data) {
  emitEvent(event, data);
}

async function loadPipelineModule() {
  try {
    const mod = await import('./lib/autonomous/pipeline.mjs');
    mod.setEventEmitter(sendEvent);
    return mod;
  } catch (err) {
    log(`Failed to load pipeline module: ${err.message}`);
    return null;
  }
}

async function runPipeline() {
  const pipe = await loadPipelineModule();
  if (!pipe) {
    log('Pipeline module unavailable — skipping run');
    return;
  }

  log('Starting pipeline run...');
  emitEvent('pipeline:start', { timestamp: new Date().toISOString() });
  saveState({ ...loadState(), lastRun: new Date().toISOString(), status: 'running' });

  // Load multi-resume search configs if enabled
  let resumeSearchConfigs = undefined;
  try {
    const profilePath = join(ROOT, 'config/profile.yml');
    if (existsSync(profilePath)) {
      const profile = yaml.load(readFileSync(profilePath, 'utf-8'));
      if (profile.multi_resume?.enabled !== false) {
        const { getResumeSearchWithCountries, loadAllResumes } = await import('./lib/resume-manager.mjs');
        resumeSearchConfigs = getResumeSearchWithCountries();
        const resumes = loadAllResumes();
        if (resumes.length > 0) {
          log(`   Multi-resume: ${resumes.length} resume types loaded`);
          resumes.forEach(r => log(`   - ${r.label} (${r.fit}, ${r.searchQueries.length} queries)`));
        }
      }
    }
  } catch (err) {
    log(`   Multi-resume init skipped: ${err.message}`);
  }

  try {
    const result = await pipe.runFullPipeline({
      minScore: DAEMON_DEFAULTS.minScore,
      maxApply: DAEMON_DEFAULTS.maxApplyPerRun,
      workers: DAEMON_DEFAULTS.workers,
      dryRun: DAEMON_DEFAULTS.dryRun,
      autoTailor: true,
      autoApply: !DAEMON_DEFAULTS.dryRun,
      resumeSearchConfigs,
    });

    const state = loadState();
    state.runs = (state.runs || 0) + 1;
    state.totalJobsScanned = (state.totalJobsScanned || 0) + (result.newJobs || 0);
    state.totalApplied = (state.totalApplied || 0) + (result.applied || 0);
    state.lastRun = new Date().toISOString();
    state.lastResult = result;
    state.status = 'idle';
    saveState(state);

    emitEvent('pipeline:complete', { ...result, runCount: state.runs, multiResume: resumeSearchConfigs ? true : false });

    log(`Pipeline complete: ${result.newJobs || 0} scanned, ${result.applied || 0} applied (run #${state.runs})`);
  } catch (err) {
    log(`Pipeline error: ${err.message}`);
    emitEvent('pipeline:error', { error: err.message, timestamp: new Date().toISOString() });
    saveState({ ...loadState(), status: 'error', lastError: err.message });
  }
}

async function runScanOnly() {
  const pipe = await loadPipelineModule();
  if (!pipe) return;
  log('Running scan stage...');
  try {
    const result = await pipe.stageScan();
    const state = loadState();
    state.totalJobsScanned = (state.totalJobsScanned || 0) + (result.totalNew || 0);
    saveState(state);
    emitEvent('scan:complete', result);
    log(`Scan complete: ${result.totalNew || 0} new jobs`);
  } catch (err) {
    log(`Scan error: ${err.message}`);
  }
}

async function runApplyOnly() {
  const pipe = await loadPipelineModule();
  if (!pipe) return;
  log('Running apply stage...');
  try {
    const result = await pipe.stageApply({
      minScore: DAEMON_DEFAULTS.minScore,
      maxApply: DAEMON_DEFAULTS.maxApplyPerRun,
      dryRun: DAEMON_DEFAULTS.dryRun,
      autoTailor: true,
      autoApply: !DAEMON_DEFAULTS.dryRun,
    });
    const state = loadState();
    state.totalApplied = (state.totalApplied || 0) + (result.applied || 0);
    saveState(state);
    emitEvent('apply:complete', result);
    log(`Apply complete: ${result.applied || 0} applied`);
  } catch (err) {
    log(`Apply error: ${err.message}`);
  }
}

function startIntervals() {
  log('Starting scheduler intervals...');

  if (DAEMON_DEFAULTS.fullPipelineInterval > 0) {
    log(`  Pipeline: every ${Math.round(DAEMON_DEFAULTS.fullPipelineInterval / 60000)}min`);
    setTimeout(() => runPipeline(), 10000);
    pipelineInterval = setInterval(() => runPipeline(), DAEMON_DEFAULTS.fullPipelineInterval);
  }

  if (DAEMON_DEFAULTS.scanInterval > 0 && DAEMON_DEFAULTS.fullPipelineInterval <= 0) {
    log(`  Scan: every ${Math.round(DAEMON_DEFAULTS.scanInterval / 60000)}min`);
    scanInterval = setInterval(() => runScanOnly(), DAEMON_DEFAULTS.scanInterval);
  }

  if (DAEMON_DEFAULTS.applyInterval > 0 && DAEMON_DEFAULTS.fullPipelineInterval <= 0) {
    log(`  Apply: every ${Math.round(DAEMON_DEFAULTS.applyInterval / 60000)}min`);
    applyInterval = setInterval(() => runApplyOnly(), DAEMON_DEFAULTS.applyInterval);
  }

  pulseInterval = setInterval(() => {
    emitEvent('pulse', { timestamp: new Date().toISOString(), pid: process.pid });
  }, 30000);
}

function stopIntervals() {
  if (pipelineInterval) { clearInterval(pipelineInterval); pipelineInterval = null; }
  if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
  if (applyInterval) { clearInterval(applyInterval); applyInterval = null; }
  if (pulseInterval) { clearInterval(pulseInterval); pulseInterval = null; }
}

function startWebServer() {
  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (path === '/events' || path === '/api/events') {
      handleSSE(req, res);
    } else if (path === '/api/status' || path === '/status') {
      handleStatusAPI(req, res);
    } else if (path === '/api/pipeline' || path === '/pipeline') {
      handlePipelineAPI(req, res);
    } else if (path === '/api/config') {
      handleConfigAPI(req, res);
    } else if (path === '/health' || path === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), pid: process.pid }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    }
  });

  server.listen(DAEMON_DEFAULTS.webPort, () => {
    log(`Daemon web server listening on port ${DAEMON_DEFAULTS.webPort}`);
    log(`  SSE:   http://localhost:${DAEMON_DEFAULTS.webPort}/events`);
    log(`  Status: http://localhost:${DAEMON_DEFAULTS.webPort}/status`);
    log(`  Pipeline: http://localhost:${DAEMON_DEFAULTS.webPort}/pipeline (POST to trigger)`);
  });

  return server;
}

function writePid() {
  try {
    const dir = join(ROOT, 'data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(PID_PATH, String(process.pid));
  } catch { /* ignore */ }
}

function removePid() {
  try { unlinkSync(PID_PATH); } catch { /* ignore */ }
}

function isAlreadyRunning() {
  if (!existsSync(PID_PATH)) return false;
  try {
    const pid = parseInt(readFileSync(PID_PATH, 'utf-8').trim());
    if (!pid) return false;
    if (pid === process.pid) return true;
    try {
      process.kill(pid, 0);
      const now = Date.now();
      const stat = existsSync(PID_PATH) ? readFileSync(PID_PATH, 'utf-8') : '';
      return true;
    } catch {
      return false;
    }
  } catch { return false; }
}

function stopDaemon() {
  if (!existsSync(PID_PATH)) {
    console.log('No daemon PID file found.');
    return;
  }
  try {
    const pid = parseInt(readFileSync(PID_PATH, 'utf-8').trim());
    process.kill(pid, 'SIGTERM');
    console.log(`Sent SIGTERM to daemon (PID ${pid})`);
    setTimeout(() => {
      try { process.kill(pid, 'SIGKILL'); console.log('Force killed'); } catch { console.log('Daemon stopped'); }
    }, 5000);
  } catch (err) {
    console.log(`Could not stop daemon: ${err.message}`);
    removePid();
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--stop')) {
    stopDaemon();
    process.exit(0);
  }

  if (args.includes('--status')) {
    if (isAlreadyRunning()) {
      const pid = readFileSync(PID_PATH, 'utf-8').trim();
      const state = loadState();
      console.log(`Daemon running (PID ${pid})`);
      console.log(`  Runs: ${state.runs || 0}`);
      console.log(`  Jobs scanned: ${state.totalJobsScanned || 0}`);
      console.log(`  Applied: ${state.totalApplied || 0}`);
      console.log(`  Last run: ${state.lastRun || 'N/A'}`);
      console.log(`  Status: ${state.status || 'unknown'}`);
    } else {
      console.log('Daemon not running');
    }
    process.exit(0);
  }

  if (isAlreadyRunning() && !args.includes('--force')) {
    console.warn('⚠️  Stale PID file found — cleaning up');
    removePid();
  }

  writePid();
  running = true;

  const initialState = loadState();
  if (!initialState.startedAt) {
    initialState.startedAt = new Date().toISOString();
  }
  initialState.status = 'running';
  saveState(initialState);

  log('┌──────────────────────────────────────────────────┐');
  log('│  Career-OPS Autonomous Daemon v3.0               │');
  log('│  24/7 AI Job Search Pipeline                     │');
  log('└──────────────────────────────────────────────────┘');
  log(`PID: ${process.pid}`);
  log(`Mode: ${DAEMON_DEFAULTS.dryRun ? 'DRY RUN (review)' : 'LIVE'}`);
  log(`Pipeline interval: ${Math.round(DAEMON_DEFAULTS.fullPipelineInterval / 60000)}min`);

  const cv = loadCvInfo();
  if (cv) {
    log(`CV: ${cv.name}${cv.title ? ` — ${cv.title}` : ''}`);
  } else {
    log('WARNING: No cv.md found');
  }

  startWebServer();
  startIntervals();

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    log(`Uncaught exception: ${err.message}`);
    log(err.stack || '');
  });
  process.on('unhandledRejection', (reason) => {
    log(`Unhandled rejection: ${reason}`);
  });

  if (args.includes('--run-once')) {
    log('--run-once mode: running pipeline then exiting');
    await new Promise(r => setTimeout(r, 3000));
    await runPipeline();
    await shutdown('complete');
  }
}

async function shutdown(signal) {
  if (!running) return;
  running = false;
  log(`\nShutting down (${signal})...`);
  stopIntervals();
  removePid();
  saveState({ ...loadState(), status: 'stopped', stoppedAt: new Date().toISOString() });

  for (const client of eventClients) {
    try {
      client.write(`event: shutdown\ndata: {"signal":"${signal}"}\n\n`);
      client.end();
    } catch { /* ignore */ }
  }
  eventClients.clear();

  log('Daemon stopped');
  process.exit(0);
}

main().catch(err => {
  console.error('Daemon fatal error:', err);
  process.exit(1);
});
