import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { db } from '../db/client.js';
import { scanRuns, jobs } from '../db/schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';
import { requireAuth, requirePlan } from '../middleware/auth.js';
import { addScanJob } from '../queues/queues.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORTALS_YML = join(__dirname, '../../../../portals.yml');

function loadPortalsList() {
  if (!existsSync(PORTALS_YML)) return [];
  try {
    const raw = readFileSync(PORTALS_YML, 'utf-8');
    const parsed = yaml.load(raw);
    const entries = Array.isArray(parsed)
      ? parsed
      : parsed?.portals ?? parsed?.companies ?? Object.values(parsed).flat();
    return (entries || []).map((p) => ({
      name: p.company || p.name || 'Unknown',
      source: p.source || p.ats || 'manual',
      last: '—',
      status: 'active',
    }));
  } catch {
    return [];
  }
}

export async function scanRoutes(app) {
  // GET /api/scan — dashboard summary (last scan stats + new matches + portals)
  app.get('/', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.user.dbId;

    // Last completed scan run
    const [lastRun] = await db.select().from(scanRuns)
      .where(and(eq(scanRuns.userId, userId), eq(scanRuns.status, 'done')))
      .orderBy(desc(scanRuns.startedAt))
      .limit(1);

    // Jobs discovered in the last 24h = "new matches"
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newJobs = await db.select().from(jobs)
      .where(and(eq(jobs.userId, userId), gte(jobs.discoveredAt, since)));

    const portals = loadPortalsList();

    return {
      lastScan: lastRun?.completedAt
        ? new Date(lastRun.completedAt).toLocaleString()
        : 'Never',
      portalsChecked: lastRun?.jobsFound ?? portals.length,
      newMatches: newJobs.length,
      runtimeMs: lastRun?.completedAt && lastRun?.startedAt
        ? new Date(lastRun.completedAt) - new Date(lastRun.startedAt)
        : 0,
      matches: newJobs.map((j) => ({
        company: j.company,
        role: j.role,
        source: j.source || 'manual',
        score: j.score,
        new: true,
      })),
      portals,
    };
  });

  // POST /api/scan/trigger — trigger a portal scan (Pro+)
  app.post('/trigger', { preHandler: [requireAuth, requirePlan('pro')] }, async (request, reply) => {
    const userId = request.user.dbId;

    const [run] = await db.insert(scanRuns).values({
      userId,
      status: 'running',
    }).returning();

    await addScanJob({ userId, scanRunId: run.id });
    return reply.code(202).send({ queued: true, scanRunId: run.id });
  });

  // POST /api/scan — legacy alias (also triggers a scan, same as /trigger)
  app.post('/', { preHandler: [requireAuth, requirePlan('pro')] }, async (request, reply) => {
    const userId = request.user.dbId;

    const [run] = await db.insert(scanRuns).values({
      userId,
      status: 'running',
    }).returning();

    await addScanJob({ userId, scanRunId: run.id });
    return reply.code(202).send({ queued: true, scanRunId: run.id });
  });

  // GET /api/scan/history — list last 10 scan runs
  app.get('/history', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.user.dbId;
    return db.select().from(scanRuns)
      .where(eq(scanRuns.userId, userId))
      .orderBy(desc(scanRuns.startedAt))
      .limit(10);
  });

  // GET /api/scan/:id — check status of a specific scan run
  app.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params;
    const [run] = await db.select().from(scanRuns).where(eq(scanRuns.id, id));
    if (!run) return reply.code(404).send({ error: 'Not found' });
    return run;
  });
}

