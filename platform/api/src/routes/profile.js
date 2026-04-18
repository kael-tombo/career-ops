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

  // GET /api/profile/stories — dynamic story bank from evaluations
  app.get('/stories', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.user.dbId;

    // We import evaluations and jobs dynamically to avoid circular dep if not already imported
    const { evaluations, jobs } = await import('../db/schema.js');

    const evals = await db
      .select({
        blockF: evaluations.blockF,
        company: jobs.company,
        role: jobs.role
      })
      .from(evaluations)
      .leftJoin(jobs, eq(evaluations.jobId, jobs.id))
      .where(eq(evaluations.userId, userId));

    const stories = [];
    const seenTitles = new Set();

    for (const e of evals) {
      if (!e.blockF) continue;

      // Extract markdown table rows from blockF
      // Typical format: | # | Requisito | Historia STAR+R | S | T | A | R | Reflection |
      const rows = e.blockF.split('\n').filter(line => line.trim().startsWith('|'));
      
      // Skip header and separator rows
      for (const row of rows.slice(2)) {
        const cols = row.split('|').map(c => c.trim());
        if (cols.length >= 8) {
          const req = cols[2];
          const title = cols[3];
          const s = cols[4];
          const t = cols[5];
          const a = cols[6];
          const r = cols[7];
          const reflection = cols[8];

          if (title && title !== 'Historia STAR+R' && title !== '---') {
            if (!seenTitles.has(title)) {
              seenTitles.add(title);
              stories.push({
                title,
                requirement: req,
                s, t, a, r, reflection,
                suggestedFor: [{ company: e.company, role: e.role }]
              });
            } else {
              // Add this job to the suggestedFor list for the existing story
              const existing = stories.find(st => st.title === title);
              if (existing) {
                existing.suggestedFor.push({ company: e.company, role: e.role });
              }
            }
          }
        }
      }
    }

    return stories;
  });

  // GET /api/profile/analytics — aggregated stats
  app.get('/analytics', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.user.dbId;
    const { evaluations, jobs } = await import('../db/schema.js');

    const userJobs = await db.select().from(jobs).where(eq(jobs.userId, userId));
    const userEvals = await db.select().from(evaluations).where(eq(evaluations.userId, userId));

    // 1. Pipeline Funnel
    const funnel = {
      Inbox: 0,
      Evaluated: 0,
      Applied: 0,
      Interview: 0,
      Offer: 0,
    };
    for (const j of userJobs) {
      if (funnel[j.status] !== undefined) {
        funnel[j.status]++;
      } else if (j.status !== 'Discarded' && j.status !== 'Rejected') {
        funnel['Evaluated']++; // default fallback for other active statuses
      }
    }

    // 2. Archetype Distribution
    const archetypes = {};
    for (const e of userEvals) {
      if (e.archetype) {
        // Strip out secondary archetypes if combined (e.g. "Software Engineer (Backend)")
        const primary = e.archetype.split('(')[0].trim();
        archetypes[primary] = (archetypes[primary] || 0) + 1;
      }
    }

    // 3. Scores Trend
    // Group by week or just return last N evaluations
    const scores = userEvals
      .filter(e => e.score && !isNaN(parseFloat(e.score)))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(e => ({
        date: new Date(e.createdAt).toLocaleDateString(),
        score: parseFloat(e.score)
      }));

    return {
      funnel,
      archetypes,
      scores,
      totalJobs: userJobs.length,
      totalEvaluations: userEvals.length
    };
  });
}


