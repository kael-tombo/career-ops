#!/usr/bin/env node
/**
 * scripts/scan-global.mjs — CLI entry point for global job discovery
 *
 * Usage:
 *   node scripts/scan-global.mjs [--queries "software engineer,data scientist"] [--countries US,GB,DE] [--max 5000] [--rpm 30] [--output pipeline]
 *
 * Options:
 *   --queries      Comma-separated job title queries (default: from profile.yml)
 *   --countries    Comma-separated ISO country codes (default: all 120+)
 *   --max          Max total results (default: 10000)
 *   --rpm          Max requests per minute (default: 60)
 *   --concurrency  Parallel workers (default: 5)
 *   --output       Where to write: pipeline (append to data/pipeline.md), json (stdout), both
 *   --dry-run      Just show capabilities and estimated coverage without running
 *   --save-stats   Save stats JSON to output/global-stats.json
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { parse } from 'yaml';
import { GlobalOrchestrator } from '../lib/global/global-orchestrator.mjs';
import { getCountryCodes, COUNTRIES } from '../lib/global/search-engines.mjs';

const ROOT = process.cwd();

// ─── Parse CLI args ───
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--queries': opts.queries = args[++i]?.split(',').map(s => s.trim()).filter(Boolean); break;
      case '--countries': opts.countries = args[++i]?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean); break;
      case '--max': opts.maxTotal = parseInt(args[++i]) || 10000; break;
      case '--rpm': opts.rpm = parseInt(args[++i]) || 60; break;
      case '--concurrency': opts.concurrency = parseInt(args[++i]) || 5; break;
      case '--output': opts.output = args[++i] || 'pipeline'; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--save-stats': opts.saveStats = true; break;
      case '--help':
      case '-h':
        console.log(`
🌍 Global Job Discovery Scanner

USAGE:
  node scripts/scan-global.mjs [options]

OPTIONS:
  --queries      Job title queries (default: from config/profile.yml)
  --countries    ISO country codes (default: all 120+ countries)
  --max          Max total results (default: 10000)
  --rpm          Max requests per minute (default: 60)
  --concurrency  Parallel workers (default: 5)
  --output       Write to: pipeline, json, both (default: pipeline)
  --dry-run      Show capabilities without running
  --save-stats   Save stats to output/global-stats.json
  --help         Show this help

EXAMPLES:
  node scripts/scan-global.mjs --queries "software engineer" --countries US,GB,DE --max 1000
  node scripts/scan-global.mjs --dry-run
  node scripts/scan-global.mjs --rpm 120 --concurrency 10 --output both
`);
        process.exit(0);
    }
  }

  return opts;
}

// ─── Load profile queries if not provided ───
function loadQueries(opts) {
  if (opts.queries && opts.queries.length > 0) return opts.queries;

  try {
    const profilePath = join(ROOT, 'config/profile.yml');
    if (existsSync(profilePath)) {
      const raw = readFileSync(profilePath, 'utf-8');
      const profile = parse(raw);
      const targetRoles = profile.target_roles || profile.targetRoles || [];
      if (targetRoles.length > 0) return targetRoles;
    }
  } catch { /* fallback */ }

  return ['software engineer', 'product manager', 'data scientist', 'designer', 'developer'];
}

// ─── Main ───
async function main() {
  const opts = parseArgs();
  const queries = loadQueries(opts);
  const countryCodes = opts.countries || getCountryCodes();
  const outputMode = opts.output || 'pipeline';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🌍 GLOBAL JOB DISCOVERY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Queries: ${queries.join(', ')}`);
  console.log(`   Countries: ${countryCodes.length}`);
  console.log(`   Max results: ${opts.maxTotal || 10000}`);
  console.log(`   RPM limit: ${opts.rpm || 60}`);
  console.log(`   Concurrency: ${opts.concurrency || 5}`);

  const orchestrator = new GlobalOrchestrator({
    queries,
    countryCodes,
    maxTotal: opts.maxTotal || 10000,
    maxPerSource: 100,
    concurrency: opts.concurrency || 5,
    rpm: opts.rpm || 60,
  });

  // Dry run: show capabilities
  if (opts.dryRun) {
    const caps = orchestrator.getCapabilities();
    console.log(`\n📊 Coverage Estimate:`);
    console.log(`   Search Engines: ${caps.searchEngines}`);
    console.log(`   Engine TLDs: ${caps.searchEngineTLDs}`);
    console.log(`   Countries: ${caps.countries}`);
    console.log(`   Job Boards: ${caps.jobBoards}`);
    console.log(`   Browser Fingerprints: ${caps.proxyFingerprints}`);
    console.log(`   Max RPM: ${caps.maxRPM}`);
    console.log(`   Sitemap Crawl Limit: ${caps.sitemapCrawlLimit.toLocaleString()} URLs`);
    console.log(`\n   Estimated total sources: ${(caps.searchEngineTLDs + caps.jobBoards + caps.sitemapCrawlLimit).toLocaleString()}`);
    console.log(`   Estimated unique jobs per sweep: ${(caps.countries * 50).toLocaleString()}+`);
    process.exit(0);
  }

  // Run
  try {
    const { jobs, stats } = await orchestrator.runFullSweep();

    console.log(`\n📊 Results Summary:`);
    console.log(`   Total unique jobs: ${jobs.length}`);
    console.log(`   Countries covered: ${stats.countriesCovered}`);
    console.log(`   Total sources: ${Object.values(stats.sourceBreakdown).reduce((a, b) => a + b, 0)}`);
    console.log(`   Time: ${((stats.endTime - stats.startTime) / 1000).toFixed(0)}s`);

    // Output to pipeline
    if (outputMode === 'pipeline' || outputMode === 'both') {
      const count = await appendToPipeline(jobs);
      console.log(`\n   ✅ ${count} jobs appended to data/pipeline.md`);
    }

    // Output as JSON
    if (outputMode === 'json' || outputMode === 'both') {
      const json = JSON.stringify({ jobs, stats, generatedAt: new Date().toISOString() }, null, 2);
      if (outputMode === 'json') {
        console.log(json);
      } else {
        const jsonPath = join(ROOT, `output/global-scan-${Date.now()}.json`);
        mkdirSync(dirname(jsonPath), { recursive: true });
        writeFileSync(jsonPath, json, 'utf-8');
        console.log(`   ✅ JSON saved to ${jsonPath}`);
      }
    }

    // Save stats
    if (opts.saveStats) {
      mkdirSync(join(ROOT, 'output'), { recursive: true });
      const statsPath = join(ROOT, 'output/global-stats.json');
      writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf-8');
      console.log(`   ✅ Stats saved to ${statsPath}`);
    }

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  } finally {
    await orchestrator.close();
  }
}

// ─── Append to pipeline ───
async function appendToPipeline(jobs) {
  const pipelinePath = join(ROOT, 'data/pipeline.md');

  // Read existing URLs to avoid duplicates
  const existingUrls = new Set();
  if (existsSync(pipelinePath)) {
    const content = readFileSync(pipelinePath, 'utf-8');
    const urlMatches = content.match(/^https?:\/\/[^\s]+/gm);
    if (urlMatches) {
      urlMatches.forEach(u => existingUrls.add(u.replace(/[|)\]]/g, '').trim()));
    }
  }
  mkdirSync(dirname(pipelinePath), { recursive: true });

  let added = 0;
  for (const job of jobs) {
    const cleanUrl = job.url.split('?')[0];
    if (!existingUrls.has(cleanUrl)) {
      const region = getRegion(job.countryCode || '');
      const tags = [];
      if (job.remote) tags.push('🌐 Remote');
      if (job.salary) tags.push('💰 Salary');
      tags.push(job.source || 'global-scan');

      const line = `- [${job.title}](${cleanUrl}) | ${job.company || 'Unknown'} | ${job.location || job.country || ''} | ${tags.join(', ')} | ${region} | ⏳ Pending\n`;
      appendFileSync(pipelinePath, line, 'utf-8');
      existingUrls.add(cleanUrl);
      added++;
    }
  }

  return added;
}

function getRegion(countryCode) {
  const regionMap = {
    US: 'AMERICAS', CA: 'AMERICAS', MX: 'AMERICAS',
    BR: 'AMERICAS', AR: 'AMERICAS', CL: 'AMERICAS',
    GB: 'EUROPE', DE: 'EUROPE', FR: 'EUROPE',
    JP: 'ASIA-PACIFIC', CN: 'ASIA-PACIFIC', IN: 'ASIA-PACIFIC',
    AU: 'ASIA-PACIFIC', NZ: 'ASIA-PACIFIC',
    ZA: 'AFRICA', NG: 'AFRICA', KE: 'AFRICA',
    AE: 'MIDDLE-EAST', SA: 'MIDDLE-EAST',
  };
  return regionMap[countryCode] || 'GLOBAL';
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
