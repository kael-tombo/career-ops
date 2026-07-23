#!/usr/bin/env node

/**
 * scripts/apply-all.mjs — Mass Auto-Apply CLI
 *
 * Applies to pipeline entries that meet the score threshold.
 * SAFE MODE by default: opens browser for manual review.
 * Set SAFE_MODE=false to auto-submit.
 *
 * Usage:
 *   node scripts/apply-all.mjs                  # Review mode (opens browser)
 *   SAFE_MODE=false node scripts/apply-all.mjs  # Auto-submit
 *   node scripts/apply-all.mjs --min 4.0         # Only apply to 4.0+ scores
 *   node scripts/apply-all.mjs --limit 5         # Max 5 applications
 *   node scripts/apply-all.mjs --dry-run         # Test run, no browser
 */

import { runMassApply } from '../lib/auto-apply/mass-apply.mjs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const PIPELINE_PATH = join(ROOT, 'data/pipeline.md');
const TRACKER_PATH = join(ROOT, 'data/applications.md');

const args = process.argv.slice(2);
const opts = {
  minScore: parseFloat(process.env.MIN_SCORE || '3.5'),
  dailyLimit: parseInt(process.env.DAILY_LIMIT || '10'),
  dryRun: process.env.SAFE_MODE !== 'false',
  maxJobs: 50,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--min') opts.minScore = parseFloat(args[++i]) || 3.5;
  else if (args[i] === '--limit') opts.dailyLimit = parseInt(args[++i]) || 10;
  else if (args[i] === '--max') opts.maxJobs = parseInt(args[++i]) || 50;
  else if (args[i] === '--dry-run') opts.dryRun = true;
  else if (args[i] === '--auto') opts.dryRun = false;
}

console.log(`🤖 Career-OPS Mass Auto-Apply
   Mode: ${opts.dryRun ? '🔍 DRY RUN (review only)' : '🚀 AUTO-SUBMIT'}
   Min score: ${opts.minScore}
   Daily limit: ${opts.dailyLimit}
   Max jobs: ${opts.maxJobs}
`);

// Load jobs from pipeline
const pipelineJobs = loadPipelineJobs();
console.log(`📋 Pipeline: ${pipelineJobs.length} entries`);

// Load scored applications from tracker
const trackerJobs = loadTrackerJobs();
console.log(`📋 Tracker: ${trackerJobs.length} evaluated entries`);

// Merge: use tracker scores for pipeline jobs
const jobMap = new Map();
for (const j of trackerJobs) {
  jobMap.set(j.url.split('?')[0], j.score);
}

const jobsToApply = pipelineJobs
  .filter(j => j.url)
  .map(j => ({
    url: j.url,
    company: j.company,
    role: j.role,
    score: jobMap.get(j.url.split('?')[0]) || 0,
  }))
  .filter(j => j.score >= opts.minScore)
  .slice(0, opts.maxJobs);

console.log(`🎯 Jobs meeting threshold (≥${opts.minScore}): ${jobsToApply.length}`);

if (jobsToApply.length === 0) {
  console.log('No jobs to apply to. Run a scan or add pipeline entries first.');
  process.exit(0);
}

// Confirm
console.log('\nFirst 5 targets:');
jobsToApply.slice(0, 5).forEach(j => {
  console.log(`   ${j.company || '?'} - ${j.role || '?'} (${j.score})`);
});

if (!opts.dryRun && !process.env.CI) {
  console.log('\n⚠️  Auto-submit is enabled. Applications will be sent.');
}

runMassApply(jobsToApply, {
  dryRun: opts.dryRun,
  dailyLimit: opts.dailyLimit,
  minScore: opts.minScore,
}).then(result => {
  console.log(`\n✨ Done: ${result.applied} applied, ${result.skipped} skipped, ${result.failed} failed`);
  process.exit(0);
}).catch(err => {
  console.error('❌ Apply failed:', err.message);
  process.exit(1);
});

// ─── Helpers ─────────────────────────────────────────────────────────

function loadPipelineJobs() {
  if (!existsSync(PIPELINE_PATH)) return [];
  const content = readFileSync(PIPELINE_PATH, 'utf-8');
  const jobs = [];

  for (const line of content.split('\n')) {
    const match = line.match(/^\s*-\s*\[\s*[ x]?\s*\]\s*(\S+)\s*\|\s*([^|]+)\s*\|\s*(.+)$/);
    if (match) {
      jobs.push({
        url: match[1].trim(),
        company: match[2].trim(),
        role: match[3].trim().replace(/\s*\[[A-Z-]+\]$/, '').trim(),
      });
    }
  }

  return jobs;
}

function loadTrackerJobs() {
  if (!existsSync(TRACKER_PATH)) return [];
  const content = readFileSync(TRACKER_PATH, 'utf-8');
  const jobs = [];

  for (const line of content.split('\n')) {
    const parts = line.split('|').map(s => s.trim());
    // Format: | # | Date | Company | Role | Score | Status | PDF | Report | Notes |
    if (parts.length >= 6 && parts[1].match(/^\d+$/)) {
      const reportMatch = parts[7]?.match(/\[(\d+)\]\(([^)]+)\)/);
      jobs.push({
        url: reportMatch ? reportMatch[2] : '',
        company: parts[3] || '',
        role: parts[4] || '',
        score: parseFloat(parts[5]) || 0,
      });
    }
  }

  return jobs;
}
