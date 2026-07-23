#!/usr/bin/env node

/**
 * scripts/scan-all.mjs — Mass Scan CLI
 *
 * Discovers jobs from all sources and adds them to the pipeline.
 *
 * Usage:
 *   node scripts/scan-all.mjs                    # Full scan (all sources)
 *   node scripts/scan-all.mjs --max 100           # Limit to 100 jobs
 *   node scripts/scan-all.mjs --region europe     # Region-filtered
 *   node scripts/scan-all.mjs --quick             # Portals + search only (no discovery)
 */

import { runMassScan } from '../lib/discovery/mass-scan.mjs';

const args = process.argv.slice(2);
const opts = {
  maxJobs: 500,
  region: null,
  quick: false,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--max') opts.maxJobs = parseInt(args[++i]) || 500;
  else if (args[i] === '--region') opts.region = args[++i]?.toLowerCase();
  else if (args[i] === '--quick') opts.quick = true;
}

console.log(`🚀 Career-OPS Mass Scanner
   Mode: ${opts.quick ? 'Quick (portals + search)' : 'Full (portals + search + discovery)'}
   Max jobs: ${opts.maxJobs}
   Region: ${opts.region || 'All'}
`);

runMassScan({
  maxJobs: opts.maxJobs,
  region: opts.region,
}).then(result => {
  console.log(`\n✨ Added ${result.total} new jobs to pipeline`);
  process.exit(0);
}).catch(err => {
  console.error('❌ Scan failed:', err.message);
  process.exit(1);
});
