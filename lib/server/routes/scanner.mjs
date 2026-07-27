/**
 * lib/server/routes/scanner.mjs — Scanner and scan history endpoints
 */

import { getAll } from '../../db/index.mjs';

export default async function scannerRoutes(fastify, { queue }) {
  // POST /api/scan — Trigger a scan job (supports single region or multiple regions)
  fastify.post('/api/scan', {
    schema: {
      body: {
        type: 'object',
        properties: {
          region: { type: 'string' },
          regions: { type: 'string' },
        }
      }
    }
  }, async (request) => {
    const params = request.body || {};
    const jobId = queue.addJob('scan', {
      region: params.region || '',
      regions: params.regions || '',
    });
    return { jobId };
  });

  // GET /api/scan-history — Get scan history
  fastify.get('/api/scan-history', async () => {
    return getAll(`
      SELECT url, scanned_at as date, portal, title, company, status
      FROM scan_history
      ORDER BY scanned_at DESC
      LIMIT 500
    `);
  });
}
