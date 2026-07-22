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

    const [evalData] = await db.select().from(evaluations).where(eq(evaluations.jobId, jobId));
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

  // GET /api/interview/:id/predicted-questions — AI synthesized prep
  app.get('/:id/predicted-questions', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.dbId;

    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
    if (!job) return reply.code(404).send({ error: 'Job not found' });

    const [evalData] = await db.select().from(evaluations).where(eq(evaluations.jobId, id));
    if (!evalData) return reply.code(400).send({ error: 'Evaluation required first' });

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `
You are an elite interview coach. I will provide you with a Job Description evaluation for a candidate.
Company: ${job.company}
Role: ${job.role}

AI Evaluation (Block B, C, F):
${evalData.blockB}
${evalData.blockC}
${evalData.blockF}

Your task is to predict 6 highly probable interview questions for this specific candidate:
1. **3 Behavioral Questions**: Specifically target the "Gaps" (Block C) to test how they handle their weaknesses.
2. **3 Technical/Domain Questions**: Focus on the core requirements of the role (Block F).

Output exactly 2 sections in markdown:
### 🎭 Predicted Behavioral Questions
(3 questions)
### ⚙️ Predicted Technical Questions
(3 questions)

Be precise and role-specific. Do not use filler.
    `;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    return { analysis: msg.content[0].text };
  });
}
