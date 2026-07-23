/**
 * lib/auto-apply/mass-apply.mjs — Mass Auto-Apply Orchestrator
 *
 * Applies to multiple job postings with safety guardrails:
 * - Minimum score threshold
 * - Daily application cap
 * - Rate limiting between submissions
 * - Review queue for manual approval
 * - Never auto-submits unless explicitly enabled
 *
 * SAFETY: Requires SAFE_MODE=false env var to auto-submit.
 * Default: opens each application in visible browser for user review.
 */

import { applyToJob, loadProfile, findResumeFiles } from './apply-engine.mjs';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const ROOT = process.cwd();
const REPORTS_DIR = join(ROOT, 'reports');
const APPLY_LOG = join(ROOT, 'data/auto-apply-log.md');

const SAFE_MODE = process.env.SAFE_MODE !== 'false';
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '10');
const MIN_SCORE = parseFloat(process.env.MIN_SCORE || '3.5');
const DELAY_MS = parseInt(process.env.APPLY_DELAY || '5000');

/**
 * Run mass auto-apply on a set of job URLs.
 * @param {Array<{url: string, company?: string, role?: string, score?: number}>} jobs
 * @param {object} [options] - { dryRun?, profile?, resumePath?, dailyLimit?, delayMs? }
 * @returns {Promise<{applied: number, skipped: number, failed: number, results: Array}>}
 */
export async function runMassApply(jobs, options = {}) {
  const dryRun = options.dryRun !== undefined ? options.dryRun : SAFE_MODE;
  const profile = options.profile || loadProfile();
  const resumePath = options.resumePath || findResumeFiles()[0] || '';
  const dailyLimit = options.dailyLimit || DAILY_LIMIT;
  const delayMs = options.delayMs || DELAY_MS;
  const minScore = options.minScore || MIN_SCORE;

  const results = [];
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`\n🤖 Career-OPS Mass Auto-Apply`);
  console.log(`   Mode: ${dryRun ? '🔍 DRY RUN (review only)' : '🚀 AUTO-SUBMIT'}`);
  console.log(`   Daily limit: ${dailyLimit} applications`);
  console.log(`   Min score: ${minScore}`);
  console.log(`   Resume: ${resumePath || 'NONE'}`);
  console.log(`   Target: ${jobs.length} jobs\n`);

  // Load today's application count
  const todayCount = loadTodayCount();

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];

    // Check daily limit
    if (applied + todayCount >= dailyLimit) {
      console.log(`   ⏸️  Daily limit reached (${applied + todayCount}/${dailyLimit})`);
      break;
    }

    // Check score threshold
    if (job.score !== undefined && job.score < minScore) {
      console.log(`   ⏭️  ${job.company || 'Unknown'}: score ${job.score} < ${minScore} — skipping`);
      skipped++;
      results.push({ ...job, status: 'skipped', reason: `score ${job.score} < ${minScore}` });
      continue;
    }

    console.log(`   [${i + 1}/${jobs.length}] Applying to ${job.company || job.url.slice(0, 60)}...`);

    try {
      const result = await applyToJob(job.url, {
        dryRun,
        profile,
        resumePath,
        timeout: 30000,
      });

      results.push({ ...job, ...result });

      if (result.success) {
        applied++;
        // Log the application
        logApplication(job, result);
        // Generate report
        generateApplyReport(job, result);
        console.log(`      ✅ ${result.status}: ${result.message}`);
      } else {
        failed++;
        console.log(`      ❌ ${result.status}: ${result.message}`);
      }
    } catch (err) {
      failed++;
      results.push({ ...job, status: 'error', message: err.message });
      console.log(`      ❌ Error: ${err.message}`);
    }

    // Rate limiting
    if (i < jobs.length - 1) {
      const wait = delayMs + Math.random() * 3000;
      console.log(`      ⏳ Waiting ${Math.round(wait / 1000)}s...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }

  // Summary
  console.log(`\n📊 Results: ${applied} applied, ${skipped} skipped, ${failed} failed\n`);

  return {
    applied,
    skipped,
    failed,
    total: jobs.length,
    results,
    mode: dryRun ? 'dry-run' : 'auto-submit',
  };
}

/**
 * Load today's application count from log.
 */
function loadTodayCount() {
  if (!existsSync(APPLY_LOG)) return 0;
  const today = new Date().toISOString().split('T')[0];
  const content = readFileSync(APPLY_LOG, 'utf-8');
  return (content.match(new RegExp(today, 'g')) || []).length;
}

/**
 * Log application to apply log.
 */
function logApplication(job, result) {
  const today = new Date().toISOString().split('T')[0];
  const entry = `| ${today} | ${job.company || 'Unknown'} | ${job.role || 'Unknown'} | ${result.status} | ${job.url} | ${result.message} |\n`;
  const header = existsSync(APPLY_LOG)
    ? ''
    : '# Auto-Apply Log\n\n| Date | Company | Role | Status | URL | Notes |\n|------|---------|------|--------|-----|-------|\n';
  appendFileSync(APPLY_LOG, header + entry);
}

/**
 * Generate a report for this application.
 */
function generateApplyReport(job, result) {
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  const today = new Date().toISOString().split('T')[0];
  const slug = (job.company || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const num = getNextReportNum();
  const reportPath = join(REPORTS_DIR, `${String(num).padStart(3, '0')}-${slug}-${today}.md`);

  const report = `# Auto-Apply Report: ${job.company || 'Unknown'}

**Date:** ${today}
**Role:** ${job.role || 'Unknown'}
**URL:** ${job.url}
**Status:** ${result.status}
**Score:** ${job.score !== undefined ? job.score + '/5' : 'N/A'}

## Details

${result.message}

${result.details ? `\`\`\`json\n${JSON.stringify(result.details, null, 2)}\n\`\`\`` : ''}
`;

  writeFileSync(reportPath, report);
}

/**
 * Get next sequential report number.
 */
function getNextReportNum() {
  if (!existsSync(REPORTS_DIR)) return 1;
  const files = readdirSync(REPORTS_DIR).filter(f => f.match(/^\d{3}-/));
  return files.length + 1;
}

import { appendFileSync, readdirSync } from 'fs';

export default { runMassApply };
