/**
 * lib/server/routes/health.mjs — Health check endpoint
 */

export default async function healthRoutes(fastify) {
  fastify.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '3.0.0',
    };
  });
}
