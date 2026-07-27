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
import { existsSync, readFileSync } from 'fs';
import { join, extname } from 'path';

// Database & Queue
import { getDb, close as closeDb } from './lib/db/index.mjs';
import { JobQueue } from './lib/queue.mjs';

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
import memoryRoutes from './lib/server/routes/memory.mjs';
import aiRoutes from './lib/server/routes/ai.mjs';

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

// ═══════════════════════════════════════════════════════════════
// Initialize
// ═══════════════════════════════════════════════════════════════

// Initialize database (auto-creates tables if needed)
const db = getDb();

// Initialize persistent job queue
const queue = new JobQueue({ maxConcurrency: 2, jobTimeout: 60000 });

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

// CORS
const corsOrigin = process.env.CORS_ORIGIN;
let origin;
if (!corsOrigin || corsOrigin === 'true') {
  origin = true;
} else if (corsOrigin === '*') {
  origin = '*';
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
// API Routes
// ═══════════════════════════════════════════════════════════════

await fastify.register(healthRoutes);
await fastify.register(applicationRoutes);
await fastify.register(pipelineRoutes);
await fastify.register(reportRoutes);
await fastify.register(scannerRoutes, { queue });
await fastify.register(jobRoutes, { queue });
await fastify.register(diagnosticsRoutes, { queue });
await fastify.register(globalRoutes, { queue });
await fastify.register(autonomousRoutes, { queue });
await fastify.register(memoryRoutes);
await fastify.register(aiRoutes);

// ═══════════════════════════════════════════════════════════════
// Static file serving (legacy dashboard fallback)
// ═══════════════════════════════════════════════════════════════

fastify.setNotFoundHandler((request, reply) => {
  // Only serve static files for non-API routes
  if (request.url.startsWith('/api/')) {
    reply.code(404).send({ error: 'Not Found' });
    return;
  }

  // Try to serve from dashboard dist
  let filePath;
  if (request.url === '/') {
    filePath = join(DASHBOARD_DIR, 'index.html');
  } else {
    filePath = join(DASHBOARD_DIR, request.url);
  }

  if (existsSync(filePath)) {
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    reply.type(contentType).send(readFileSync(filePath));
    return;
  }

  // SPA fallback
  const indexPath = join(DASHBOARD_DIR, 'index.html');
  if (existsSync(indexPath)) {
    reply.type('text/html').send(readFileSync(indexPath));
    return;
  }

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
