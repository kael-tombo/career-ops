/**
 * lib/ai/orchestrator.mjs — Unified AI Module Router
 * Single entry point for all 15 AI features, CLI, and API.
 *
 * Also surfaces provider status for the multi-provider LLM gateway.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getActiveProviders } from './gemini.mjs';

const MODULES = {
  'cover-letter': './cover-letter.mjs',
  'interview-predict': './interview-predict.mjs',
  'salary-negotiator': './salary-negotiator.mjs',
  'keyword-optimizer': './keyword-optimizer.mjs',
  'quality-scorer': './quality-scorer.mjs',
  'skill-gap': './skill-gap.mjs',
  'fit-explainer': './fit-explainer.mjs',
  'followup': './followup.mjs',
  'rejection-analyzer': './rejection-analyzer.mjs',
  'company-intel': './company-intel.mjs',
  'deadline-tracker': './deadline-tracker.mjs',
  'pipeline-forecast': './pipeline-forecast.mjs',
  'application-timer': './application-timer.mjs',
  'job-priority': './job-priority.mjs',
  'auto-matcher': './auto-matcher.mjs',
};

export function listModules() {
  return Object.entries(MODULES).map(([id, path]) => ({
    id, path: path.replace('./', ''),
    label: id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
  }));
}

export function getProviderStatus() {
  const active = getActiveProviders();
  const order = (process.env.LLM_PROVIDER_ORDER || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    order: order.length > 0 ? order : ['openai', 'grok', 'kimi', 'deepseek', 'gemini'],
    providers: PROVIDER_DEFS.map(p => ({
      id: p.id,
      keyVar: p.keyVar,
      models: p.models.join(', '),
      configured: active.some(a => a.id === p.id),
      model: active.find(a => a.id === p.id)?.model || null,
    })),
  };
}

const PROVIDER_DEFS = [
  { id: 'openai', keyVar: 'OPENAI_API_KEY', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'] },
  { id: 'grok', keyVar: 'XAI_API_KEY', models: ['grok-2', 'grok-2-latest'] },
  { id: 'kimi', keyVar: 'KIMI_API_KEY', models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
  { id: 'deepseek', keyVar: 'DEEPSEEK_API_KEY', models: ['deepseek-chat', 'deepseek-coder'] },
  { id: 'gemini', keyVar: 'GEMINI_API_KEY', models: ['gemini-2.0-flash-001', 'gemini-1.5-flash'] },
];

const MODULE_TIMEOUT = parseInt(process.env.AI_MODULE_TIMEOUT || '120000');

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return promise.finally(() => clearTimeout(timer));
}

export async function runModule(moduleId, action, params = {}) {
  const path = MODULES[moduleId];
  if (!path) throw new Error(`Unknown module: ${moduleId}. Use list-modules to see available.`);

  const mod = await import(path);
  const fn = mod[action];
  if (!fn) throw new Error(`Unknown action "${action}" for module "${moduleId}". Available: ${Object.keys(mod).join(', ')}`);

  return await withTimeout(fn(params, params.opts || {}), MODULE_TIMEOUT);
}

export default { listModules, runModule, getProviderStatus };
