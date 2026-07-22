#!/usr/bin/env node

/**
 * career-ops.mjs — Unified CLI Entry Point
 * Part of the "Elite System Upgrade"
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

const v = existsSync(join(ROOT, 'VERSION')) ? readFileSync(join(ROOT, 'VERSION'), 'utf-8').trim() : '1.2.0-ELITE';

const HEADER = `
   ______                            ____                
  / ____/___  ________  ___  _______/ __ \\____  _____   
 / /   / __ \\/ ___/ _ \\/ _ \\/ ___/ / / / __ \\/ ___/  
/ /___/ /_/ / /  /  __/  __/ /  / /_/ / /_/ (__  )   
\\____/\\____/_/   \\___/\\___/_/   \\____/ .___/____/    
                                    /_/    v${v}
      Elite AI-Native Career Pipeline Automation
`;

const COMMANDS = {
  'scan': { script: 'scan-portals.mjs', desc: 'Scan portals for new job offers' },
  'evaluate': { script: 'modes/oferta.md', desc: 'Evaluate a job offer (URL or text)' },
  'tailor': { script: 'tailor-assets.mjs', desc: 'Automate Elite CV + Cover Letter tailoring for an ID' },
  'prep': { script: 'prep-form.mjs', desc: 'Autonomously fill application form for an ID' },
  'apply': { script: 'apply.mjs', desc: 'Auto-submit applications (use with caution)' },
  'pipeline': { script: 'modes/pipeline.md', desc: 'Process pending URLs from inbox' },
  'tracker': { script: 'modes/tracker.md', desc: 'Show application status overview' },
  'pdf': { script: 'generate-pdf.mjs', desc: 'Generate tailored ATS-optimized CV' },
  'dashboard': { script: 'server.mjs', desc: 'Launch the Elite Web Dashboard' },
  'doctor': { script: 'doctor.mjs', desc: 'Run system health checks' },
  'update': { script: 'update-system.mjs', desc: 'Check for or apply system updates' },
  'verify': { script: 'verify-pipeline.mjs', desc: 'Verify data integrity' },
  'sync': { script: 'cv-sync-check.mjs', desc: 'Check CV/LinkedIn sync status' },
  'liveness': { script: 'check-liveness.mjs', desc: 'Check if job offers are still active' },
};

function printHelp() {
  console.log(HEADER);
  console.log('Usage: node career-ops.mjs <command> [args]\n');
  console.log('Commands:');
  for (const [name, cmd] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(12)} ${cmd.desc}`);
  }
  console.log('\nExample:');
  console.log('  node career-ops.mjs evaluate https://jobs.lever.co/example');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  const config = COMMANDS[command];
  if (!config) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  // Handle command execution
  // For .md scripts, we typically invoke them through an AI agent or a specialized runner.
  // Here we just print how to run them or invoke the .mjs equivalent.

  if (config.script.endsWith('.mjs')) {
    const scriptPath = join(ROOT, config.script);
    try {
      execSync(`node ${scriptPath} ${args.slice(1).join(' ')}`, { stdio: 'inherit', cwd: ROOT });
    } catch (err) {
      process.exit(err.status || 1);
    }
  } else {
    console.log(`\n${HEADER}`);
    console.log(`To run [${command}], use your AI agent with the following mode:`);
    console.log(`  Mode file: ${config.script}`);
    console.log(`  Args: ${args.slice(1).join(' ')}`);
    console.log(`\nExample for Claude: "/career-ops ${command} ${args.slice(1).join(' ')}"`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
