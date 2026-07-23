/**
 * lib/server/routes/applications.mjs — Application CRUD endpoints
 */

import {
  getApplications,
  getOne,
  updateApplicationStatus,
} from '../../db/index.mjs';

export default async function applicationRoutes(fastify) {
  // GET /api/applications — List all applications
  fastify.get('/api/applications', async () => {
    const apps = getApplications();
    // Map to legacy format for backward compatibility with dashboard
    return apps.map(a => ({
      id: String(a.id),
      date: a.date,
      company: a.company,
      role: a.role,
      score: a.score != null ? `${a.score}/5` : '-',
      status: a.status,
      pdf: a.pdf_generated ? '✅' : '❌',
      report: a.report_path ? `[${a.id}](${a.report_path})` : '',
      notes: a.notes || '',
      url: a.url || '',
    }));
  });

  // GET /api/applications/:id — Get single application
  fastify.get('/api/applications/:id', async (request, reply) => {
    const app = getOne('SELECT * FROM applications WHERE id = ?', [parseInt(request.params.id)]);
    if (!app) {
      reply.code(404);
      return { error: 'Application not found' };
    }
    return {
      ...app,
      score: app.score != null ? `${app.score}/5` : '-',
    };
  });

  // PUT /api/applications/:id — Update application status/notes
  fastify.put('/api/applications/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          notes: { type: 'string' },
        }
      }
    }
  }, async (request) => {
    const { id } = request.params;
    const { status, notes } = request.body || {};
    const success = updateApplicationStatus(parseInt(id), { status, notes });
    return { success };
  });
}
