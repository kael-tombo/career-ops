/**
 * lib/server/routes/diagnostics.mjs — System health and profile endpoints
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, relative } from 'path';
import yaml from 'js-yaml';

const ROOT = process.cwd();

function safeJoin(base, filename) {
  const decoded = decodeURIComponent(filename).replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = resolve(join(base, decoded));
  if (relative(base, resolved).startsWith('..')) return null;
  return resolved;
}

export default async function diagnosticsRoutes(fastify, { queue }) {
  // GET /api/diagnostics — System health checks
  fastify.get('/api/diagnostics', async () => {
    return {
      env: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY ? 'OK' : 'MISSING_KEY',
      cv: existsSync(join(ROOT, 'cv.md')),
      profile: existsSync(join(ROOT, 'config/profile.yml')),
      node_modules: existsSync(join(ROOT, 'node_modules')),
      portals: existsSync(join(ROOT, 'portals.yml')),
      queue: queue.getStatus(),
    };
  });

  // GET /api/profile — User profile from config/profile.yml
  fastify.get('/api/profile', async (request, reply) => {
    const profilePath = join(ROOT, 'config/profile.yml');
    if (!existsSync(profilePath)) {
      reply.code(404);
      return { error: 'Profile not found' };
    }
    return yaml.load(readFileSync(profilePath, 'utf-8'));
  });

  // GET /api/interview-prep — List interview prep files
  fastify.get('/api/interview-prep', async () => {
    const dir = join(ROOT, 'interview-prep');
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter(f => f.endsWith('.md') && f !== 'story-bank.md')
      .map(f => ({
        name: f,
        stats: (() => {
          try {
            const s = statSync(join(dir, f));
            return { mtime: s.mtime.toISOString(), size: s.size };
          } catch { return {}; }
        })(),
      }));
  });

  // GET /api/interview-prep/:filename — Get specific prep file
  fastify.get('/api/interview-prep/:filename', async (request, reply) => {
    const filePath = safeJoin(join(ROOT, 'interview-prep'), request.params.filename);
    if (!filePath || !existsSync(filePath)) {
      reply.code(404);
      return { error: 'Prep file not found' };
    }
    reply.type('text/markdown');
    return readFileSync(filePath, 'utf-8');
  });
}
