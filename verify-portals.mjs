import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

export async function verifyPortalsFile(portalsPath) {
  if (!existsSync(portalsPath)) return { results: [] };
  const raw = readFileSync(portalsPath, 'utf8');
  const cfg = yaml.load(raw) || {};
  const results = [];
  for (const entry of (cfg.tracked_companies || [])) {
    if (entry.ats && entry.slug) {
      results.push({ name: entry.name, ats: entry.ats, slug: entry.slug, status: 'unresolved' });
    }
  }
  return { results };
}

export function classifyFetchError(err) {
  if (!err) return { type: 'unknown', retryable: false };
  const msg = String(err.message || '');
  if (msg.includes('404')) return { type: 'not_found', retryable: false };
  if (msg.includes('429') || msg.includes('rate')) return { type: 'rate_limited', retryable: true };
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) return { type: 'timeout', retryable: true };
  if (msg.includes('ECONNREFUSED')) return { type: 'connection_refused', retryable: true };
  return { type: 'unknown', retryable: false };
}
