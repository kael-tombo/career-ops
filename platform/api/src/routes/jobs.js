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

  // POST /api/jobs/:id/negotiate — generate negotiation response
  app.post('/:id/negotiate', { preHandler: [requireAuth, requirePlan('pro')] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.dbId;
    const { offerDetails } = request.body;

    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
    if (!job) return reply.code(404).send({ error: 'Not found' });

    const { profiles } = await import('../db/schema.js');
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    const [evalData] = await db.select().from(evaluations).where(eq(evaluations.jobId, id));

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `
You are an expert negotiation coach. Help a candidate draft a response to a job offer.
Company: ${job.company}
Role: ${job.role}
Candidate Target Compensation: ${profile?.compensationTarget || 'Not specified'}

Offer Details provided by candidate:
${offerDetails}

AI Market Research for this role (Block D):
${evalData?.blockD || 'No data'}

Write a professional, collaborative, yet firm negotiation response.
- Express genuine excitement about the role and team.
- Use the "anchor" method if applicable, or ask for specific adjustments based on market data.
- Mention 1-2 key unique values the candidate brings (from Block B/C context if possible).
- Keep it concise (max 3-4 paragraphs).
`;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    return { draft: msg.content[0].text };
  });

  // POST /api/jobs/:id/cover-letter — generate tailored cover letter
  app.post('/:id/cover-letter', { preHandler: [requireAuth, requirePlan('pro')] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.dbId;

    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
    if (!job) return reply.code(404).send({ error: 'Not found' });

    const { profiles } = await import('../db/schema.js');
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    const [evalData] = await db.select().from(evaluations).where(eq(evaluations.jobId, id));

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `
You are an expert career consultant. Write a highly tailored cover letter for:
Company: ${job.company}
Role: ${job.role}

Candidate Master Profile:
${profile?.cvMarkdown || 'No CV provided'}

Job Evaluation (Block A & B):
${evalData?.blockA || ''}
${evalData?.blockB || ''}

Instructions:
- Write a 3-paragraph formal cover letter.
- Paragraph 1: Why this company/role specifically.
- Paragraph 2: Core value proposition and matching proof points.
- Paragraph 3: Call to action.
- Keep it professional, confident, and concise.
`;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    return { draft: msg.content[0].text };
  });

  // POST /api/jobs/:id/portfolio — generate public portfolio link
  app.post('/:id/portfolio', { preHandler: [requireAuth, requirePlan('elite')] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.dbId;
    const { portfolios, profiles, evaluations } = await import('../db/schema.js');

    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
    if (!job) return reply.code(404).send({ error: 'Not found' });

    // Dedupe
    const [existing] = await db.select().from(portfolios).where(eq(portfolios.jobId, id));
    if (existing) return existing;

    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    const [evalData] = await db.select().from(evaluations).where(eq(evaluations.jobId, id));

    // Simple STAR parser for portfolio
    const stories = [];
    if (evalData?.blockF) {
      const rows = evalData.blockF.split('\n').filter(line => line.trim().startsWith('|'));
      for (const row of rows.slice(2)) {
        const cols = row.split('|').map(c => c.trim());
        if (cols.length >= 8 && cols[3] && cols[3] !== '---') {
          stories.push({ title: cols[3], requirement: cols[2], star: `${cols[4]} ${cols[5]} ${cols[6]} ${cols[7]}` });
        }
      }
    }

    const slug = `${job.company.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).substring(2, 7)}`;

    const [newPortfolio] = await db.insert(portfolios).values({
      userId,
      jobId: id,
      slug,
      title: `${profile?.fullName || 'Candidate'} — ${job.company} Portfolio`,
      cvContent: profile?.cvMarkdown,
      starStories: stories.slice(0, 3), // Top 3
    }).returning();

    return newPortfolio;
  });
}

