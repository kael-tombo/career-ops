import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve, relative } from 'path';
import { isBlockedIp, validateAllowedHosts } from './_net.mjs';
import { hashPluginTree, writeLockEntry, readLock, diffPlugin, consentSurface, lockGate as lockGateFn } from './_lock.mjs';

export const HOOK_KINDS = ['ingest', 'provider', 'skill', 'score', 'tracker'];
export const RESERVED_ENV = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'AWS_'];

export function pluginRoots(root) {
  const dirs = [];
  const bundled = join(root, 'plugins');
  if (existsSync(bundled)) dirs.push(bundled);
  const local = join(root, 'plugins.local');
  if (existsSync(local)) dirs.push(local);
  return dirs;
}

export function validateManifest(m, dirPath, dirName) {
  if (m.humanInTheLoop === false) return null;
  if (m.hooks?.some(h => h === 'apply' || h === 'submit')) return null;
  if (m.requiredEnv?.some(e => RESERVED_ENV.some(r => e === r || e.startsWith(r)))) return null;
  if (m.requiredEnv?.length > 0 && !m.allowedHosts?.length) return null;
  if (m.entry) {
    const resolved = resolve(dirPath, m.entry);
    if (!resolved.startsWith(resolve(dirPath))) return null;
    if (!existsSync(resolved)) return null;
    try { if (statSync(resolved).isSymbolicLink()) return null; } catch { return null; }
  }
  if (m.skill) {
    const skillPath = resolve(dirPath, m.skill);
    if (!skillPath.startsWith(resolve(dirPath))) return null;
    try { if (statSync(skillPath).isSymbolicLink()) return null; } catch { return null; }
  }
  if (m.id !== dirName) return null;
  if (m.apiVersion !== undefined && m.apiVersion !== 1) return null;
  if (m.allowsLocalhost === true && !m.allowedHosts?.length) return null;
  if (m.allowedHosts?.length && !validateAllowedHosts(m.allowedHosts)) return null;
  if (m.allowedHosts?.some(h => isBlockedIp(h))) return null;
  return m;
}

export function discoverPlugins(roots, successorIds) {
  const result = [];
  const seen = new Map();
  const sids = successorIds || new Set();

  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root).sort()) {
      const dir = join(root, name);
      if (!statSync(dir).isDirectory()) continue;
      if (name.startsWith('_') || name.startsWith('.')) continue;
      const manifestPath = join(dir, 'manifest.json');
      if (!existsSync(manifestPath)) continue;
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      } catch { continue; }
      const validated = validateManifest(manifest, dir, name);
      if (!validated) continue;

      const isLocal = root.includes('plugins.local');
      if (isLocal && sids.has(name)) {
        result.push({ ...validated, dir, source: 'local' });
        seen.set(name, true);
      } else if (!isLocal && !sids.has(name)) {
        result.push({ ...validated, dir, source: 'bundled' });
        seen.set(name, true);
      } else if (!isLocal && seen.has(name)) {
        continue;
      }
    }
  }
  return result;
}

export function resolveSuccessorIds(root) {
  const lock = readLock(root);
  const regPath = join(root, 'plugins-registry.json');
  if (!existsSync(regPath)) return new Set();
  let reg;
  try { reg = JSON.parse(readFileSync(regPath, 'utf8')); } catch { return new Set(); }
  const result = new Set();
  for (const entry of (reg.plugins || [])) {
    if (entry.supersedesBundled !== true) continue;
    const lockEntry = lock.plugins[entry.id];
    if (lockEntry && lockEntry.sha === entry.sha) result.add(entry.id);
  }
  return result;
}

export function loadSkill(manifest, root) {
  if (!manifest?.skill) return null;
  const skillPath = join(manifest.dir, manifest.skill);
  if (!existsSync(skillPath)) return null;
  const body = readFileSync(skillPath, 'utf8');
  const source = manifest.dir?.includes('plugins.local') ? 'local' : 'bundled';
  const flags = [];
  const injectionPatterns = ['ignore all previous instructions', 'ignore previous', 'override all'];
  for (const p of injectionPatterns) {
    if (body.toLowerCase().includes(p)) flags.push({ pattern: p, severity: 'high' });
  }
  return { id: manifest.id, source, body, flags };
}

export function buildCtx(manifest, extra = {}) {
  const env = {};
  for (const key of (manifest.requiredEnv || [])) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  for (const key of (manifest.optionalEnv || [])) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  Object.freeze(env);

  const settings = extra.settings ? Object.freeze({ ...extra.settings }) : Object.freeze({});

  const allowedHosts = manifest.allowedHosts || [];
  const allowedLocalhost = manifest.allowsLocalhost === true;

  return {
    env,
    settings,
    fetch: async (url, opts = {}) => {
      const u = new URL(url);
      if (u.protocol !== 'https:') throw new Error('ctx.fetch: only HTTPS allowed');
      if (!allowedLocalhost && isBlockedIp(u.hostname)) throw new Error(`ctx.fetch: blocked IP ${u.hostname}`);
      if (!allowedHosts.includes(u.hostname) && !(allowedLocalhost && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))) {
        throw new Error(`ctx.fetch: host ${u.hostname} not in allowedHosts`);
      }
      const cleanHeaders = { ...opts.headers };
      delete cleanHeaders['authorization'];
      delete cleanHeaders['Authorization'];
      const resp = await globalThis.fetch(url, { ...opts, headers: cleanHeaders });
      if (resp.status >= 300 && resp.status < 400 && resp.headers.get('location')) {
        const redirectUrl = new URL(resp.headers.get('location'), url);
        if (redirectUrl.hostname !== u.hostname) {
          const cleanRedirect = { ...opts };
          delete cleanRedirect.headers;
          return globalThis.fetch(redirectUrl.toString(), cleanRedirect);
        }
        return globalThis.fetch(redirectUrl.toString(), opts);
      }
      return resp;
    },
  };
}

export async function mergeProviderPlugins(providerMap, { root }) {
  const roots = pluginRoots(root);
  const sids = resolveSuccessorIds(root);
  const manifests = discoverPlugins(roots, sids);
  let pluginsCfg = {};
  const cfgPath = join(root, 'config', 'plugins.yml');
  if (existsSync(cfgPath)) {
    try {
      const yaml = await import('js-yaml');
      const parsed = yaml.load(readFileSync(cfgPath, 'utf8'));
      pluginsCfg = parsed?.plugins || {};
    } catch {}
  }

  for (const m of manifests) {
    if (!m.hooks?.includes('provider')) continue;
    if (providerMap.has(m.id) && providerMap.get(m.id).__core) continue;

    const cfg = pluginsCfg[m.id] || {};
    const enabled = cfg.enabled === true;
    const missingKey = (m.requiredEnv || []).some(k => !process.env[k]);

    if (!enabled || missingKey) {
      providerMap.set(m.id, {
        id: m.id, __plugin: true, __inactive: true,
        detect: () => null,
        fetch: async () => { throw new Error(`Plugin ${m.id} is inactive (missing key or disabled)`); },
      });
      continue;
    }

    const indexJs = join(m.dir, m.entry || 'index.mjs');
    if (existsSync(indexJs)) {
      try {
        const { pathToFileURL } = await import('url');
        const mod = await import(pathToFileURL(indexJs).href);
        const prov = mod.default?.provider;
        if (prov) {
          prov.id = m.id;
          prov.__plugin = true;
          prov.__inactive = false;
          prov.detect = () => null;
          providerMap.set(m.id, prov);
        }
      } catch {}
    }
  }
}

export function pluginStatus(manifest, cfg) {
  const pluginCfg = cfg?.plugins?.[manifest.id] || {};
  const enabled = pluginCfg.enabled === true;
  const missingEnv = (manifest.requiredEnv || []).filter(k => !process.env[k]);
  return { enabled, configured: true, missingEnv };
}

export function lockGate(manifest, lockDir) { return lockGateFn(manifest, lockDir); }
