import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/client.js';
import { jobs, evaluations, users, profiles } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Reuse the existing career-ops modes from the parent repo
const MODES_DIR = join(__dirname, '../../../../modes');
const SHARED_MODE = join(MODES_DIR, '_shared.md');
const OFERTA_MODE = join(MODES_DIR, 'oferta.md');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function loadMode(path) {
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}

export async function runEvaluation({ jobId, userId, url, jdText }) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!job || !user) throw new Error('Job or user not found');

  // Build the prompt from shared career-ops modes
  const sharedContext = loadMode(SHARED_MODE);
  const ofertaMode = loadMode(OFERTA_MODE);

  const cvContext = profile?.cvMarkdown 
    ? `\n\n<cv_md>\n${profile.cvMarkdown}\n</cv_md>\n\nIMPORTANT: Use the candidate's CV provided in the <cv_md> tags above instead of looking for a local file.`
    : `\n\nWARNING: No CV profile provided. Evaluate the job generically.`;

  const systemPrompt = `${sharedContext}\n\n${ofertaMode}${cvContext}`;

  const userMessage = url
    ? `Evaluate this job posting: ${url}`
    : `Evaluate this job description:\n\n${jdText}`;

  let message;
  let modelUsed = 'claude-3-5-sonnet-20240620';

  try {
    message = await client.messages.create({
      model: modelUsed,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (err) {
    console.warn(`⚠️  Primary model (${modelUsed}) failed, falling back to Haiku:`, err.message);
    modelUsed = 'claude-3-haiku-20240307';
    message = await client.messages.create({
      model: modelUsed,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
  }

  const rawMarkdown = message.content[0].text;

  // Parse score from the markdown (looks for "**Score:** 4.2/5")
  const scoreMatch = rawMarkdown.match(/\*\*Score:\*\*\s*([\d.]+)\/5/i);
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;

  // Parse archetype
  const archetypeMatch = rawMarkdown.match(/\*\*Archetype:\*\*\s*(.+)/i);
  const archetype = archetypeMatch ? archetypeMatch[1].trim() : null;

  // Parse legitimacy
  const legMatch = rawMarkdown.match(/\*\*Legitimacy:\*\*\s*(.+)/i);
  const legitimacy = legMatch ? legMatch[1].trim() : null;

  // Extract evaluation blocks A–G from section headers
  // Matches: ## Block A: Role Summary ... ## Block B: ...
  function extractBlock(label) {
    const pattern = new RegExp(
      `##\\s*Block\\s*${label}[:\\-\\s][^\\n]*\\n([\\s\\S]*?)(?=##\\s*Block\\s*[A-G]|$)`,
      'i'
    );
    const m = rawMarkdown.match(pattern);
    if (m) return m[1].trim();
    // Fallback: look for bold section headers like **Block A:**
    const pattern2 = new RegExp(
      `\\*\\*Block\\s*${label}[:\\-\\s][^*]*\\*\\*([\\s\\S]*?)(?=\\*\\*Block\\s*[A-G]|$)`,
      'i'
    );
    const m2 = rawMarkdown.match(pattern2);
    return m2 ? m2[1].trim() : null;
  }

  const blockA = extractBlock('A');
  const blockB = extractBlock('B');
  const blockC = extractBlock('C');
  const blockD = extractBlock('D');
  const blockE = extractBlock('E');
  const blockF = extractBlock('F');
  const blockG = extractBlock('G');

  // Insert evaluation record
  const [evaluation] = await db.insert(evaluations).values({
    jobId,
    userId,
    score: score?.toString(),
    archetype,
    legitimacy,
    blockA,
    blockB,
    blockC,
    blockD,
    blockE,
    blockF,
    blockG,
    rawMarkdown,
    model: modelUsed,
    tokens: (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0),
  }).returning();

  // Update job with score and status
  await db.update(jobs).set({
    score: score?.toString(),
    status: 'Evaluated',
    reportId: evaluation.id,
    updatedAt: new Date(),
  }).where(eq(jobs.id, jobId));

  // Increment eval count for free users
  if (user.plan === 'free') {
    await db.update(users)
      .set({ evalCount: (user.evalCount || 0) + 1 })
      .where(eq(users.id, userId));
  }

  console.log(`✅ Evaluation stored: ${job.company} ${job.role} → ${score}/5`);
  return evaluation;
}
