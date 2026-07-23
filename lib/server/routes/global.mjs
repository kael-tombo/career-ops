/**
 * lib/server/routes/global.mjs — Global Discovery API endpoints
 *
 * Endpoints:
 *   GET  /api/global/capabilities       — Show orchestrator coverage capabilities
 *   GET  /api/global/countries           — List all countries with search engines + boards
 *   POST /api/global/sweep               — Start a global sweep job (via queue)
 *   GET  /api/global/sweep/:id           — Poll sweep job status
 *   GET  /api/global/coverage            — Current coverage stats from last sweep
 *   GET  /api/global/stats               — Historical sweep statistics
 *   POST /api/global/schedule            — Set recurring scan schedule
 *   GET  /api/global/schedule            — Get current schedule status
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { getCountryCodes, getEnginesForCountry, COUNTRIES } from '../../global/search-engines.mjs';

const ROOT = process.cwd();
const COVERAGE_FILE = join(ROOT, 'output/global-coverage.json');
const STATS_FILE = join(ROOT, 'output/global-stats.json');

export default async function globalRoutes(fastify, { queue }) {
  if (!queue) throw new Error('globalRoutes requires queue option');
  // ─── GET /api/global/capabilities ───
  fastify.get('/api/global/capabilities', async () => {
    const { GlobalOrchestrator } = await import('../../global/global-orchestrator.mjs');
    const orch = new GlobalOrchestrator({});
    const caps = orch.getCapabilities();
    await orch.close();
    return caps;
  });

  // ─── GET /api/global/countries ───
  fastify.get('/api/global/countries', async () => {
    const codes = getCountryCodes();
    const countries = {};

    let boards = {};
    try {
      const boardsPath = join(ROOT, 'config/global/country-boards.yml');
      if (existsSync(boardsPath)) {
        const { parse } = await import('yaml');
        boards = parse(readFileSync(boardsPath, 'utf-8')) || {};
      }
    } catch { /* no boards config */ }

    for (const code of codes) {
      const info = COUNTRIES[code];
      const engines = getEnginesForCountry(code);
      const countryBoards = boards[code]?.boards || [];
      countries[code] = {
        name: info?.name || code,
        tld: info?.tld || 'com',
        lang: info?.lang || 'en',
        engines: engines.map(e => e.name),
        boardCount: countryBoards.length,
        boards: countryBoards.slice(0, 10).map(b => b.name),
      };
    }
    return { total: codes.length, countries };
  });

  // ─── POST /api/global/sweep (via queue) ───
  fastify.post('/api/global/sweep', async (request, reply) => {
    const body = request.body || {};
    const jobId = queue.addJob('global-sweep', {
      queries: body.queries || [],
      countries: body.countries || getCountryCodes(),
      maxTotal: body.maxTotal || 5000,
      concurrency: body.concurrency || 3,
      rpm: body.rpm || 30,
    });
    return { id: jobId, status: 'queued' };
  });

  // ─── GET /api/global/sweep/:id ───
  fastify.get('/api/global/sweep/:id', async (request, reply) => {
    const job = queue.getJobStatus(request.params.id);
    if (!job) return reply.status(404).send({ error: 'Sweep not found' });
    return {
      id: job.id,
      status: job.state,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      jobsFound: job.result?.jobsFound || 0,
      countriesCovered: job.result?.countriesCovered || 0,
      stats: job.result?.stats || null,
      error: job.error,
    };
  });

  // ─── GET /api/global/coverage ───
  fastify.get('/api/global/coverage', async () => {
    if (existsSync(COVERAGE_FILE)) {
      try { return JSON.parse(readFileSync(COVERAGE_FILE, 'utf-8')); } catch { /* fall through */ }
    }
    return [];
  });

  // ─── GET /api/global/stats ───
  fastify.get('/api/global/stats', async () => {
    if (existsSync(STATS_FILE)) {
      try { return JSON.parse(readFileSync(STATS_FILE, 'utf-8')); } catch { /* fall through */ }
    }
    const codes = getCountryCodes();
    return { totalCountries: codes.length, totalSearchEngines: 11, jobsDiscovered: 0, lastSweep: null };
  });

  // ─── POST /api/global/schedule ───
  fastify.post('/api/global/schedule', async (request, reply) => {
    const body = request.body || {};
    if (!body.intervalMinutes || body.intervalMinutes < 5) {
      return reply.status(400).send({ error: 'intervalMinutes must be >= 5' });
    }
    queue.setSchedule({
      intervalMs: body.intervalMinutes * 60 * 1000,
      type: body.type || 'scan',
      payload: body.payload || {},
      label: body.label || `${body.type}-schedule`,
    });
    return { status: 'scheduled', intervalMinutes: body.intervalMinutes, type: body.type || 'scan' };
  });

  // ─── GET /api/global/schedule ───
  fastify.get('/api/global/schedule', async () => {
    return queue.getSchedule() || { status: 'not-scheduled' };
  });
}
