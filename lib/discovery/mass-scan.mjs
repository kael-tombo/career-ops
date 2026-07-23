/**
 * lib/discovery/mass-scan.mjs — Mass Job Discovery Orchestrator
 *
 * Discovers job opportunities from ALL available sources:
 * 1. Configured portals (portals.yml)
 * 2. Auto-discovered companies (Google search)
 * 3. Job board searches (LinkedIn, Indeed, Google Jobs)
 * 4. Company career page crawls
 *
 * Deduplicates, scores, and pushes results into the pipeline.
 */

import { loadPortalsConfig } from '../scan/scanner-core.mjs';
import { scrapeJobs } from '../scraper/scrape-jobs.mjs';
import { searchAllSources, buildSearchQueries, discoverCompanyPages } from './search-jobs.mjs';
import { chromium } from 'playwright';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

const ROOT = process.cwd();
const PORTALS_PATH = join(ROOT, 'portals.yml');
const PIPELINE_PATH = join(ROOT, 'data/pipeline.md');
const HISTORY_PATH = join(ROOT, 'data/scan-history.tsv');

const DEFAULT_MAX_JOBS = 500;
const DEFAULT_TIMEOUT = 20000;

/**
 * Run a comprehensive mass scan across all discovery sources.
 * @param {object} [options] - { maxJobs, region, timeout, browser }
 * @returns {Promise<{total: number, sources: object, jobs: Array}>}
 */
export async function runMassScan(options = {}) {
  const maxJobs = options.maxJobs || DEFAULT_MAX_JOBS;
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const browser = options.browser || await chromium.launch({ headless: true });
  const seenUrls = loadSeenUrls();
  const allJobs = [];
  const sourceCounts = {};

  console.log('\n🔍 Career-OPS Mass Discovery Scan\n');

  try {
    // ─── Source 1: Configured portals ──────────────────────────────
    if (existsSync(PORTALS_PATH)) {
      console.log('📡 Scanning configured portals...');
      const config = loadPortalsConfig();
      const portals = config.portals || [];

      for (const portal of portals) {
        const companies = portal.companies || [];
        for (const company of companies.slice(0, 20)) {
          const url = company.careers_url || company.api;
          if (!url) continue;
          try {
            const jobs = await scrapeJobs(company, {}, { browser, timeout });
            const newJobs = jobs.filter(j => !seenUrls.has(j.url.split('?')[0])).slice(0, 10);
            for (const j of newJobs) {
              seenUrls.add(j.url.split('?')[0]);
              allJobs.push({ ...j, source: `portal:${company.name}` });
            }
            sourceCounts[`portal:${company.name}`] = newJobs.length;
          } catch {}
        }
      }
    }

    // ─── Source 2: Job board searches ──────────────────────────────
    console.log('🌐 Searching job boards...');
    const queries = buildSearchQueries();
    const searchResults = await searchAllSources(queries, { browser, maxResults: 200 });

    for (const j of searchResults) {
      const key = j.url.split('?')[0];
      if (!seenUrls.has(key)) {
        seenUrls.add(key);
        allJobs.push(j);
        sourceCounts[j.source] = (sourceCounts[j.source] || 0) + 1;
      }
    }

    // ─── Source 3: Discover companies from portals + search ────────
    // Extract company names from found jobs and try to discover their career pages
    const foundCompanies = [...new Set(allJobs.map(j => j.company).filter(Boolean))];
    if (foundCompanies.length > 0) {
      console.log(`🏢 Discovering career pages for ${foundCompanies.length} companies...`);
      const discovered = await discoverCompanyPages(foundCompanies.slice(0, 30), { browser });

      for (const dc of discovered) {
        try {
          const jobs = await scrapeJobs({ careers_url: dc.careersUrl, name: dc.name }, {}, { browser, timeout });
          const newJobs = jobs.filter(j => !seenUrls.has(j.url.split('?')[0])).slice(0, 5);
          for (const j of newJobs) {
            seenUrls.add(j.url.split('?')[0]);
            allJobs.push({ ...j, source: `discovered:${dc.name}` });
          }
          sourceCounts[`discovered:${dc.name}`] = newJobs.length;
        } catch {}
      }
    }

  } finally {
    if (!options.browser) await browser.close();
  }

  // Dedup and deduplicate by URL
  const seen = new Set();
  const uniqueJobs = allJobs.filter(j => {
    const key = j.url.split('?')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by freshness (jobs with company names first, then with descriptions)
  const scored = uniqueJobs.map(j => ({
    ...j,
    _score: (j.company ? 2 : 0) + (j.location ? 1 : 0) + (j.department ? 1 : 0),
  }));
  scored.sort((a, b) => b._score - a._score);

  const finalJobs = scored.slice(0, maxJobs);

  // Save to pipeline
  await appendToPipeline(finalJobs);

  // Update scan history
  saveScanHistory(finalJobs);

  console.log(`\n✅ Mass scan complete: ${finalJobs.length} new jobs from ${Object.keys(sourceCounts).length} sources`);
  for (const [src, count] of Object.entries(sourceCounts)) {
    if (count > 0) console.log(`   ${src}: ${count} jobs`);
  }

  return {
    total: finalJobs.length,
    sources: sourceCounts,
    jobs: finalJobs,
  };
}

/**
 * Load seen URLs from scan history.
 */
function loadSeenUrls() {
  if (!existsSync(HISTORY_PATH)) return new Set();
  const seen = new Set();
  const content = readFileSync(HISTORY_PATH, 'utf-8');
  for (const line of content.split('\n')) {
    const url = line.trim().split('\t')[0];
    if (url) seen.add(url.split('?')[0]);
  }
  return seen;
}

/**
 * Append discovered jobs to pipeline.md.
 */
async function appendToPipeline(jobs) {
  if (jobs.length === 0) return;
  const rows = jobs.map(j =>
    `- [ ] ${j.url} | ${j.company || 'Unknown'} | ${j.title} [SEARCHED]`
  ).join('\n');
  const separator = existsSync(PIPELINE_PATH) ? '\n' : '';
  appendFileSync(PIPELINE_PATH, separator + rows);
}

/**
 * Save scan history.
 */
function saveScanHistory(jobs) {
  if (jobs.length === 0) return;
  const today = new Date().toISOString().split('T')[0];
  const rows = jobs.map(j =>
    `${j.url}\t${today}\t${j.source}\t${j.title}\t${j.company || ''}\tadded`
  ).join('\n');
  const separator = existsSync(HISTORY_PATH) ? '\n' : '';
  appendFileSync(HISTORY_PATH, separator + rows);
}

/**
 * CLI entry point.
 */
export async function main() {
  const opts = parseArgs();
  const result = await runMassScan({ maxJobs: opts.maxJobs, region: opts.region });
  process.exit(0);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { maxJobs: DEFAULT_MAX_JOBS, region: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max') opts.maxJobs = parseInt(args[++i]) || DEFAULT_MAX_JOBS;
    if (args[i] === '--region') opts.region = args[++i]?.toLowerCase();
  }
  return opts;
}

// Run as CLI
if (process.argv[1]?.endsWith('mass-scan.mjs')) {
  main().catch(console.error);
}

export default { runMassScan };
