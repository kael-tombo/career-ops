/**
 * lib/server/routes/autonomous.mjs — Autonomous Daemon API Routes
 *
 * Endpoints for querying and controlling the 24/7 autonomous pipeline.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const STATE_PATH = join(ROOT, 'data', 'daemon-state.json');

function loadState() {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return null;
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
    };
  } catch {
    return { name: 'Unknown' };
  }
}

export default async function autonomousRoutes(fastify, { queue }) {
  /**
   * GET /api/autonomous/status — Daemon and pipeline status.
   */
  fastify.get('/api/autonomous/status', async () => {
    const state = loadState();
    const cv = loadCvInfo();
    const schedule = queue ? queue.getSchedule() : null;
    const status = queue ? queue.getStatus() : null;

    return {
      daemon: state ? {
        running: state.status === 'running',
        status: state.status,
        runs: state.runs || 0,
        totalJobsScanned: state.totalJobsScanned || 0,
        totalApplied: state.totalApplied || 0,
        lastRun: state.lastRun || null,
        lastError: state.lastError || null,
        startedAt: state.startedAt || null,
      } : { running: false, status: 'not-started' },
      cv,
      schedule,
      queue: status,
      config: {
        scanInterval: parseInt(process.env.SCAN_INTERVAL || '180'),
        pipelineInterval: parseInt(process.env.PIPELINE_INTERVAL || '3600'),
        minScore: parseFloat(process.env.MIN_SCORE || '3.5'),
        maxApplyPerRun: parseInt(process.env.MAX_APPLY_PER_RUN || '10'),
        dryRun: process.env.SAFE_MODE !== 'false',
        workers: parseInt(process.env.PIPELINE_WORKERS || '3'),
      },
    };
  });

  /**
   * GET /api/autonomous/history — Pipeline run history.
   */
  fastify.get('/api/autonomous/history', async () => {
    const state = loadState();
    if (!state) return { runs: [] };
    return {
      runs: state.runs || 0,
      totalJobsScanned: state.totalJobsScanned || 0,
      totalApplied: state.totalApplied || 0,
      lastRun: state.lastRun || null,
      lastResult: state.lastResult || null,
    };
  });

  /**
   * POST /api/autonomous/pipeline — Trigger a full pipeline run.
   */
  fastify.post('/api/autonomous/pipeline', async (request, reply) => {
    if (queue) {
      const jobId = queue.addJob('pipeline', request.body || {});
      return { triggered: true, jobId };
    }
    // Fallback: spawn directly
    const { spawn } = await import('child_process');
    const child = spawn(process.execPath, ['daemon.mjs', '--run-once'], {
      cwd: ROOT,
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    return { triggered: true, mode: 'spawn' };
  });

  /**
   * POST /api/autonomous/scan — Trigger a scan-only run.
   */
  fastify.post('/api/autonomous/scan', async (request, reply) => {
    if (queue) {
      const jobId = queue.addJob('global-sweep', request.body || {});
      return { triggered: true, jobId };
    }
    return { triggered: false, error: 'Queue not available' };
  });

  /**
   * POST /api/autonomous/apply — Trigger apply stage.
   */
  fastify.post('/api/autonomous/apply', async (request, reply) => {
    if (queue) {
      const jobId = queue.addJob('mass-apply', { dryRun: true, ...request.body });
      return { triggered: true, jobId };
    }
    return { triggered: false, error: 'Queue not available' };
  });

  /**
   * POST /api/autonomous/schedule — Update scan/pipeline schedule.
   */
  fastify.post('/api/autonomous/schedule', async (request, reply) => {
    const { intervalMs, type } = request.body || {};
    if (!intervalMs) {
      return reply.code(400).send({ error: 'intervalMs required' });
    }
    if (queue) {
      queue.setSchedule({ intervalMs, type: type || 'pipeline', payload: {} });
      return { configured: true, intervalMs, type: type || 'pipeline' };
    }
    return { configured: false, error: 'Queue not available' };
  });
}
