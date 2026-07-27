import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const NAMESPACE = 'career-ops-plugin-';
const HOOK_KINDS = ['ingest', 'provider', 'skill', 'score', 'tracker'];
const RESERVED_ENV = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'AWS_'];

export function validateRegistryEntry(entry, opts) {
  const errors = [];
  if (!entry.name?.startsWith(NAMESPACE)) errors.push(`name must start with ${NAMESPACE}`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) errors.push('invalid id format');
  if ((entry.hooks || []).some(h => !(opts?.hookKinds || HOOK_KINDS).includes(h))) errors.push('unknown hook kind');
  if ((entry.requiredEnv || []).some(e => (opts?.reservedEnv || RESERVED_ENV).some(r => e.startsWith(r)))) errors.push('reserved env var');
  if (entry.supersedesBundled !== undefined && entry.supersedesBundled !== true) errors.push('supersedesBundled must be boolean true');
  return errors;
}

export function classifySource(manifest, root, _lock) {
  if (!manifest?.dir) return 'unknown';
  const pluginsLocal = join(root, 'plugins.local');
  if (manifest.dir.startsWith(pluginsLocal)) return 'local';
  return 'bundled';
}

export function successorFor(root, id) {
  const regPath = join(root, 'plugins-registry.json');
  if (!existsSync(regPath)) return null;
  const reg = JSON.parse(readFileSync(regPath, 'utf8'));
  const entry = (reg.plugins || []).find(p => p.id === id && p.supersedesBundled === true);
  return entry || null;
}
