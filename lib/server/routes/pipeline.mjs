/**
 * lib/server/routes/pipeline.mjs — Pipeline (pending URLs) endpoints
 */

import { getPipelineItems, addPipelineItems } from '../../db/index.mjs';

export default async function pipelineRoutes(fastify) {
  // GET /api/pipeline — List all pipeline items
  fastify.get('/api/pipeline', async () => {
    const items = getPipelineItems();

    // Map to legacy format for backward compatibility
    const mapped = items.map((item, i) => ({
      id: item.url,
      company: item.company || '',
      role: item.role || '',
      url: item.url,
      pdf: '',
      score: '-',
      action: '',
      tag: item.tag || null,
    }));

    // Also produce raw content for backward compat
    let content = '# Pipeline — Pending URLs\n\n';
    for (const item of items) {
      const tag = item.tag ? ` [${item.tag}]` : '';
      content += `- [ ] ${item.url} | ${item.company} | ${item.role}${tag}\n`;
    }

    return { content, items: mapped };
  });

  // POST /api/pipeline — Add a new pipeline entry
  fastify.post('/api/pipeline', {
    schema: {
      body: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          company: { type: 'string' },
          role: { type: 'string' },
        },
        required: ['url']
      }
    }
  }, async (request) => {
    const count = addPipelineItems([{
      url: request.body.url,
      company: request.body.company || '',
      role: request.body.role || '',
      tag: '',
      source: 'dashboard',
    }]);
    return { success: count > 0, count };
  });
}
