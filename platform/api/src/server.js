import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import rawBody from 'fastify-raw-body';

import { authRoutes } from './routes/auth.js';
import { jobsRoutes } from './routes/jobs.js';
import { scanRoutes } from './routes/scan.js';
import { cvRoutes } from './routes/cv.js';
import { subscriptionsRoutes } from './routes/subscriptions.js';
import { profileRoutes } from './routes/profile.js';
import { startWorkers } from './queues/workers.js';

const app = Fastify({ logger: { level: process.env.NODE_ENV === 'production' ? 'warn' : 'info' } });

// ── Plugins ──────────────────────────────────────────────────────────────────
// rawBody must be registered BEFORE routes that need it (Clerk + Stripe webhooks)
await app.register(rawBody, {
  field: 'rawBody',
  global: false,   // opt-in per route via config.rawBody = true
  encoding: 'utf8',
  runFirst: true,
});

await app.register(cors, {
  origin: process.env.WEB_URL || 'http://localhost:3000',
  credentials: true,
});

await app.register(jwt, {
  secret: process.env.CLERK_JWT_PUBLIC_KEY || process.env.JWT_SECRET || 'dev-secret-change-in-prod',
});

// Rate limit — exclude webhook paths (they have their own auth via signatures)
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
  skip: (req) => req.url.includes('/webhook'),
});

// ── Auth Decorator ────────────────────────────────────────────────────────────
app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
await app.register(authRoutes, { prefix: '/auth' });
await app.register(jobsRoutes, { prefix: '/api/jobs' });
await app.register(scanRoutes, { prefix: '/api/scan' });
await app.register(cvRoutes, { prefix: '/api/cv' });
await app.register(subscriptionsRoutes, { prefix: '/api/subscriptions' });
await app.register(profileRoutes, { prefix: '/api/profile' });

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', version: '1.0.0', ts: new Date().toISOString() }));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3002;

try {
  await startWorkers();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n🚀 Career-Ops Cloud API running on port ${PORT}\n`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

