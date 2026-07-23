/**
 * lib/server/routes/jobs.mjs — Job queue management endpoints
 */

export default async function jobRoutes(fastify, { queue }) {
  // POST /api/jobs — Submit a new job
  fastify.post('/api/jobs', {
    schema: {
      body: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          payload: { type: 'object' },
        },
        required: ['type']
      }
    }
  }, async (request) => {
    const { type, payload } = request.body;
    const jobId = queue.addJob(type, payload || {});
    return { jobId };
  });

  // GET /api/jobs — List job history and active jobs
  fastify.get('/api/jobs', async () => {
    return {
      history: queue.getHistory(),
      active: queue.getActiveJobs(),
      status: queue.getStatus(),
    };
  });

  // GET /api/jobs/:id — Get specific job status
  fastify.get('/api/jobs/:id', async (request, reply) => {
    const job = queue.getJobStatus(request.params.id);
    if (!job) {
      reply.code(404);
      return { error: 'Job not found' };
    }
    return job;
  });

  // POST /api/tailor/:id — Trigger CV tailoring job
  fastify.post('/api/tailor/:id', async (request) => {
    const jobId = queue.addJob('tailor', { id: request.params.id });
    return { jobId };
  });

  // POST /api/prep-form/:id — Trigger form prep job
  fastify.post('/api/prep-form/:id', async (request) => {
    const jobId = queue.addJob('prep-form', { id: request.params.id });
    return { jobId };
  });

  // POST /api/liveness — Trigger liveness check job
  fastify.post('/api/liveness', {
    schema: {
      body: {
        type: 'object',
        properties: {
          urls: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
          },
        },
        required: ['urls']
      }
    }
  }, async (request) => {
    const jobId = queue.addJob('liveness-check', { urls: request.body.urls });
    return { jobId };
  });

  // POST /api/evaluate — Trigger evaluation job
  fastify.post('/api/evaluate', {
    schema: {
      body: {
        type: 'object',
        properties: {
          url: { type: 'string' },
        },
        required: ['url']
      }
    }
  }, async (request) => {
    const jobId = queue.addJob('evaluate', { url: request.body.url });
    return { jobId };
  });

  // GET /api/events — SSE event stream
  fastify.get('/api/events', async (request, reply) => {
    queue.subscribeFastify(request, reply);
  });
}
