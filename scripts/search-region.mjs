#!/usr/bin/env node

/**
 * scripts/search-region.mjs — Multi-region global job discovery
 *
 * Maps named regions (UAE, North America, Europe, etc.) to ISO country codes
 * and runs the GlobalOrchestrator against those countries only.
 * Tags each result with its region and appends to the pipeline.
 *
 * Usage:
 *   node scripts/search-region.mjs --regions "uae,north-america,europe"
 *   node scripts/search-region.mjs --regions "middle-east,south-america,asia"
 *   node scripts/search-region.mjs --list-regions
 *   node scripts/search-region.mjs --regions "africa" --max 200
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { loadRegions, resolveRegionCountries, appendToPipeline, listRegions } from '../lib/scan/scanner-core.mjs';
import { GlobalOrchestrator } from '../lib/global/global-orchestrator.mjs';
import { getCountryCodes } from '../lib/global/search-engines.mjs';

const ROOT = process.cwd();
const PROFILE_PATH = join(ROOT, 'config/profile.yml');

function loadSearchQueries() {
  if (!existsSync(PROFILE_PATH)) return ['software engineer'];
  try {
    const raw = readFileSync(PROFILE_PATH, 'utf-8');
    const profile = yaml.load(raw);
    const roles = profile.target_roles?.primary || [];
    if (roles.length > 0) {
      return roles.map(r => {
        const cleaned = r.replace(/^(Senior|Lead|Principal|Staff|Junior|Mid-?)\s+/i, '').trim();
        return cleaned || r;
      });
    }
    const archetypes = profile.target_roles?.archetypes || [];
    const names = archetypes.filter(a => a.fit === 'primary' || a.fit === 'secondary').map(a => a.name);
    if (names.length > 0) return names.map(n => n.replace(/^(Senior|Lead|Principal|Staff|Junior|Mid-?)\s+/i, '').trim());
    return ['software engineer'];
  } catch {
    return ['software engineer'];
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { regions: [], listRegions: false, maxTotal: 500, concurrency: 3, rpm: 20 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--regions' || args[i] === '--region') {
      opts.regions = (args[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    } else if (args[i] === '--list-regions') {
      opts.listRegions = true;
    } else if (args[i] === '--max') {
      opts.maxTotal = parseInt(args[++i]) || 500;
    } else if (args[i] === '--concurrency') {
      opts.concurrency = parseInt(args[++i]) || 3;
    } else if (args[i] === '--rpm') {
      opts.rpm = parseInt(args[++i]) || 20;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: node scripts/search-region.mjs [options]

Options:
  --regions <list>    Comma-separated region keys (e.g. "uae,north-america,europe")
  --list-regions      Show available regions and exit
  --max <n>           Max total results (default: 500)
  --concurrency <n>   Parallel search tasks (default: 3)
  --rpm <n>           Requests per minute limit (default: 20)
  --help, -h          Show this help

Examples:
  node scripts/search-region.mjs --regions "uae,north-america,south-america"
  node scripts/search-region.mjs --regions "middle-east,europe,asia" --max 1000
  node scripts/search-region.mjs --list-regions
`);
      process.exit(0);
    }
  }
  return opts;
}

async function listAvailableRegions() {
  await listRegions();
}

async function main() {
  const opts = parseArgs();

  if (opts.listRegions) {
    await listAvailableRegions();
    return;
  }

  if (opts.regions.length === 0) {
    console.error('❌ No regions specified. Use --regions "uae,north-america" or --list-regions');
    process.exit(1);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('🌍 MULTI-REGION GLOBAL SEARCH');
  console.log(`${'='.repeat(60)}`);

  const resolved = resolveRegionCountries(opts.regions);

  if (resolved.missing.length > 0) {
    console.warn(`\n⚠️  Unknown regions: ${resolved.missing.join(', ')}`);
    console.warn('   Use --list-regions to see available regions.');
  }

  if (resolved.codes.length === 0 && resolved.missing.length === 0) {
    console.log('\nℹ️  All selected regions have empty country_codes (e.g. "global").');
    console.log('   Falling back to ALL countries.\n');
  }

  console.log(`\n📋 Regions selected: ${Object.keys(resolved.regionLabels).join(', ')}`);
  console.log(`   Countries to search: ${resolved.codes.length > 0 ? resolved.codes.join(', ') : 'ALL'}`);
  console.log(`   Max results: ${opts.maxTotal}`);

  const queries = loadSearchQueries();
  console.log(`   Search queries: ${queries.join(', ')}`);

  // Build country codes: use resolved codes if non-empty, otherwise ALL
  const countryCodes = resolved.codes.length > 0
    ? resolved.codes
    : getCountryCodes();

  // Run the global orchestrator
  const orchestrator = new GlobalOrchestrator({
    queries,
    maxTotal: opts.maxTotal,
    concurrency: opts.concurrency,
    rpm: opts.rpm,
    countryCodes,
  });

  try {
    const { jobs, stats } = await orchestrator.runFullSweep();

    if (jobs.length === 0) {
      console.log('\n⚠️  No jobs found. Try expanding your regions or queries.');
      return;
    }

    // Tag each job with its region(s) based on countryCode
    const regionTagMap = {};
    const allRegions = loadRegions();
    for (const [key, label] of Object.entries(resolved.regionLabels)) {
      const region = allRegions[key];
      if (region?.country_codes) {
        for (const code of region.country_codes) {
          regionTagMap[code] = { tag: `[${key.toUpperCase()}]`, label };
        }
      }
    }

    const taggedJobs = jobs.map(job => {
      const regionInfo = regionTagMap[job.countryCode];
      return {
        ...job,
        regionTag: regionInfo ? regionInfo.tag : '',
        regionLabel: regionInfo ? regionInfo.label : 'Unknown',
      };
    });

    // Append to pipeline, grouped by region
    for (const regionKey of Object.keys(resolved.regionLabels)) {
      const regionJobs = taggedJobs.filter(
        j => j.regionTag === `[${regionKey.toUpperCase()}]`
      );
      if (regionJobs.length === 0) continue;

      const tag = `[${regionKey.toUpperCase()}]`;
      appendToPipeline(
        regionJobs.map(j => ({
          url: j.url,
          company: j.company || 'Unknown',
          title: j.title,
          location: j.location || '',
        })),
        tag
      );
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 REGION SEARCH SUMMARY');
    console.log(`${'='.repeat(60)}`);

    const perRegion = {};
    for (const regionKey of Object.keys(resolved.regionLabels)) {
      const count = taggedJobs.filter(j => j.regionTag === `[${regionKey.toUpperCase()}]`).length;
      perRegion[regionKey] = count;
    }

    for (const [key, count] of Object.entries(perRegion)) {
      const label = resolved.regionLabels[key] || key;
      console.log(`   ${label.padEnd(35)} ${count} jobs`);
    }

    console.log(`\n   ${'─'.repeat(50)}`);
    console.log(`   TOTAL${' '.repeat(31)} ${jobs.length} jobs across ${stats.countriesCovered} countries`);
    console.log(`   Time: ${((stats.endTime - stats.startTime) / 1000).toFixed(0)}s`);
    console.log(`   Source breakdown:`, stats.sourceBreakdown);
    console.log(`\n✅ Pipeline updated with region-tagged entries.`);
    console.log(`   Run /career-ops tracker or check data/pipeline.md\n`);

  } finally {
    await orchestrator.close();
  }
}

main().catch(err => {
  console.error('❌ Search failed:', err.message);
  process.exit(1);
});
