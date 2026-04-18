import { db } from '../db/client.js';
import { profiles } from '../db/schema.js';
import { eq, and, gte } from 'drizzle-orm';
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

  // GET /api/profile/gaps — AI synthesized skill gap analysis
  app.get('/gaps', { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = request.user.dbId;
    const { evaluations, jobs } = await import('../db/schema.js');

    // Find low-scoring evaluations (e.g., < 3.5)
    const weakEvals = await db
      .select({
        blockC: evaluations.blockC,
        company: jobs.company,
        role: jobs.role,
        score: evaluations.score
      })
      .from(evaluations)
      .leftJoin(jobs, eq(evaluations.jobId, jobs.id))
      .where(eq(evaluations.userId, userId));

    const gapsData = weakEvals.filter(e => e.score && parseFloat(e.score) < 3.5 && e.blockC);

    if (gapsData.length === 0) {
      return { analysis: "Not enough data yet. Once you have a few low-scoring job evaluations, the AI will synthesize your skill gaps here." };
    }

    const compiledGaps = gapsData.map(e => `Role: ${e.role} at ${e.company}\nScore: ${e.score}\nGaps identified by AI:\n${e.blockC}`).join('\n\n---\n\n');

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `You are an elite Career Coach. 
I will provide you with the "Level Strategy & Gaps" (Block C) from several AI evaluations where the candidate scored poorly (< 3.5).
Your job is to read all of these gaps across different roles and synthesize a macro-level Skill Gap Analysis.
Output exactly 3 sections in markdown:
### 🚨 Critical Missing Skills
(Bullet points of the most common hard/soft skills the candidate lacks for these roles)
### 📉 Archetype Weaknesses
(Identify which types of roles the candidate consistently fails to qualify for)
### 📚 30-Day Study Plan
(A concrete, actionable study plan to address the top 2 critical gaps)

Be direct, analytical, and concise. Do not use filler introductions.`;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: compiledGaps }],
    });

    return { analysis: msg.content[0].text };
  });

  // POST /api/profile/optimize-linkedin — AI branding suggestions
  app.post('/optimize-linkedin', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.user.dbId;
    const { linkedinContent } = request.body;
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `
You are an expert LinkedIn branding consultant.
The candidate is targeting these roles: ${profile?.targetRoles || 'Senior Engineering roles'}.
Candidate Narrative: ${profile?.narrative || 'High-performance delivery'}.

Here is the candidate's current LinkedIn content:
${linkedinContent}

Provide an "Elite Branding Report" with:
1. **Branding Alignment Score** (0-100)
2. **Optimized Headline** (220 characters max)
3. **Optimized "About" Section** (Compelling, narrative-driven)
4. **Key Bullet Point Adjustments** (Choose 2 existing bullets and rewrite them for maximum impact)

Focus on making the candidate look like an "A-Player" for their target roles.
    `;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    return { analysis: msg.content[0].text };
  });

  // POST /api/profile/ingest-resume — AI resume-to-markdown conversion
  app.post('/ingest-resume', { preHandler: [requireAuth] }, async (request) => {
    const { rawText } = request.body;

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `
You are an expert technical writer. Convert the following raw resume text into a clean, professional Markdown document.
Follow this structure:
# Name
## Summary
## Experience (Job Title, Company, Date, Bullets)
## Education
## Skills

Raw Text:
${rawText}

Output ONLY the Markdown content. No introduction.
    `;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    return { markdown: msg.content[0].text };
  });

  // GET /api/profile/narrative-suggestions — AI intelligence based on high scores
  app.get('/narrative-suggestions', { preHandler: [requireAuth] }, async (request) => {
    const userId = request.user.dbId;
    const { evaluations, jobs } = await import('../db/schema.js');

    // Find top-performing jobs
    const topEvals = await db
      .select({
        blockB: evaluations.blockB,
        blockE: evaluations.blockE,
        role: jobs.role,
        score: evaluations.score
      })
      .from(evaluations)
      .leftJoin(jobs, eq(evaluations.jobId, jobs.id))
      .where(and(eq(evaluations.userId, userId), gte(evaluations.score, '4.0')));

    if (topEvals.length < 2) {
      return { suggestion: "Not enough high-scoring data yet. Get a few 4.0+ evaluations to unlock narrative insights." };
    }

    const compiledEvidence = topEvals.map(e => `Role: ${e.role}\nScore: ${e.score}\nWhy it matched (Block B/E):\n${e.blockB}\n${e.blockE}`).join('\n\n---\n\n');

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `
You are an elite career brand strategist.
I am providing you with evidence from several high-scoring (4.0/5.0+) AI job evaluations for a candidate.
These evaluations explain exactly why the candidate is an "A-Player" for these specific roles.

Your task is to synthesize this evidence into a "Market-Proven Narrative".
Output exactly 2 sections:
### ⚡ Proven Superpowers
(3 bullet points summarizing what the market consistently values about this candidate)
### 💎 Key Proof Points
(3 specific achievements or skills that high-value employers are looking for in this candidate)

Evidence:
${compiledEvidence}
    `;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    return { suggestion: msg.content[0].text };
  });
}


