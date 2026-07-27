/**
 * lib/ai/gemini.mjs — Multi-Provider LLM Gateway
 *
 * Unified interface for 15 AI modules. Supports any OpenAI-compatible
 * provider + Gemini SDK. Auto-detects available providers from env vars
 * and rotates through (provider × model) combinations on quota errors.
 *
 * Exports (unchanged for backward compat):
 *   askGemini(prompt, opts)    → string
 *   askGeminiJSON(prompt, opts) → object|null
 *   askGeminiArray(prompt, opts) → array|null
 *
 * Provider env vars (detected automatically):
 *   OPENAI_API_KEY  → gpt-4o, gpt-4o-mini, gpt-4-turbo
 *   XAI_API_KEY     → grok-2, grok-2-latest
 *   KIMI_API_KEY    → moonshot-v1-8k, moonshot-v1-32k
 *   DEEPSEEK_API_KEY → deepseek-chat, deepseek-coder
 *   GEMINI_API_KEY  → gemini-2.0-flash, gemini-1.5-flash  (SDK)
 *   GEMINI_API_KEYS → comma-separated Gemini keys (fallback, multi-key rotation)
 *
 * Priority order (configurable via LLM_PROVIDER_ORDER env var):
 *   e.g. LLM_PROVIDER_ORDER=openai,grok,kimi,deepseek,gemini
 *
 * Cost-aware routing (LLM_COST_AWARE=true):
 *   Sort enabled providers by cost tier (cheapest first) within same priority tier.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Provider Definitions ───────────────────────────────────────
// costTier: 0=free, 1=cheap, 2=standard, 3=expensive, 4=premium

const PROVIDER_DEFS = [
  {
    id: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    keyVar: 'OPENAI_API_KEY',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
    type: 'openai',
    costTier: 1,
  },
  {
    id: 'grok',
    baseUrl: 'https://api.x.ai/v1',
    keyVar: 'XAI_API_KEY',
    models: ['grok-2', 'grok-2-latest'],
    type: 'openai',
    costTier: 3,
  },
  {
    id: 'kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    keyVar: 'KIMI_API_KEY',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k'],
    type: 'openai',
    costTier: 2,
  },
  {
    id: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    keyVar: 'DEEPSEEK_API_KEY',
    models: ['deepseek-chat', 'deepseek-coder'],
    type: 'openai',
    costTier: 1,
  },
  {
    id: 'gemini',
    type: 'gemini',
    keyVar: 'GEMINI_API_KEY',
    models: ['models/gemini-2.0-flash-001', 'models/gemini-1.5-flash'],
    costTier: 1,
  },
];

const DEFAULT_ORDER = ['openai', 'grok', 'kimi', 'deepseek', 'gemini'];

// ─── Provider Resolution ────────────────────────────────────────

function resolveProviders() {
  const order = (process.env.LLM_PROVIDER_ORDER || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  const priority = order.length > 0 ? order : DEFAULT_ORDER;

  // Gather Gemini multi-key fallback
  const geminiKeys = (process.env.GEMINI_API_KEYS || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  const active = [];
  for (const id of priority) {
    const def = PROVIDER_DEFS.find(p => p.id === id);
    if (!def) continue;

    if (id === 'gemini') {
      const keys = geminiKeys.length > 0 ? geminiKeys
        : process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY]
        : [];
      if (keys.length > 0) {
        active.push({ ...def, resolvedKeys: keys });
      }
    } else {
      const key = process.env[def.keyVar];
      if (key) {
        active.push({ ...def, apiKey: key });
      }
    }
  }
  return active;
}

/**
 * Expand Gemini providers — one entry per API key — so the rotation
 * loop naturally tries each key before moving to the next provider.
 */
function expandProviders() {
  const providers = resolveProviders();
  const expanded = [];
  for (const p of providers) {
    if (p.type === 'gemini') {
      for (const key of p.resolvedKeys) {
        expanded.push({ ...p, apiKey: key, isSingleGeminiEntry: true });
      }
    } else {
      expanded.push(p);
    }
  }

  // Cost-aware: sort cheaper models first within each priority group.
  // This prefers gpt-4o-mini over gpt-4o when both are from the same provider.
  if (process.env.LLM_COST_AWARE === 'true') {
    const tierOrder = expanded.map(p => p.costTier ?? 99);
    expanded.sort((a, b) => {
      const aTier = a.costTier ?? 99;
      const bTier = b.costTier ?? 99;
      if (aTier !== bTier) return aTier - bTier;
      return 0; // preserve priority order when same tier
    });
  }

  return expanded;
}

// ─── OpenAI-Compatible Call ─────────────────────────────────────

async function callOpenAI(provider, model, prompt, opts) {
  const url = `${provider.baseUrl}/chat/completions`;
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 4096,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[${res.status} ${res.statusText}] ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

// ─── Gemini SDK Call ────────────────────────────────────────────

async function callGeminiSDK(apiKey, model, prompt, opts) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const m = genAI.getGenerativeModel({
    model,
    generationConfig: {
      temperature: opts.temperature ?? 0.3,
      maxOutputTokens: opts.maxTokens ?? 4096,
    },
  });
  const result = await m.generateContent(prompt);
  return result.response.text();
}

// ─── Rotation Engine ────────────────────────────────────────────

function isRetryableError(err) {
  const msg = err.message || '';
  return msg.includes('429') || msg.includes('401') || msg.includes('402')
    || msg.includes('quota') || msg.includes('rate limit') || msg.includes('insufficient_quota')
    || msg.includes('not found') || msg.includes('not supported') || msg.includes('404')
    || msg.includes('[429]') || msg.includes('[429 Too Many Requests]');
}

async function tryCombinations(prompt, opts, providers, idx = 0, midx = 0) {
  if (idx >= providers.length) {
    throw new Error('All LLM provider×model combinations exhausted');
  }
  const prov = providers[idx];
  const models = opts.models || prov.models;
  const model = models[midx] || models[0];

  try {
    if (prov.type === 'gemini') {
      return await callGeminiSDK(prov.apiKey, model, prompt, opts);
    }
    return await callOpenAI(prov, model, prompt, opts);
  } catch (err) {
    if (isRetryableError(err)) {
      const nextModel = midx + 1;
      if (nextModel < models.length) {
        return tryCombinations(prompt, opts, providers, idx, nextModel);
      }
      return tryCombinations(prompt, opts, providers, idx + 1, 0);
    }
    throw err;
  }
}

// ─── Public API ─────────────────────────────────────────────────

const _providerCache = [];
let _cacheTimestamp = 0;
const CACHE_TTL = parseInt(process.env.LLM_CACHE_TTL || '60000', 10);

function getProviders() {
  const now = Date.now();
  if (_providerCache.length === 0 || (now - _cacheTimestamp) > CACHE_TTL) {
    _providerCache.length = 0;
    _providerCache.push(...expandProviders());
    _cacheTimestamp = now;
  }
  return _providerCache;
}

export function getActiveProviders() {
  return getProviders().map(p => ({
    id: p.id,
    model: p.models[0],
    costTier: p.costTier ?? 99,
    configured: true,
  }));
}

export async function askGemini(prompt, opts = {}) {
  const providers = getProviders();
  if (providers.length === 0) {
    throw new Error('No LLM provider configured. Set at least one: OPENAI_API_KEY, XAI_API_KEY, KIMI_API_KEY, DEEPSEEK_API_KEY, or GEMINI_API_KEY');
  }
  return tryCombinations(prompt, opts, providers, 0, 0);
}

export async function askGeminiJSON(prompt, opts = {}) {
  const text = await askGemini(prompt, opts);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }
  return null;
}

export async function askGeminiArray(prompt, opts = {}) {
  const text = await askGemini(prompt, opts);
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch {}
  }
  return null;
}

export default { askGemini, askGeminiJSON, askGeminiArray, getActiveProviders };
