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

  // POST /api/jobs/:id/outreach — generate cold email
  app.post('/:id/outreach', { preHandler: [requireAuth, requirePlan('pro')] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.dbId;

    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
    if (!job) return reply.code(404).send({ error: 'Not found' });

    const [evalData] = await db.select().from(evaluations).where(eq(evaluations.jobId, id));
    if (!evalData) return reply.code(400).send({ error: 'Evaluation required first' });

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `
You are an expert career coach helping a candidate write a cold outreach email to the hiring manager for the following role:
Company: ${job.company}
Role: ${job.role}

Here is the AI evaluation of the candidate's fit for this role:
${evalData.blockB}
${evalData.blockC}

Write a short, highly personalized cold email (max 3 paragraphs). 
- Do NOT sound like an AI. Sound like a confident, senior professional.
- Start with a hook about the company or the specific domain.
- Highlight 1-2 specific proof points from the evaluation that match the role perfectly.
- Close with a soft CTA (e.g., "Would love to chat if you are open to it").
- Use placeholders like [Hiring Manager Name] where appropriate.
    `;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    return { draft: msg.content[0].text };
  });
}

