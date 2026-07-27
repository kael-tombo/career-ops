#!/usr/bin/env node

/**
 * scripts/ai.mjs — Unified AI CLI entry point for all 20+ features
 *
 * Usage:
 *   node scripts/ai.mjs list-modules
 *   node scripts/ai.mjs cover-letter generate --company "X" --role "Y" --desc "..."
 *   node scripts/ai.mjs interview-predict predict --role "..." --desc "..."
 *   node scripts/ai.mjs salary-negotiator generate --offer 80000 --company "X" --role "Y"
 *   node scripts/ai.mjs keyword-optimizer analyze --cv "..."
 *   node scripts/ai.mjs quality-scorer score --cv "..." --jd "..."
 *   node scripts/ai.mjs skill-gap analyze --jd "..."
 *   node scripts/ai.mjs fit-explainer explain --score 4.2 --role "..."
 *   node scripts/ai.mjs followup list-due
 *   node scripts/ai.mjs rejection-analyzer analyze
 *   node scripts/ai.mjs company-intel gather --company "Google"
 *   node scripts/ai.mjs deadline-tracker upcoming
 *   node scripts/ai.mjs pipeline-forecast forecast
 *   node scripts/ai.mjs application-timer analyze
 *   node scripts/ai.mjs job-priority prioritize --role "..."
 *   node scripts/ai.mjs auto-matcher batch --jobs "..."
 *   node scripts/ai.mjs batch --file pipeline.md --all
 *   node scripts/ai.mjs interactive
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { listModules, runModule, getProviderStatus } from '../lib/ai/orchestrator.mjs';

const ROOT = process.cwd();

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { module: null, action: null, params: {}, interactive: false, list: false, batch: false, help: false, providers: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case 'list-modules': opts.list = true; break;
      case 'providers': opts.providers = true; break;
      case 'interactive': opts.interactive = true; break;
      case '--help': case '-h': opts.help = true; break;
      default:
        if (!opts.module) opts.module = args[i];
        else if (!opts.action) opts.action = args[i];
        else if (args[i].startsWith('--')) {
          const key = args[i].replace(/^--/, '');
          const val = args[++i];
          if (val && !val.startsWith('--')) {
            opts.params[key] = val;
          } else {
            opts.params[key] = true;
            i--;
          }
        }
    }
  }

  return opts;
}

function printProviders() {
  const status = getProviderStatus();
  const divider = '─'.repeat(84);
  console.log(`\nLLM Provider Status\n${divider}`);
  console.log('Provider'.padEnd(14) + 'Status'.padEnd(18) + 'Models');
  console.log(divider);
  for (const p of status.providers) {
    const statusIcon = p.configured ? '✅ Ready' : '❌ No key';
    console.log(p.id.padEnd(14) + statusIcon.padEnd(18) + p.models);
  }
  console.log(divider);
  console.log(`Priority: ${status.order.join(' > ')}`);
  console.log(`LLM_PROVIDER_ORDER: ${process.env.LLM_PROVIDER_ORDER || '(default)'}\n`);
}

function printHelp() {
  console.log(`
AI Feature CLI — ${listModules().length} modules available

Usage: node scripts/ai.mjs <module> <action> [options]

Modules:
${listModules().map(m => `  ${m.id.padEnd(22)} ${m.label}`).join('\n')}

Actions: Each module exports different functions. See module with:
  node scripts/ai.mjs <module> --help

Common options:
  --company         Company name
  --role            Job role/title
  --desc            Job description text
  --jd              JD file path or text
  --cv              CV file path or text
  --url             Job URL
  --score           Evaluation score
  --offer           Salary offer amount
  --file            Pipeline file path
  --all             Run all matching modules

Meta commands:
  node scripts/ai.mjs list-modules
  node scripts/ai.mjs providers
  node scripts/ai.mjs interactive
  node scripts/ai.mjs batch --file data/pipeline.md --all
`);
}

async function interactiveMode() {
  const readline = (await import('readline')).default;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  console.log('\n🤖 AI Feature Interactive Mode\n');
  const modules = listModules();
  console.log('Available modules:');
  modules.forEach((m, i) => console.log(`  ${i + 1}. ${m.label} (${m.id})`));

  const choice = await ask('\nSelect module (number or id): ');
  const mod = modules[parseInt(choice) - 1] || modules.find(m => m.id === choice);
  if (!mod) { console.log('Invalid choice'); rl.close(); return; }

  const modImport = await import(`../lib/ai/${mod.path}`);
  const actions = Object.keys(modImport).filter(k => typeof modImport[k] === 'function');
  console.log(`\nActions for ${mod.label}:`);
  actions.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));

  const actionChoice = await ask('\nSelect action (number or name): ');
  const action = actions[parseInt(actionChoice) - 1] || actions.find(a => a === actionChoice);
  if (!action) { console.log('Invalid choice'); rl.close(); return; }

  console.log('\nEnter parameters as JSON (or press Enter for none):');
  const paramsStr = await ask('> ');
  let params = {};
  try { params = paramsStr ? JSON.parse(paramsStr) : {}; } catch { params = { description: paramsStr }; }

  console.log(`\nRunning ${mod.id}.${action}...`);
  try {
    const result = await runModule(mod.id, action, params);
    console.log('\nResult:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }

  rl.close();
}

async function batchMode(opts) {
  const allJobs = [];
  const filePath = opts.params.file || 'data/pipeline.md';
  const fullPath = join(ROOT, filePath);
  if (!existsSync(fullPath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  const content = readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.match(/^\s*-\s*\[\s*[ x]?\s*\]\s*(\S+)/));
  for (const line of lines) {
    const match = line.match(/\[(.*?)\]\((.*?)\)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|/);
    if (match) {
      allJobs.push({ company: match[3]?.trim() || '', role: match[4]?.trim() || '', url: match[2] || '' });
    }
  }

  console.log(`Batch processing ${allJobs.length} jobs from ${filePath}`);

  for (const job of allJobs.slice(0, 10)) {
    console.log(`\n--- ${job.company} - ${job.role} ---`);
    try {
      const match = await runModule('auto-matcher', 'autoMatchJob', job);
      console.log(`  Matched: ${match.matchedResumeLabel} (score: ${match.matchScore})`);
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }
}

async function main() {
  const opts = parseArgs();
  if (opts.help) { printHelp(); return; }
  if (opts.list) { console.log(JSON.stringify(listModules(), null, 2)); return; }
  if (opts.interactive) { await interactiveMode(); return; }
  if (opts.providers) { printProviders(); return; }
  if (opts.module === 'batch') { await batchMode(opts); return; }

  if (!opts.module || !opts.action) {
    console.error('Usage: node scripts/ai.mjs <module> <action> [options]');
    console.error('  node scripts/ai.mjs list-modules');
    process.exit(1);
  }

  // Handle file-based params: if --jd is a file path, read it
  if (opts.params.jd && existsSync(join(ROOT, opts.params.jd))) {
    opts.params.jdText = readFileSync(join(ROOT, opts.params.jd), 'utf-8');
  }
  if (opts.params.desc && existsSync(join(ROOT, opts.params.desc))) {
    opts.params.description = readFileSync(join(ROOT, opts.params.desc), 'utf-8');
  }
  if (opts.params.cv && existsSync(join(ROOT, opts.params.cv))) {
    opts.params.cvContent = readFileSync(join(ROOT, opts.params.cv), 'utf-8');
  }

  try {
    const result = await runModule(opts.module, opts.action, opts.params);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
