/**
 * lib/server/routes/ai.mjs — AI Module API Routes
 * Exposes all 15 AI modules as REST endpoints.
 */
export default async function aiRoutes(fastify) {
  const { listModules, runModule } = await import('../../ai/orchestrator.mjs');

  // GET /api/ai — List all AI modules and provider status
  fastify.get('/api/ai', async () => {
    const { getProviderStatus } = await import('../../ai/orchestrator.mjs');
    return {
      modules: listModules(),
      providers: getProviderStatus(),
    };
  });

  // POST /api/ai/:module/:action — Run any AI module action
  fastify.post('/api/ai/:module/:action', {
    schema: {
      params: {
        type: 'object',
        properties: {
          module: { type: 'string' },
          action: { type: 'string' },
        },
        required: ['module', 'action'],
      },
      body: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          company: { type: 'string' },
          role: { type: 'string' },
          description: { type: 'string' },
          jd: { type: 'string' },
          jdText: { type: 'string' },
          cvContent: { type: 'string' },
          tailoredCvContent: { type: 'string' },
          offer: { type: 'object' },
          offers: { type: 'array' },
          jobs: { type: 'array' },
          job: { type: 'object' },
          companyName: { type: 'string' },
          daysSinceApplied: { type: 'number' },
          daysAhead: { type: 'number' },
          scores: { type: 'array' },
          questions: { type: 'object' },
          timeline: { type: 'array' },
          rejections: { type: 'array' },
          historicalPatterns: { type: 'object' },
        },
      },
    },
  }, async (request) => {
    const { module, action } = request.params;
    const params = request.body || {};
    try {
      const result = await runModule(module, action, params);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // GET /api/ai/:module — Show module info
  fastify.get('/api/ai/:module', async (request) => {
    const mod = listModules().find(m => m.id === request.params.module);
    if (!mod) return { error: 'Module not found' };
    try {
      const m = await import(`../../ai/${mod.path}`);
      return { module: mod, actions: Object.keys(m).filter(k => typeof m[k] === 'function') };
    } catch {
      return { module: mod, actions: [] };
    }
  });
}
