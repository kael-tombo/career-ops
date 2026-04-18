import { db } from '../db/client.js';
import { jobs, evaluations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requirePlan } from '../middleware/auth.js';

export async function interviewRoutes(app) {
  // POST /api/interview/practice
  app.post('/practice', { preHandler: [requireAuth, requirePlan('pro')] }, async (request, reply) => {
    const userId = request.user.dbId;
    const { jobId, messageHistory } = request.body; // messageHistory: [{ role: 'user'|'assistant', content: string }]

    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
    if (!job) return reply.code(404).send({ error: 'Job not found' });

    const [evalData] = await db.select().from(evaluations).where(eq(evaluations.jobId, id));
    if (!evalData) return reply.code(400).send({ error: 'Job must be evaluated first' });

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `
You are a hiring manager interviewing a candidate for the following role:
Company: ${job.company}
Role: ${job.role}

Here is the candidate's evaluation and the key requirements you care about (Block F):
${evalData.blockF}

Your goal is to conduct a mock interview.
If this is the first message (messageHistory is empty), introduce yourself as the hiring manager and ask a behavioral question related to one of the requirements.
If the candidate has answered, briefly evaluate their answer against the STAR method (Situation, Task, Action, Result) internally, give them constructive feedback in 1-2 sentences, and then ask the next question.
Keep your responses concise and conversational. Do not output markdown tables. Act like a real human interviewer.
    `;

    // Ensure we don't send an empty messages array if there is no history.
    // If no history, we send a trigger message from the user to start the simulation.
    const messages = messageHistory && messageHistory.length > 0 
      ? messageHistory 
      : [{ role: 'user', content: 'Hi, I am ready for the interview.' }];

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages,
    });

    return { reply: msg.content[0].text };
  });
}
