/**
 * lib/autonomous/pipeline.mjs — Autonomous Pipeline Orchestrator
 *
 * The core 24/7 pipeline: scan → evaluate → score-check → tailor → apply → report
 *
 * Each stage is a separate async function so the daemon can run them
 * concurrently across multiple workers with independent concurrency limits.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { getDb, run, getAll, getOne } from '../db/index.mjs';
import { rateLimit, getRandomUA, getPlaywrightLaunchOptions, simulateHumanBehavior } from './anti-detect.mjs';
import { tailorCV, mdToPdf } from './tailor-cv.mjs';
import { getMemoryBriefing, learnFromEvaluation, getScoreAdjustment } from '../memory/index.mjs';
import { loadAllResumes, matchResumeToJob, getResumeById, getResumeSearchWithCountries, invalidateResumeCache } from '../resume-manager.mjs';
import { applyMinScoreFromEnv } from '../../policy.mjs';
import { fenceUntrusted, UNTRUSTED_GUARD } from '../ai/gemini.mjs';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const PIPELINE_PATH = join(ROOT, 'data/pipeline.md');
const TRACKER_PATH = join(ROOT, 'data/applications.md');
const REPORTS_DIR = join(ROOT, 'reports');
const SCAN_HISTORY_PATH = join(ROOT, 'data/scan-history.tsv');

const EVAL_MIN_SCORE = applyMinScoreFromEnv(); // policy.mjs — single source (default 4.0)
const MAX_APPLY_PER_RUN = parseInt(process.env.MAX_APPLY_PER_RUN || '10');
const PIPELINE_WORKERS = parseInt(process.env.PIPELINE_WORKERS || '3');

let emitEvent = null;

export function setEventEmitter(fn) {
  emitEvent = fn;
}

function emit(type, data) {
  if (emitEvent) {
    try { emitEvent(type, data); } catch { /* ignore */ }
  }
}

export const PIPELINE_DEFAULTS = {
  minScore: EVAL_MIN_SCORE,
  maxApply: MAX_APPLY_PER_RUN,
  workers: PIPELINE_WORKERS,
  autoTailor: true,
  autoApply: true,
  dryRun: true, // Blueprint P3 (D4): SAFE_MODE retired — callers resolve consent via lib/policy/engine.mjs
};

/**
 * Stage 1: Scan for new jobs.
 * Delegates to the existing scanner infrastructure.
 */
export async function stageScan(options = {}) {
  emit('pipeline:stage', { stage: 'scan', status: 'started' });
  console.log('\n🔍 [Pipeline] Stage 1: Scanning for new jobs...');

  const results = { portalJobs: 0, globalJobs: 0, totalNew: 0, errors: [] };

    try {
      let config, seenUrls;
      try {
        const mod = await import('../../scan-portals.mjs');
        config = mod.loadPortalsConfig();
        seenUrls = mod.getSeenUrls();
      } catch {
        config = { portals: [] };
        seenUrls = new Set();
        console.log('   ⚠️  portals.yml not found — skipping portal scan');
      }

    const portalResults = [];
    const { chromium } = await import('playwright');

    for (const portal of (config.portals || [])) {
      await rateLimit(portal.board_url || portal.url);
      let browser = null;
      try {
        browser = await chromium.launch(getPlaywrightLaunchOptions());
        const page = await browser.newPage();
        await page.setUserAgent(getRandomUA());
        await page.goto(portal.board_url || portal.url, { waitUntil: 'networkidle', timeout: 30000 });
        await simulateHumanBehavior(page);
        const content = await page.content();
        const urls = extractJobUrls(content, portal);
        for (const url of urls) {
          if (!seenUrls.has(url)) {
            portalResults.push({ url, source: portal.name || portal.url, company: portal.company || '' });
            addToPipeline(url, portal.company || '', '', portal.name || '');
            seenUrls.add(url);
          }
        }
      } catch (err) {
        results.errors.push({ portal: portal.name || portal.url, error: err.message });
      } finally {
        if (browser) await browser.close();
      }
    }
    results.portalJobs = portalResults.length;
    results.totalNew = portalResults.length;
  } catch (err) {
    results.errors.push({ phase: 'portal-scan', error: err.message });
  }

  try {
    // Multi-resume global search: run parallel sweeps for each resume type
    const resumeSearchConfigs = getResumeSearchWithCountries();
    const searchConfigs = options.resumeSearchConfigs || resumeSearchConfigs;

    if (searchConfigs.length === 0) {
      // Fallback: single generic search
      searchConfigs.push({
        resumeId: 'default',
        queries: options.queries || ['software engineer'],
        countryCodes: [],
      });
    }

    const allJobs = [];
    const { GlobalOrchestrator } = await import('../global/global-orchestrator.mjs');

    for (const cfg of searchConfigs) {
      const maxPerResume = options.maxJobsPerResume || 50;
      console.log(`   🔍 Search for "${cfg.label || cfg.resumeId}": ${cfg.queries.length} queries, ${cfg.countries.length || 'all'} countries`);

      try {
        const orch = new GlobalOrchestrator({
          queries: cfg.queries,
          maxTotal: maxPerResume,
          concurrency: options.concurrency || 2,
          rpm: options.rpm || 20,
          countryCodes: cfg.countryCodes,
        });
        const { jobs } = await orch.runFullSweep();

        for (const job of (jobs || [])) {
          job.resumeId = cfg.resumeId;
          job.resumeLabel = cfg.label;
          allJobs.push(job);
        }

        await orch.close();
      } catch (err) {
        results.errors.push({ phase: `global-sweep-${cfg.resumeId}`, error: err.message });
      }
    }

    for (const job of allJobs) {
      addToPipeline(job.url || job.link, job.company || '', job.title || '', 'global-sweep', job.resumeId);
    }
    results.globalJobs = allJobs.length;
    results.totalNew += allJobs.length;
  } catch (err) {
    results.errors.push({ phase: 'global-sweep', error: err.message });
  }

  results.newUrls = results.totalNew;
  emit('pipeline:stage', { stage: 'scan', status: 'complete', results });
  console.log(`   ✅ Scan complete: ${results.totalNew} new jobs found`);

  return results;
}

function extractJobUrls(html, portal) {
  const urls = [];
  const urlRegex = /(?:href|src)="(https?:\/\/[^"]*(?:careers?|job|position|opening|vacancy)[^"]*)"/gi;
  let match;
  while ((match = urlRegex.exec(html)) !== null) {
    const url = match[1].split('?')[0];
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

export function addToPipeline(url, company, role, source, resumeId) {
  const resumeTag = resumeId ? ` [${resumeId.toUpperCase()}]` : '';
  const entry = `- [ ] ${url} | ${company} | ${role} | ${source}${resumeTag}\n`;
  const dir = join(ROOT, 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const header = existsSync(PIPELINE_PATH) ? '' : '# Pipeline\n\n| URL | Company | Role | Source |\n|---|---|---|---|\n';
  appendFileSync(PIPELINE_PATH, header + entry);
}

/**
 * Stage 2: Evaluate pending pipeline items.
 * Reads pipeline.md, fetches JDs, evaluates via LLM, scores.
 */
export async function stageEvaluate(options = {}) {
  emit('pipeline:stage', { stage: 'evaluate', status: 'started' });
  console.log('\n📊 [Pipeline] Stage 2: Evaluating pending jobs...');

  if (!existsSync(PIPELINE_PATH)) {
    console.log('   ⏭️  No pipeline.md found');
    return { evaluated: 0, results: [] };
  }

  const content = readFileSync(PIPELINE_PATH, 'utf-8');
  const lines = content.split('\n').filter(l => l.match(/^\s*-\s*\[\s*[ x]?\s*\]?\s*(\S+)/));
  const pending = [];

  for (const line of lines) {
    const match = line.match(/^\s*-\s*\[\s*([ x]?)\s*\]\s*(\S+)\s*/);
    if (match) {
      const checked = match[1].trim() === 'x';
      const url = match[2];
      pending.push({ url, checked });
    }
  }

  if (pending.length === 0) {
    console.log('   ⏭️  No pending items');
    return { evaluated: 0, results: [] };
  }

  const results = [];
  let evaluated = 0;

  // Blueprint P4 (fleet): `options.urls` carries the Analyst agent's
  // priority-ordered, bounded batch. When present it is authoritative:
  // only those URLs are evaluated, in that order (bounded spend per cycle,
  // highest expected value first). Absent → the legacy cap-20 behavior.
  let batch;
  if (Array.isArray(options.urls) && options.urls.length > 0) {
    const wanted = new Map(options.urls.map((u, i) => [u, i]));
    batch = pending
      .filter(p => !p.checked && !p.evaluated && wanted.has(p.url))
      .sort((a, b) => wanted.get(a.url) - wanted.get(b.url));
  } else {
    batch = pending.filter(p => !p.checked && !p.evaluated).slice(0, 20);
  }

  for (const item of batch) {
    try {
      console.log(`   🔎 Evaluating: ${item.url.slice(0, 80)}...`);
      emit('pipeline:progress', { stage: 'evaluate', current: evaluated + 1, total: batch.length, url: item.url });

      const jd = await fetchJD(item.url);

      // Match to best resume persona FIRST — evaluation and tailoring must
      // agree on which persona this job is scored and pitched for.
      const resumeMatch = matchResumeToJob({
        url: item.url,
        company: item.company,
        role: item.role,
        description: jd,
      });
      item.desiredResumeId = resumeMatch.resumeId;

      let score = await evaluateJD(jd, item.url, resumeMatch);

      const adjustment = getScoreAdjustment({ company: item.company, role: item.role, keywords: extractKeywords(jd) });
      const adjustedScore = Math.min(5, Math.max(1, score + adjustment));
      if (Math.abs(adjustment) > 0.1) {
        console.log(`      📚 Memory adjustment: ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(2)} → ${adjustedScore.toFixed(1)} (was ${score.toFixed(1)})`);
      }
      score = adjustedScore;

      learnFromEvaluation({
        company: item.company || 'Unknown',
        role: item.role || 'Unknown',
        score,
        url: item.url,
        jdKeywords: extractKeywords(jd),
        source: 'autonomous-pipeline',
        resumeId: resumeMatch.resumeId,
      });

      item.evaluated = true;
      item.score = score;
      item.jd = jd;

      markPipelineEvaluated(item.url, item.score);
      results.push({
        url: item.url,
        score,
        status: score >= EVAL_MIN_SCORE ? 'eligible' : 'below-threshold',
        resumeId: resumeMatch.resumeId,
        resumeLabel: resumeMatch.resumeLabel,
      });
      evaluated++;

      await rateLimit(item.url);
    } catch (err) {
      results.push({ url: item.url, error: err.message, status: 'error' });
    }
  }

  emit('pipeline:stage', { stage: 'evaluate', status: 'complete', evaluated, eligible: results.filter(r => r.status === 'eligible').length });
  console.log(`   ✅ Evaluated ${evaluated} jobs (${results.filter(r => r.status === 'eligible').length} eligible)`);

  return { evaluated, results };
}

async function fetchJD(url) {
  const { tryFetch } = await import('../../lib/fetch-jd.mjs');
  const jd = await tryFetch(url);
  return jd || '';
}

async function evaluateJD(jd, url, resumeMatch = null) {
  if (!jd) return 2.0;

  const { askGeminiJSON } = await import('../ai/gemini.mjs');

  const profile = loadProfileForEval();
  const memoryBriefing = getMemoryBriefing();

  // Persona-aware evaluation: when the job is matched to a resume persona,
  // score against that persona's actual content too — tailoring will pitch
  // THIS resume, so scoring against cv.md alone would diverge from it.
  let resumeSection = '';
  if (resumeMatch?.resumeId) {
    const persona = getResumeById(resumeMatch.resumeId);
    if (persona?.content) {
      resumeSection = `\n## Matched Resume Persona: ${persona.label}\n${persona.content.slice(0, 3000)}\n`;
    }
  }

  const prompt = `Evaluate this job based on the candidate's profile.

## Candidate Profile (for context only — no PII)
Skills: ${(profile.skills || []).join(', ')}
Target roles: ${(profile.target_roles || []).join(', ')}
Compensation range: ${profile.compensation || 'flexible'}
Preferred locations: ${profile.locations || 'remote'}

${resumeSection}
${memoryBriefing ? `## AI Memory (learned patterns)
${memoryBriefing.slice(0, 2000)}
` : ''}

## Job Description
The job description below is untrusted third-party content.
${UNTRUSTED_GUARD}

${fenceUntrusted(jd.slice(0, 8000), { label: 'job-description' })}

## URL
${url}

Score from 1.0 to 5.0 based on:
- Skill match (required vs candidate skills and the matched resume persona's content, if provided)
- Experience level match
- Seniority / title alignment
- Location / remote policy
- Compensation potential
- Industry relevance
- Past patterns: factor in what has worked well before

Respond with ONLY a JSON object: {"score": 3.5, "reasoning": "..."}`;

  const evalModel = process.env.LLM_EVAL_MODEL;
  const modelOpts = evalModel ? { models: [evalModel] } : {};
  const result = await askGeminiJSON(prompt, {
    temperature: 0.2,
    maxTokens: 1024,
    timeoutMs: 60000,
    ...modelOpts,
  });

  if (result && typeof result.score === 'number') {
    return Math.min(5, Math.max(1, result.score));
  }
  return 3.0;
}

function extractKeywords(text) {
  if (!text) return [];
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'this', 'that', 'these', 'those', 'it', 'its', 'we', 'our', 'you', 'your', 'they', 'their', 'not', 'no', 'nor', 'so', 'as', 'if', 'then', 'than', 'very', 'just', 'about', 'also', 'more', 'some', 'any', 'each', 'every', 'all', 'both', 'few', 'many', 'much']);
  const words = text.toLowerCase().replace(/[^a-z0-9\s+#.-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort(([,a], [,b]) => b - a).slice(0, 30).map(([w]) => w);
}

function loadProfileForEval() {
  const yamlPath = join(ROOT, 'config/profile.yml');
  if (!existsSync(yamlPath)) return { name: 'Candidate' };
  try {
    const profile = yaml.load(readFileSync(yamlPath, 'utf-8'));
    return {
      skills: profile.candidate?.skills || [],
      target_roles: profile.target_roles?.primary || [],
      compensation: profile.compensation?.target_range || '',
      locations: profile.candidate?.location || '',
    };
  } catch {
    return {};
  }
}

function markPipelineEvaluated(url, score) {
  if (!existsSync(PIPELINE_PATH)) return;
  let content = readFileSync(PIPELINE_PATH, 'utf-8');
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  content = content.replace(
    new RegExp(`(- \\[ \\]\\s*)(${escaped})`, 'g'),
    `- [x] $2 [${score ? score.toFixed(1) : 'EVALUATED'}]`
  );
  writeFileSync(PIPELINE_PATH, content);
}

/**
 * Stage 3: Apply to eligible jobs (score >= threshold).
 * Tailor CV → apply → generate report.
 */
export async function stageApply(options = {}) {
  emit('pipeline:stage', { stage: 'apply', status: 'started' });
  console.log('\n🚀 [Pipeline] Stage 3: Applying to eligible jobs...');

  const minScore = options.minScore ?? PIPELINE_DEFAULTS.minScore;
  const maxApply = options.maxApply ?? PIPELINE_DEFAULTS.maxApply;
  const autoTailor = options.autoTailor ?? PIPELINE_DEFAULTS.autoTailor;
  const autoApply = options.autoApply ?? PIPELINE_DEFAULTS.autoApply;
  const dryRun = options.dryRun ?? PIPELINE_DEFAULTS.dryRun;

  const results = { applied: 0, skipped: 0, failed: 0, tailored: 0, reports: 0, details: [] };
  let appliedCount = 0;

    const eligible = loadEligibleJobs(minScore);

  if (eligible.length === 0) {
    console.log('   ⏭️  No eligible jobs found');
    emit('pipeline:stage', { stage: 'apply', status: 'complete', results });
    return results;
  }

  console.log(`   🎯 ${eligible.length} eligible jobs (applying to top ${Math.min(maxApply, eligible.length)})`);

  const resumes = loadAllResumes();
  console.log(`   📋 ${resumes.length} resume types available for tailoring`);

  for (const job of eligible) {
    if (appliedCount >= maxApply) {
      console.log(`   ⏸️  Max apply limit reached (${maxApply})`);
      results.skipped += eligible.length - appliedCount;
      break;
    }

    emit('pipeline:progress', { stage: 'apply', current: appliedCount + 1, total: Math.min(maxApply, eligible.length), company: job.company, role: job.role });

    const logEntry = { company: job.company || 'Unknown', role: job.role || 'Unknown', url: job.url, score: job.score };

    try {
      if (autoTailor) {
        const desc = job.description || '';

        // Use resume-matched CV if available, otherwise fall through to default
        const tailorResult = await tailorCV({
          company: job.company,
          role: job.role,
          url: job.url,
          description: desc,
          resumeId: job.desiredResumeId || job.resumeId,
        });

        if (tailorResult.success) {
          results.tailored++;
          logEntry.resumeUsed = tailorResult.resumeUsed;
          const pdfPath = await mdToPdf(tailorResult.tailoredPath);
          job.tailoredPdf = pdfPath || tailorResult.tailoredPath;
        }
      }

      if (autoApply) {
        const { applyToJob, loadProfile, findResumeFiles } = await import('../auto-apply/apply-engine.mjs');
        const profile = loadProfile();
        const resumePath = job.tailoredPdf || findResumeFiles()[0] || '';

          const applyResult = await applyToJob(job.url, {
            dryRun,
            profile,
            resumePath,
            timeout: 45000,
          });

          learnFromOutcome({
            company: job.company || 'Unknown',
            role: job.role || 'Unknown',
            outcome: applyResult.success ? (dryRun ? 'evaluated' : 'applied') : 'skipped',
            score: job.score,
            notes: applyResult.message,
            resumeId: job.desiredResumeId || job.resumeId,
          });

          if (applyResult.success) {
            results.applied++;
            appliedCount++;
            generateApplyReport(job, applyResult);
            results.reports++;
            updateTracker(job, applyResult);
            logApplication(job, applyResult);

            logEntry.status = dryRun ? 'ready-for-review' : 'submitted';
            logEntry.message = applyResult.message;
          } else {
            results.failed++;
            logEntry.status = 'failed';
            logEntry.message = applyResult.message;
          }
      } else {
        results.skipped++;
        logEntry.status = 'skipped (auto-apply disabled)';
      }
    } catch (err) {
      results.failed++;
      logEntry.status = 'error';
      logEntry.message = err.message;
    }

    results.details.push(logEntry);

    if (appliedCount < Math.min(maxApply, eligible.length)) {
      await rateLimit(job.url, { minDelay: 5000, maxDelay: 12000 });
    }
  }

  emit('pipeline:stage', { stage: 'apply', status: 'complete', results });
  console.log(`   ✅ Applied: ${results.applied} | Tailored: ${results.tailored} | Failed: ${results.failed} | Skipped: ${results.skipped}`);

  return results;
}

function loadEligibleJobs(minScore) {
  const jobs = [];

  if (existsSync(PIPELINE_PATH)) {
    const content = readFileSync(PIPELINE_PATH, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*-\s*\[\s*x\s*\]\s*(\S+)\s*(?:\[([\d.]+)\])?\s*\|([^|]*)\|([^|]*)\|(.+)/);
      if (match) {
        const source = (match[5] || '').trim();
        const resumeIdMatch = source.match(/\[([A-Z_]+)\]$/);
        jobs.push({
          url: match[1].trim(),
          company: match[3].trim(),
          role: match[4].trim(),
          score: match[2] ? parseFloat(match[2]) : 4.0,
          description: '',
          desiredResumeId: resumeIdMatch ? resumeIdMatch[1].toLowerCase() : null,
        });
      }
    }
  }

  return jobs.sort((a, b) => (b.score || 0) - (a.score || 0));
}

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
**Score:** ${job.score ? `${job.score}/5` : 'N/A'}
**Status:** ${result.status}
**Tailored CV:** ${job.tailoredPdf || 'No'}

## Pipeline Result

${result.message}

${result.details ? `\`\`\`json\n${JSON.stringify(result.details, null, 2)}\n\`\`\`` : ''}
`;

  writeFileSync(reportPath, report);
}

function updateTracker(job, result) {
  const today = new Date().toISOString().split('T')[0];
  const slug = (job.company || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const num = getNextReportNum();

  // [resume:<id>] is a machine-readable attribution marker — the DB seed
  // strips it from Notes and stores it in applications.resume_id, so the
  // dashboard can attribute applications to the persona that was used.
  const resumeMarker = job.desiredResumeId || job.resumeId || '';
  const notes = `Auto-applied via pipeline${resumeMarker ? ` [resume:${resumeMarker}]` : ''}`;

  const entry = `\n| ${num} | ${today} | ${job.company || 'Unknown'} | ${job.role || 'Unknown'} | ${result.status === 'submitted' ? 'Applied' : 'Evaluated'} | ${job.score ? `${job.score}/5` : 'N/A'} | ✅ | [${num}](reports/${String(num).padStart(3, '0')}-${slug}-${today}.md) | ${notes} |`;

  if (!existsSync(TRACKER_PATH)) {
    writeFileSync(TRACKER_PATH, `# Applications Tracker\n\n| # | Date | Company | Role | Status | Score | PDF | Report | Notes |\n|---|------|---------|------|--------|-------|-----|--------|-------|${entry}\n`);
  } else {
    appendFileSync(TRACKER_PATH, entry);
  }
}

function logApplication(job, result) {
  const logPath = join(ROOT, 'data/auto-apply-log.md');
  const today = new Date().toISOString().split('T')[0];
  const entry = `| ${today} | ${job.company || 'Unknown'} | ${job.role || 'Unknown'} | ${result.status} | ${job.url} | ${result.message} |\n`;
  const header = existsSync(logPath) ? '' : '# Auto-Apply Log\n\n| Date | Company | Role | Status | URL | Notes |\n|------|---------|------|--------|-----|-------|\n';
  appendFileSync(logPath, header + entry);
}

function getNextReportNum() {
  if (!existsSync(REPORTS_DIR)) return 1;
  const files = readdirSync(REPORTS_DIR).filter(f => f.match(/^\d{3}-/));
  return files.length + 1;
}

/**
 * Run the full pipeline: scan → evaluate → apply.
 */
export async function runFullPipeline(options = {}) {
  console.log('\n═══════════════════════════════════════════════');
  console.log('🤖 Autonomous Pipeline — Full Run');
  console.log('═══════════════════════════════════════════════');
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`   Workers: ${options.workers || PIPELINE_DEFAULTS.workers}`);
  console.log(`   Min Score: ${options.minScore ?? PIPELINE_DEFAULTS.minScore}`);
  console.log(`   Max Apply: ${options.maxApply ?? PIPELINE_DEFAULTS.maxApply}`);
  console.log(`   Dry Run: ${options.dryRun ?? PIPELINE_DEFAULTS.dryRun}\n`);

  emit('pipeline:start', { timestamp: new Date().toISOString(), options });

  const scanResult = await stageScan(options);
  emit('pipeline:scan-done', scanResult);

  // Blueprint P4 (fleet): when `options.fleet` is set, the fleet cycle owns
  // what gets evaluated this cycle — Scout triages the post-scan queue
  // (dedupe + stale archive) and the Analyst selects the bounded,
  // priority-ordered batch. The batch is authoritative (`urls`): bounded
  // LLM spend, highest expected value first. Any fleet failure degrades to
  // the legacy cap-20 path — the fleet never blocks the pipeline. Dynamic
  // import avoids a static cycle (cycle.mjs only imports back on evaluate).
  let evalOptions = options;
  let skipEvaluation = false;
  if (options.fleet) {
    try {
      const { runFleetCycle } = await import('../fleet/cycle.mjs');
      const cycle = await runFleetCycle({
        evaluate: false,
        scoutApply: options.fleetScoutApply === true,
        batchLimit: options.fleetBatchLimit,
      });
      if (Array.isArray(cycle.analystBatch) && cycle.analystBatch.length > 0) {
        evalOptions = { ...options, urls: cycle.analystBatch };
        console.log(`   🤖 Fleet: Scout ${cycle.scout.ok ? 'triaged' : 'failed'}, Analyst selected ${cycle.analystBatch.length} entr(y/ies) for evaluation`);
      }
      if (cycle.evaluateAllowed === false) {
        // Operator's daily budget gate (R5): spend stops for today.
        skipEvaluation = true;
        console.log(`   ⏸️  Fleet: ${cycle.gateReason || 'evaluation gated by Operator'} — evaluation skipped this cycle`);
      }
    } catch (err) {
      console.log(`   ⚠️  Fleet cycle skipped: ${err.message} (legacy evaluation continues)`);
    }
  }

  const evalResult = skipEvaluation
    ? { evaluated: 0, results: [], skipped: 'fleet-budget' }
    : await stageEvaluate(evalOptions);
  emit('pipeline:eval-done', evalResult);

  const applyResult = await stageApply(options);
  emit('pipeline:apply-done', applyResult);

  const summary = {
    timestamp: new Date().toISOString(),
    newJobs: scanResult.totalNew || 0,
    evaluated: evalResult.evaluated || 0,
    applied: applyResult.applied || 0,
    tailored: applyResult.tailored || 0,
    failed: applyResult.failed || 0,
    errors: [
      ...(scanResult.errors || []),
      ...(evalResult.results || []).filter(r => r.status === 'error'),
      ...(applyResult.details || []).filter(d => d.status === 'error' || d.status === 'failed'),
    ],
  };

  emit('pipeline:complete', summary);

  console.log('\n═══════════════════════════════════════════════');
  console.log('📊 Pipeline Summary');
  console.log('═══════════════════════════════════════════════');
  console.log(`   New jobs found:     ${summary.newJobs}`);
  console.log(`   Evaluated:          ${summary.evaluated}`);
  console.log(`   CVs tailored:       ${summary.tailored}`);
  console.log(`   Applications sent:  ${summary.applied}`);
  console.log(`   Failed:             ${summary.failed}`);
  console.log(`   Errors:             ${summary.errors.length}`);
  console.log('═══════════════════════════════════════════════\n');

  return summary;
}

export default { runFullPipeline, stageScan, stageEvaluate, stageApply, setEventEmitter, addToPipeline };
