#!/usr/bin/env node

/**
 * server.mjs — Career-OPS v3.0 API Server (Fastify)
 *
 * Features:
 *  - Fastify with JSON Schema validation
 *  - SQLite-backed data layer
 *  - Persistent job queue with retry logic
 *  - SSE event streaming
 *  - CORS (configurable)
 *  - Rate limiting
 *  - Graceful shutdown
 *  - Health check endpoint
 *  - Structured request logging
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
// Database & Queue
import { getDb, close as closeDb } from './lib/db/index.mjs';
import { startDbWatch, stopDbWatch } from './lib/db/watch.mjs';
import { emitEvent } from './lib/events.mjs';
import { JobQueue } from './lib/queue.mjs';
import { bindPathA } from './lib/core/repository.mjs';

// Routes
import healthRoutes from './lib/server/routes/health.mjs';
import applicationRoutes from './lib/server/routes/applications.mjs';
import pipelineRoutes from './lib/server/routes/pipeline.mjs';
import reportRoutes from './lib/server/routes/reports.mjs';
import scannerRoutes from './lib/server/routes/scanner.mjs';
import jobRoutes from './lib/server/routes/jobs.mjs';
import diagnosticsRoutes from './lib/server/routes/diagnostics.mjs';
import globalRoutes from './lib/server/routes/global.mjs';
import autonomousRoutes from './lib/server/routes/autonomous.mjs';
import consentRoutes from './lib/server/routes/consent.mjs';
import fleetRoutes from './lib/server/routes/fleet.mjs';
import memoryRoutes from './lib/server/routes/memory.mjs';
import aiRoutes from './lib/server/routes/ai.mjs';
import metricsRoutes from './lib/server/routes/metrics.mjs';
import resumesRoutes from './lib/server/routes/resumes.mjs';
import settingsRoutes from './lib/server/routes/settings.mjs';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
// Secure-by-default: bind loopback unless HOST is explicitly set. The API
// exposes pipeline control, application data, and resume content — publishing
// it on all interfaces without authentication is a remote-control hole
// (production readiness finding P0-2). Docker sets HOST=0.0.0.0 explicitly.
const HOST = process.env.HOST || '127.0.0.1';

// ═══════════════════════════════════════════════════════════════
// Initialize
// ═══════════════════════════════════════════════════════════════

// Initialize database (auto-creates tables if needed)
const db = getDb();

// BLUEPRINT v4 P1: file contract is the source of truth — seed the SQLite
// mirror on boot and keep it live by watching data/ (lib/db/watch.mjs).
startDbWatch();

// Initialize persistent job queue
const queue = new JobQueue({ maxConcurrency: 2, jobTimeout: 60000 });
// Mirror queue lifecycle into the append-only event spine (lib/events.mjs)
// so Execution Replay and the audit trail survive process restarts. The
// queue's only public subscription surface is its SSE subscribe() — use a
// narrow internal hook instead of widening the public API.
queue._listeners.add((event, data) => emitEvent(`queue.${event.replace(/^job:/, '')}`, data));

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
  },
});

// ═══════════════════════════════════════════════════════════════
// Plugins
// ═══════════════════════════════════════════════════════════════

// CORS — secure by default. An unset CORS_ORIGIN previously reflected any
// origin (`origin: true`), letting any webpage the user visits drive the API
// cross-origin (P0-2). Default: the local dashboard origin; explicit config
// wins. The literal '*' is only honored outside production.
const DASHBOARD_ORIGIN = process.env.DASHBOARD_ORIGIN || 'http://localhost:3000';
const corsOrigin = process.env.CORS_ORIGIN;
const IS_PROD = process.env.NODE_ENV === 'production';
let origin;
if (!corsOrigin) {
  origin = DASHBOARD_ORIGIN;
} else if (corsOrigin === 'true') {
  origin = true;
} else if (corsOrigin === '*') {
  if (IS_PROD) {
    console.warn('⚠️  CORS_ORIGIN="*" ignored in production — set explicit origins');
    origin = DASHBOARD_ORIGIN;
  } else {
    origin = '*';
  }
} else {
  origin = corsOrigin.split(',').map(s => s.trim());
}
await fastify.register(cors, {
  origin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Rate limiting
await fastify.register(rateLimit, {
  max: parseInt(process.env.RATE_LIMIT || '200'),
  timeWindow: '1 minute',
  // Exclude health check from rate limiting
  allowList: (req) => req.url === '/api/health',
});

// ═══════════════════════════════════════════════════════════════
// Authentication (root-level hook — applies to all routes)
// ═══════════════════════════════════════════════════════════════

const AUTH_KEY = process.env.API_KEY;
if (IS_PROD && !AUTH_KEY && HOST !== '127.0.0.1' && HOST !== 'localhost') {
  // Fail fast: production deployment on a reachable interface MUST have auth.
  console.error('✖ Refusing to start: NODE_ENV=production with a non-local HOST requires API_KEY (deploy gate G8).');
  console.error('  Set API_KEY, or bind HOST=127.0.0.1 behind a local reverse proxy.');
  process.exit(1);
}
if (AUTH_KEY) {
    const AUTH_ALLOWED = (process.env.API_AUTH_EXEMPT || '/api/health')
    .split(',').map(s => s.trim()).filter(Boolean);
  fastify.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    if (AUTH_ALLOWED.some(p => request.url.startsWith(p))) return;
    const auth = request.headers.authorization;
    if (!auth) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Missing Authorization header' });
      return;
    }
    const [scheme, token] = auth.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid Authorization format. Use: Bearer <API_KEY>' });
      return;
    }
    if (token !== AUTH_KEY) {
      reply.code(403).send({ error: 'Forbidden', message: 'Invalid API key' });
      return;
    }
  });
  fastify.log.info('API key authentication enabled');
} else {
  fastify.log.warn('API_KEY not set — authentication disabled');
}

// ═══════════════════════════════════════════════════════════════
// API Routes
// ═══════════════════════════════════════════════════════════════

// Bind the P6 data-plane seam (Path A: files + SQLite, single local tenant)
// and hand the repositories to routes that accept them.
const repos = await bindPathA();

await fastify.register(healthRoutes);
await fastify.register(applicationRoutes, { repos });
await fastify.register(pipelineRoutes, { repos });
await fastify.register(reportRoutes, { repos });
await fastify.register(scannerRoutes, { queue });
await fastify.register(jobRoutes, { queue });
await fastify.register(diagnosticsRoutes, { queue });
await fastify.register(globalRoutes, { queue });
await fastify.register(autonomousRoutes, { queue });
await fastify.register(consentRoutes, { repos });
await fastify.register(fleetRoutes, { repos });
await fastify.register(memoryRoutes, { repos });
await fastify.register(aiRoutes);
await fastify.register(metricsRoutes);
await fastify.register(resumesRoutes);
await fastify.register(settingsRoutes);

// ═══════════════════════════════════════════════════════════════
// Not-found handler — API-first server. There is no static frontend here:
// the dashboard is dashboard-next (Next.js, `npm run dev` in dashboard-next/).
// The legacy Vite fallback was retired with Blueprint P5 ("Mission Control is
// the single frontend"); do not reintroduce static serving on this process.
fastify.setNotFoundHandler((request, reply) => {
  reply.code(404).send({ error: 'Not Found' });
});

// ═══════════════════════════════════════════════════════════════
// Error handler
// ═══════════════════════════════════════════════════════════════

fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  // Rate limit error
  if (error.statusCode === 429) {
    reply.code(429).send({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please slow down.',
    });
    return;
  }

  // Validation error
  if (error.validation) {
    reply.code(400).send({
      error: 'Validation Error',
      message: error.message,
      details: error.validation,
    });
    return;
  }

  reply.code(error.statusCode || 500).send({
    error: error.message || 'Internal Server Error',
  });
});

// ═══════════════════════════════════════════════════════════════
// Graceful shutdown
// ═══════════════════════════════════════════════════════════════

const shutdown = async (signal) => {
  fastify.log.info(`${signal} received. Shutting down gracefully...`);
  try {
    stopDbWatch();
    await fastify.close();
    closeDb();
    fastify.log.info('Server closed.');
    process.exit(0);
  } catch (err) {
    fastify.log.error(err, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ═══════════════════════════════════════════════════════════════
// Start
// ═══════════════════════════════════════════════════════════════

try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`🚀 Career-OPS v3.0 Server running on http://${HOST}:${PORT}`);
  console.log(`   📊 Dashboard: http://localhost:${PORT}`);
  console.log(`   🏥 Health:    http://localhost:${PORT}/api/health`);
  console.log(`   📡 SSE:       http://localhost:${PORT}/api/events`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
