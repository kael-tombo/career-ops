import { execaNode } from 'execa';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { db } from '../db/client.js';
import { cvAssets, jobs, evaluations } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Reuse the parent repo's generate-pdf script
const GENERATE_PDF = join(__dirname, '../../../../generate-pdf.mjs');
const OUTPUT_DIR = join(__dirname, '../../../../output');

/**
 * runPdfGeneration({ jobId, userId })
 * Calls the existing generate-pdf.mjs script from the parent career-ops repo,
 * passing the job + evaluation context, then stores the result path in cv_assets.
 */
export async function runPdfGeneration({ jobId, userId }) {
  // Fetch job + evaluation
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new Error(`Job ${jobId} not found`);

  const [evaluation] = await db.select().from(evaluations).where(eq(evaluations.jobId, jobId));

  const filename = `cv-${job.company.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`;
  const outputPath = join(OUTPUT_DIR, filename);

  if (existsSync(GENERATE_PDF)) {
    // Call the parent repo's PDF generator with env context
    await execaNode(GENERATE_PDF, [], {
      env: {
        ...process.env,
        CAREER_OPS_COMPANY: job.company,
        CAREER_OPS_ROLE: job.role,
        CAREER_OPS_JOB_URL: job.url || '',
        CAREER_OPS_OUTPUT: outputPath,
        CAREER_OPS_EVAL_SCORE: evaluation?.score || '',
        CAREER_OPS_EVAL_ARCHETYPE: evaluation?.archetype || '',
      },
    });
  } else {
    // Fallback: create a placeholder record so the UI shows something
    console.warn('⚠️  generate-pdf.mjs not found, creating placeholder CV record');
  }

  // Insert or update cv_assets record
  const [existing] = await db.select().from(cvAssets).where(eq(cvAssets.jobId, jobId));

  if (existing) {
    await db.update(cvAssets)
      .set({ localPath: existsSync(outputPath) ? outputPath : null, filename })
      .where(eq(cvAssets.id, existing.id));
  } else {
    await db.insert(cvAssets).values({
      jobId,
      userId,
      filename,
      localPath: existsSync(outputPath) ? outputPath : null,
    });
  }

  console.log(`✅ PDF generation complete: ${filename}`);
}
