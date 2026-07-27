/**
 * lib/server/routes/reports.mjs — Report listing and content endpoints
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

export default async function reportRoutes(fastify) {
  // GET /api/reports — List all report files
  fastify.get('/api/reports', async () => {
    const dir = join(ROOT, 'reports');
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => ({ name: f }));
  });

  // GET /api/reports/:filename — Get report content
  fastify.get('/api/reports/:filename', async (request, reply) => {
    const filename = decodeURIComponent(request.params.filename);
    const filePath = join(ROOT, 'reports', filename);

    if (!existsSync(filePath)) {
      reply.code(404);
      return { error: 'Report not found' };
    }

    reply.type('text/markdown');
    return readFileSync(filePath, 'utf-8');
  });

  // GET /api/pdf/:filename — Serve a PDF file
  fastify.get('/api/pdf/:filename', async (request, reply) => {
    const filename = decodeURIComponent(request.params.filename);
    const filePath = join(ROOT, 'output', filename);

    if (!existsSync(filePath)) {
      reply.code(404);
      return { error: 'PDF not found' };
    }

    reply.type('application/pdf');
    return readFileSync(filePath);
  });

  // GET /api/story-bank — Get story bank content
  fastify.get('/api/story-bank', async (request, reply) => {
    const filePath = join(ROOT, 'interview-prep/story-bank.md');

    if (!existsSync(filePath)) {
      reply.type('application/json');
      return { stories: [], isEmpty: true, message: 'No story bank yet' };
    }

    reply.type('text/markdown');
    return readFileSync(filePath, 'utf-8');
  });
}
