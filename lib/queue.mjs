import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { join } from 'path';

const ROOT = process.cwd();

export class JobQueue {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 2;
    this._queue = [];
    this._active = new Set();
    this._history = new Map();
    this._listeners = new Set();
    this._jobTimeout = options.jobTimeout || 30000;

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
      evaluate: async () => {
        return { message: 'Evaluation coming soon', exitCode: 0 };
      }
    };
  }

  /**
   * Spawn a child process with timeout and kill on timeout.
   * Returns { stdout, stderr, exitCode }
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
        reject(new Error(`Job timed out after ${this._jobTimeout}ms`));
      }, this._jobTimeout);

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
    const job = {
      id: jobId,
      type,
      payload,
      state: 'queued',
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    this._queue.push(job);
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

    // Send initial connected event
    res.write('event: connected\ndata: {}\n\n');

    const listener = (event, data) => {
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        // Client disconnected — remove listener
        this._listeners.delete(listener);
      }
    };
    this._listeners.add(listener);

    // Heartbeat every 15s
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
   * Emit an event to all SSE listeners.
   */
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
   * Process the next job in the queue.
   */
  async _processNext() {
    if (this._active.size >= this.maxConcurrency) return;
    if (this._queue.length === 0) return;

    const job = this._queue.shift();
    job.state = 'running';
    this._active.add(job.id);
    this._emit('job:running', { jobId: job.id, type: job.type, payload: job.payload });

    try {
      const handler = this._handlers[job.type];
      if (!handler) throw new Error(`No handler for job type: ${job.type}`);

      const result = await handler(job.payload);
      job.state = 'completed';
      job.result = result;
      job.completedAt = new Date().toISOString();
      this._history.set(job.id, job);
      this._active.delete(job.id);
      this._emit('job:completed', {
        jobId: job.id,
        type: job.type,
        payload: job.payload,
        result
      });
    } catch (err) {
      job.state = 'failed';
      job.error = err.message;
      job.completedAt = new Date().toISOString();
      this._history.set(job.id, job);
      this._active.delete(job.id);
      this._emit('job:failed', {
        jobId: job.id,
        type: job.type,
        payload: job.payload,
        error: err.message
      });
    }

    // Process next job in queue
    this._processNext();
  }

  /**
   * Get status of a specific job.
   */
  getJobStatus(jobId) {
    // Check active jobs
    for (const job of this._active) {
      if (job.id === jobId) return job;
    }
    // Check queue
    const queued = this._queue.find(j => j.id === jobId);
    if (queued) return queued;
    // Check history
    return this._history.get(jobId) || null;
  }

  /**
   * Get all recent history (completed/failed jobs).
   */
  getHistory() {
    return Array.from(this._history.values()).slice(-50);
  }

  /**
   * Get all active (running) jobs.
   */
  getActiveJobs() {
    return Array.from(this._active);
  }

  /**
   * Get queue status summary.
   */
  getStatus() {
    return {
      active: this._active.size,
      queued: this._queue.length,
      completed: this._history.size,
      maxConcurrency: this.maxConcurrency
    };
  }
}
