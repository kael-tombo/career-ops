import { chromium } from 'playwright';
import { db } from '../db/client.js';
import { jobs } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const EXPIRED_PATTERNS = [
  /job (is )?no longer available/i,
  /job.*no longer open/i,
  /position has been filled/i,
  /this job has expired/i,
  /job posting has expired/i,
  /no longer accepting applications/i,
  /this (position|role|job) (is )?no longer/i,
  /this job (listing )?is closed/i,
  /job (listing )?not found/i,
  /the page you are looking for doesn.t exist/i,
  /\d+\s+jobs?\s+found/i,
  /search for jobs page is loaded/i,
];

const EXPIRED_URL_PATTERNS = [
  /[?&]error=true/i,
];

const APPLY_PATTERNS = [
  /\bapply\b/i,
  /\bsolicitar\b/i,
  /\bbewerben\b/i,
  /\bpostuler\b/i,
  /submit application/i,
  /easy apply/i,
  /start application/i,
];

const MIN_CONTENT_CHARS = 300;

export async function checkLiveness({ jobId, userId }) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job || !job.url) return;

  console.log(`🔍 Checking liveness for: ${job.company} — ${job.role}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const status = response?.status() ?? 0;

    if (status === 404 || status === 410) {
      await markExpired(jobId, `HTTP ${status}`);
      return;
    }

    await page.waitForTimeout(2500);
    const finalUrl = page.url();

    for (const pattern of EXPIRED_URL_PATTERNS) {
      if (pattern.test(finalUrl)) {
        await markExpired(jobId, `Redirected to ${finalUrl}`);
        return;
      }
    }

    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');

    if (APPLY_PATTERNS.some(p => p.test(bodyText))) {
      console.log('✅ Job is still active.');
      return;
    }

    for (const pattern of EXPIRED_PATTERNS) {
      if (pattern.test(bodyText)) {
        await markExpired(jobId, `Pattern matched: ${pattern.source}`);
        return;
      }
    }

    if (bodyText.trim().length < MIN_CONTENT_CHARS) {
      await markExpired(jobId, 'Insufficient content (likely 404/expired page)');
      return;
    }

    console.log('⚠️  Liveness uncertain, but keeping active.');
  } catch (err) {
    console.error(`❌ Liveness check failed for ${job.id}:`, err.message);
  } finally {
    await browser.close();
  }
}

async function markExpired(jobId, reason) {
  console.log(`❌ Job expired: ${reason}. Discarding...`);
  await db.update(jobs)
    .set({ 
      status: 'Discarded',
      updatedAt: new Date(),
      // We could add a notes field if it existed, but for now just discard
    })
    .where(eq(jobs.id, jobId));
}
