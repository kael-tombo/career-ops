#!/usr/bin/env node

/**
 * scripts/multi-resume-autonomous.mjs — Multi-Resume Autonomous Pipeline
 *
 * Runs the full pipeline across ALL resume types simultaneously.
 * Each resume searches with its own queries, targets its own regions,
 * and applies with its own tailored CV.
 *
 * Usage:
 *   node scripts/multi-resume-autonomous.mjs
 *   node scripts/multi-resume-autonomous.mjs --scan-only
 *   node scripts/multi-resume-autonomous.mjs --eval-only
 *   node scripts/multi-resume-autonomous.mjs --apply-only
 *   node scripts/multi-resume-autonomous.mjs --regions "uae,europe"
 *   node scripts/multi-resume-autonomous.mjs --resume ai-llm-engineer
 *   node scripts/multi-resume-autonomous.mjs --dry-run
 *   node scripts/multi-resume-autonomous.mjs --list
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import {
  loadAllResumes,
  getResumeSearchWithCountries,
  getResumeSummary,
} from '../lib/resume-manager.mjs';
import { resolveRegionCountries } from '../lib/scan/scanner-core.mjs';

const ROOT = process.cwd();

function loadConfig() {
  const path = join(ROOT, 'config/profile.yml');
  if (!existsSync(path)) return {};
  try {
    return yaml.load(readFileSync(path, 'utf-8')) || {};
  } catch { return {}; }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    mode: 'full',
    regions: null,
    singleResume: null,
    dryRun: true,
    list: false,
    maxPerResume: 50,
    maxApply: 30,
    workers: 3,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--scan-only': opts.mode = 'scan'; break;
      case '--eval-only': opts.mode = 'evaluate'; break;
      case '--apply-only': opts.mode = 'apply'; break;
      case '--regions': opts.regions = args[++i] || null; break;
      case '--resume': opts.singleResume = args[++i] || null; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--live': opts.dryRun = false; break;
      case '--max-per-resume': opts.maxPerResume = parseInt(args[++i]) || 50; break;
      case '--max-apply': opts.maxApply = parseInt(args[++i]) || 30; break;
      case '--workers': opts.workers = parseInt(args[++i]) || 3; break;
      case '--list': opts.list = true; break;
      case '--help':
      case '-h': opts.help = true; break;
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
Usage: node scripts/multi-resume-autonomous.mjs [options]

Multi-Resume Autonomous Pipeline — runs all resume types in parallel.

Modes:
  (no flag)       Full pipeline: scan → evaluate → apply
  --scan-only     Scan only
  --eval-only     Evaluate only
  --apply-only    Apply only (tailor CV + submit)

Options:
  --regions         Override target regions (e.g. "uae,europe")
  --resume <id>     Single resume only (e.g. "ai-llm-engineer")
  --dry-run         Safe mode — fill forms but don't submit (default)
  --live            Live mode — auto-submit
  --max-per-resume  Max results per resume (default: 50)
  --max-apply       Total applications (default: 30)
  --list            List available resume types
  --help, -h        Show this help

Examples:
  node scripts/multi-resume-autonomous.mjs
  node scripts/multi-resume-autonomous.mjs --regions "uae,europe,north-america"
  node scripts/multi-resume-autonomous.mjs --resume ai-llm-engineer --live
  node scripts/multi-resume-autonomous.mjs --list
`);
}

async function listResumes() {
  console.log('\n📋 Available Resume Types:\n');
  const summary = getResumeSummary();
  for (const r of summary) {
    console.log(`  ${r.id}`);
    console.log(`    Label:    ${r.label}`);
    console.log(`    Level:    ${r.level}`);
    console.log(`    Fit:      ${r.fit}`);
    console.log(`    Queries:  ${r.queries}`);
    console.log(`    Regions:  ${r.regions.join(', ')}`);
    console.log(`    CV lines: ${r.contentLength}`);
    console.log('');
  }
}

async function main() {
  const opts = parseArgs();

  if (opts.help) { printHelp(); return; }
  if (opts.list) { listResumes(); return; }

  const config = loadConfig();
  const multiResumeConfig = config.multi_resume || {};
  const isMultiResume = multiResumeConfig.enabled !== false;

  const resumes = loadAllResumes();
  if (isMultiResume && resumes.length === 0) {
    console.error('❌ No resume files found in resumes/.');
    process.exit(1);
  }

  let searchConfigs = getResumeSearchWithCountries();

  if (opts.singleResume) {
    searchConfigs = searchConfigs.filter(c => c.resumeId === opts.singleResume);
    if (searchConfigs.length === 0) {
      console.error(`❌ Resume "${opts.singleResume}" not found. Use --list.`);
      process.exit(1);
    }
  }

  if (opts.regions) {
    const resolved = resolveRegionCountries(opts.regions.split(','));
    for (const cfg of searchConfigs) {
      cfg.countryCodes = resolved.codes || [];
    }
  }

  const modeLabel = opts.mode === 'full' ? 'Full Pipeline' :
    opts.mode === 'scan' ? 'Scan Only' :
    opts.mode === 'evaluate' ? 'Evaluate Only' : 'Apply Only';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🤖 MULTI-RESUME AUTONOMOUS — ${modeLabel}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Resumes:      ${isMultiResume ? resumes.length : 1}`);
  if (isMultiResume) {
    for (const r of resumes) {
      console.log(`   - ${r.label} (${r.fit})`);
    }
  }
  console.log(`   Dry run:      ${opts.dryRun ? 'YES (review mode)' : 'NO (live submit)'}`);
  console.log(`   Max/resume:   ${opts.maxPerResume}`);
  console.log(`   Max apply:    ${opts.maxApply}`);
  console.log(`   Time:         ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}`);

  const prevSafeMode = process.env.SAFE_MODE;
  process.env.SAFE_MODE = opts.dryRun ? 'true' : 'false';

  try {
    const pipe = await import('../lib/autonomous/pipeline.mjs');

    const pipelineOpts = {
      resumeSearchConfigs: isMultiResume ? searchConfigs : undefined,
      maxJobsPerResume: opts.maxPerResume,
      maxApply: opts.maxApply,
      workers: opts.workers,
      dryRun: opts.dryRun,
      minScore: parseFloat(process.env.MIN_SCORE || '3.5'),
      autoTailor: true,
      autoApply: opts.mode !== 'scan' && opts.mode !== 'evaluate',
    };

    switch (opts.mode) {
      case 'scan':
        await pipe.stageScan(pipelineOpts);
        break;
      case 'evaluate':
        await pipe.stageEvaluate(pipelineOpts);
        break;
      case 'apply':
        await pipe.stageApply(pipelineOpts);
        break;
      default:
        await pipe.runFullPipeline(pipelineOpts);
    }
  } finally {
    if (prevSafeMode === undefined) {
      delete process.env.SAFE_MODE;
    } else {
      process.env.SAFE_MODE = prevSafeMode;
    }
  }

  console.log('\n✅ Multi-resume autonomous run complete.');
}

main().catch(err => {
  console.error('❌ Multi-resume pipeline failed:', err.message);
  process.exit(1);
});
