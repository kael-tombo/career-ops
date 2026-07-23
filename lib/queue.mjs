/**
 * lib/queue.mjs — SQLite-backed persistent job queue for Career-OPS v3.0
 *
 * Features:
 *  - Persistent across restarts (SQLite storage)
 *  - Retry with exponential backoff (max 3 attempts)
 *  - Dead-letter handling for permanently failed jobs
 *  - SSE event emission (backward compatible)
 *  - Configurable concurrency
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getDb, run, getAll, getOne } from './db/index.mjs';

export class JobQueue {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 2;
    this._active = new Map(); // jobId → { promise, type }
    this._listeners = new Set();
    this._jobTimeout = options.jobTimeout || 60000;
    this._retryDelays = [1000, 5000, 15000]; // exponential backoff

    this._handlers = {
      scan: async (payload) => {
        const args = ['scan-portals.mjs'];
        if (payload.region) args.push('--region', payload.region);
        return this._spawnWithTimeout('node', args, this._jobTimeout);
      },
      tailor: async (payload) => {
        if (!payload.id) throw new Error('tailor requires payload.id');
        return this._spawnWithTimeout('node', ['tailor-assets.mjs', payload.id], this._jobTimeout);
      },
      'prep-form': async (payload) => {
        if (!payload.id) throw new Error('prep-form requires payload.id');
        return this._spawnWithTimeout('node', ['prep-form.mjs', payload.id], this._jobTimeout);
      },
      'liveness-check': async (payload) => {
        if (!payload.urls || !Array.isArray(payload.urls) || payload.urls.length === 0) {
          throw new Error('liveness-check requires payload.urls (non-empty array)');
        }
        return this._spawnWithTimeout('node', ['check-liveness.mjs', ...payload.urls], this._jobTimeout);
      },
      evaluate: async (payload) => {
        if (!payload.url) throw new Error('evaluate requires payload.url');
        const { tryFetch } = await import('./lib/fetch-jd.mjs');
        const jd = await tryFetch(payload.url);
        const jdDir = join(process.cwd(), 'jds');
        if (!existsSync(jdDir)) mkdirSync(jdDir, { recursive: true });
        const slug = payload.url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').slice(0, 80);
        const jdPath = join(jdDir, `${slug}.md`);
        writeFileSync(jdPath, `# JD: ${payload.url}\n\n${jd || 'Could not fetch JD content'}`);
        return { message: 'JD saved', jdPath, exitCode: 0 };
      },
      'mass-scan': async () => {
        const { runMassScan } = await import('./lib/discovery/mass-scan.mjs');
        const result = await runMassScan({ maxJobs: 200 });
        return { applied: 0, ...result, exitCode: 0 };
      },
      'global-sweep': async (payload) => {
        const { GlobalOrchestrator } = await import('./lib/global/global-orchestrator.mjs');
        const { getCountryCodes } = await import('./lib/global/search-engines.mjs');
        const orch = new GlobalOrchestrator({
          queries: payload.queries || ['software engineer', 'product manager', 'data scientist'],
          countryCodes: payload.countries || getCountryCodes(),
          maxTotal: payload.maxTotal || 5000,
          maxPerSource: 50,
          concurrency: payload.concurrency || 3,
          rpm: payload.rpm || 30,
        });
        try {
          const { jobs, stats } = await orch.runFullSweep();
          return { jobsFound: jobs.length, countriesCovered: stats.countriesCovered, stats, exitCode: 0 };
        } finally {
          await orch.close();
        }
      },
      'mass-apply': async (payload) => {
        const { runMassApply } = await import('./lib/auto-apply/mass-apply.mjs');
        const minScore = payload.minScore || 3.5;
        const dailyLimit = payload.dailyLimit || 10;
        const dryRun = payload.dryRun !== false;

        // Load pipeline + tracker to determine eligible jobs
        const { readFileSync, existsSync } = await import('fs');
        const { join } = await import('path');
        const cwd = process.cwd();
        const pipelinePath = join(cwd, 'data/pipeline.md');
        const trackerPath = join(cwd, 'data/applications.md');

        const pipelineJobs = [];
        if (existsSync(pipelinePath)) {
          const content = readFileSync(pipelinePath, 'utf-8');
          for (const line of content.split('\n')) {
            const match = line.match(/^\s*-\s*\[\s*[ x]?\s*\]\s*(\S+)\s*\|\s*([^|]+)\s*\|\s*(.+)$/);
            if (match) pipelineJobs.push({ url: match[1].trim(), company: match[2].trim(), role: match[3].trim().replace(/\s*\[[A-Z-]+\]$/, '').trim() });
          }
        }

        const eligible = pipelineJobs.slice(0, dailyLimit);
        if (eligible.length === 0) return { applied: 0, skipped: 0, failed: 0, message: 'No eligible jobs', exitCode: 0 };

        return runMassApply(eligible, { dryRun, dailyLimit, minScore });
      }
    };

    // Recover any jobs that were "running" when the process died
    this._recoverStaleJobs();

    // Start recurring scan scheduler
    this._scheduleInterval = null;
    this._scheduleConfig = null;
    this._startScheduler();
  }

  /**
   * Recover jobs stuck in 'running' state from a previous crash.
   */
  _recoverStaleJobs() {
    try {
      const stale = getAll("SELECT * FROM job_queue WHERE state = 'running'");
      for (const job of stale) {
        // Re-queue if under max attempts, otherwise mark as failed
        if (job.attempts < job.max_attempts) {
          run("UPDATE job_queue SET state = 'queued', started_at = NULL WHERE id = ?", [job.id]);
          console.log(`♻️  Recovered stale job ${job.id} (${job.type}) — re-queued`);
        } else {
          run("UPDATE job_queue SET state = 'dead', error = 'Process died during execution', completed_at = datetime('now') WHERE id = ?", [job.id]);
          console.log(`💀 Job ${job.id} (${job.type}) exceeded max attempts — moved to dead letter`);
        }
      }
    } catch {
      // Database may not be initialized yet during first run
    }
  }

  /**
   * Spawn a child process with timeout.
   */
  _spawnWithTimeout(command, args, timeout) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32'
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Job timed out after ${timeout}ms`));
      }, timeout);

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Submit a new job to the queue.
   * @param {string} type - Job type
   * @param {object} payload - Job payload
   * @returns {string} jobId
   */
  addJob(type, payload = {}) {
    const jobId = randomUUID().slice(0, 8);

    run(`
      INSERT INTO job_queue (id, type, payload, state, attempts, max_attempts)
      VALUES (?, ?, ?, 'queued', 0, 3)
    `, [jobId, type, JSON.stringify(payload)]);

    this._emit('job:queued', { jobId, type, payload });
    this._processNext();
    return jobId;
  }

  /**
   * Subscribe an SSE response stream to job events.
   */
  subscribe(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write('event: connected\ndata: {}\n\n');

    const listener = (event, data) => {
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        this._listeners.delete(listener);
      }
    };
    this._listeners.add(listener);

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        this._listeners.delete(listener);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      this._listeners.delete(listener);
    });
  }

  /**
   * Subscribe using Fastify reply (raw stream access).
   */
  subscribeFastify(request, reply) {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    reply.raw.write('event: connected\ndata: {}\n\n');

    const listener = (event, data) => {
      try {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        this._listeners.delete(listener);
      }
    };
    this._listeners.add(listener);

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        this._listeners.delete(listener);
      }
    }, 15000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      this._listeners.delete(listener);
    });
  }

  _emit(event, data) {
    for (const listener of this._listeners) {
      try {
        listener(event, data);
      } catch {
        this._listeners.delete(listener);
      }
    }
  }

  /**
   * Process the next queued job.
   */
  async _processNext() {
    if (this._active.size >= this.maxConcurrency) return;

    const job = getOne("SELECT * FROM job_queue WHERE state = 'queued' ORDER BY created_at ASC LIMIT 1");
    if (!job) return;

    // Mark as running
    run("UPDATE job_queue SET state = 'running', started_at = datetime('now'), attempts = attempts + 1 WHERE id = ?", [job.id]);
    this._active.set(job.id, { type: job.type });

    const payload = JSON.parse(job.payload || '{}');
    this._emit('job:running', { jobId: job.id, type: job.type, payload });

    try {
      const handler = this._handlers[job.type];
      if (!handler) throw new Error(`No handler for job type: ${job.type}`);

      const result = await handler(payload);

      run(`
        UPDATE job_queue SET state = 'completed', result = ?, completed_at = datetime('now')
        WHERE id = ?
      `, [JSON.stringify(result), job.id]);

      this._active.delete(job.id);
      this._emit('job:completed', { jobId: job.id, type: job.type, payload, result });

    } catch (err) {
      this._active.delete(job.id);
      const currentAttempts = (job.attempts || 0) + 1;

      if (currentAttempts < (job.max_attempts || 3)) {
        // Retry with backoff
        const delay = this._retryDelays[currentAttempts - 1] || 15000;
        run("UPDATE job_queue SET state = 'queued', error = ? WHERE id = ?", [err.message, job.id]);
        this._emit('job:retry', { jobId: job.id, type: job.type, attempt: currentAttempts, error: err.message });
        setTimeout(() => this._processNext(), delay);
      } else {
        // Dead letter
        run(`
          UPDATE job_queue SET state = 'dead', error = ?, completed_at = datetime('now')
          WHERE id = ?
        `, [err.message, job.id]);
        this._emit('job:failed', { jobId: job.id, type: job.type, payload, error: err.message });
      }
    }

    // Process next job in queue
    this._processNext();
  }

  /**
   * Get status of a specific job.
   */
  getJobStatus(jobId) {
    const job = getOne('SELECT * FROM job_queue WHERE id = ?', [jobId]);
    if (!job) return null;
    return {
      ...job,
      payload: JSON.parse(job.payload || '{}'),
      result: job.result ? JSON.parse(job.result) : null,
    };
  }

  /**
   * Get recent job history (completed + failed + dead).
   */
  getHistory() {
    return getAll(`
      SELECT * FROM job_queue
      WHERE state IN ('completed', 'dead')
      ORDER BY completed_at DESC
      LIMIT 50
    `).map(j => ({
      ...j,
      payload: JSON.parse(j.payload || '{}'),
      result: j.result ? JSON.parse(j.result) : null,
    }));
  }

  /**
   * Get all active (running) job IDs.
   */
  getActiveJobs() {
    return Array.from(this._active.keys());
  }

  /**
   * Get queue status summary.
   */
  getStatus() {
    const queued = getOne("SELECT COUNT(*) as c FROM job_queue WHERE state = 'queued'")?.c || 0;
    const running = this._active.size;
    const completed = getOne("SELECT COUNT(*) as c FROM job_queue WHERE state = 'completed'")?.c || 0;
    const dead = getOne("SELECT COUNT(*) as c FROM job_queue WHERE state = 'dead'")?.c || 0;

    return {
      queued,
      active: running,
      completed,
      dead,
      maxConcurrency: this.maxConcurrency,
    };
  }

  /**
   * Configure recurring scan schedule.
   * @param {object} config - { intervalMs, type: 'scan'|'global-sweep', payload, label }
   */
  setSchedule(config) {
    if (this._scheduleInterval) {
      clearInterval(this._scheduleInterval);
      this._scheduleInterval = null;
    }
    if (!config || !config.intervalMs) {
      this._scheduleConfig = null;
      return;
    }
    this._scheduleConfig = { type: 'scan', payload: {}, ...config };
    this._startScheduler();
  }

  /**
   * Start the recurring scheduler based on current config.
   */
  _startScheduler() {
    if (this._scheduleInterval) return;
    if (!this._scheduleConfig) return;

    const { intervalMs, type, payload } = this._scheduleConfig;
    console.log(`⏰ Scan scheduler: every ${(intervalMs / 1000 / 60).toFixed(0)}min (${type})`);

    // Run first scan after a short initial delay
    const initialDelay = Math.min(intervalMs, 30000);
    setTimeout(() => {
      if (this._scheduleConfig) {
        this.addJob(type, payload);
      }
    }, initialDelay);

    this._scheduleInterval = setInterval(() => {
      if (this._scheduleConfig) {
        this.addJob(type, payload);
      }
    }, intervalMs);
  }

  /**
   * Get current schedule status.
   */
  getSchedule() {
    if (!this._scheduleConfig) return null;
    return {
      type: this._scheduleConfig.type,
      intervalMs: this._scheduleConfig.intervalMs,
      intervalMinutes: Math.round(this._scheduleConfig.intervalMs / 60000),
      running: this._scheduleInterval !== null,
    };
  }
}
