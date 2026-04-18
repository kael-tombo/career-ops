import { db } from '../db/client.js';
import { portfolios } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function publicRoutes(app) {
  // GET /api/public/portfolio/:slug
  app.get('/portfolio/:slug', async (request, reply) => {
    const { slug } = request.params;

    const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.slug, slug));
    
    if (!portfolio || !portfolio.isPublic) {
      return reply.code(404).send({ error: 'Portfolio not found or private' });
    }

    return portfolio;
  });
}
