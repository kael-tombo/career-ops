import { db } from '../db/client.js';
import { profiles } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

export async function profileRoutes(app) {
  // GET /api/profile
  app.get('/', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.user.dbId;
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    return profile ?? {};
  });

  // PUT /api/profile — upsert profile
  app.put('/', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.user.dbId;
    const body = request.body;

    const [existing] = await db.select().from(profiles).where(eq(profiles.userId, userId));

    if (existing) {
      const [updated] = await db.update(profiles)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(profiles.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(profiles)
        .values({ userId, ...body })
        .returning();
      return created;
    }
  });
}
