import { db } from '../db/client.js';
import { jobs, evaluations } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requirePlan, requireAuth } from '../middleware/auth.js';
import { addEvaluationJob } from '../queues/queues.js';

export async function jobsRoutes(app) {
  // GET /api/jobs — list all jobs for the current user
  app.get('/', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.user.dbId;
    const userJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .orderBy(desc(jobs.discoveredAt));
    return userJobs;
  });

  // GET /api/jobs/:id — get a single job with its evaluation report
  app.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.dbId;

    const [job] = await db.select().from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)));

    if (!job) return reply.code(404).send({ error: 'Not found' });

    const [evaluation] = await db.select().from(evaluations)
      .where(eq(evaluations.jobId, id));

    return { ...job, evaluation };
  });

  // POST /api/jobs — add a job manually (URL or paste)
  app.post('/', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.dbId;
    const { url, company, role, jdText } = request.body;

    const [newJob] = await db.insert(jobs).values({
      userId,
      company: company || 'Unknown',
      role: role || 'Unknown',
      url,
      source: 'manual',
      status: 'Inbox',
    }).returning();

    // Queue evaluation immediately if we have enough info
    if (url || jdText) {
      await addEvaluationJob({ jobId: newJob.id, userId, url, jdText });
    }

    return reply.code(201).send(newJob);
  });

  // POST /api/jobs/:id/evaluate — (re-)trigger evaluation for a job
  app.post('/:id/evaluate', { preHandler: [requireAuth, requirePlan('free')] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.dbId;

    const [job] = await db.select().from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)));

    if (!job) return reply.code(404).send({ error: 'Not found' });

    const queueJob = await addEvaluationJob({ jobId: id, userId, url: job.url });
    return { queued: true, queueJobId: queueJob.id };
  });

  // PATCH /api/jobs/:id — update status / notes
  app.patch('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.dbId;
    const { status, notes } = request.body;

    const [updated] = await db.update(jobs)
      .set({ status, notes, updatedAt: new Date() })
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning();

    if (!updated) return reply.code(404).send({ error: 'Not found' });
    return updated;
  });

  // DELETE /api/jobs/:id
  app.delete('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.dbId;

    await db.delete(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
    return reply.code(204).send();
  });
}
