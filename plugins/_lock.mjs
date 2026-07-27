import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export function hashPluginTree(dir) {
  if (!existsSync(dir)) return { integrity: '', files: {} };
  const files = {};
  const walk = (d, prefix = '') => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      const st = statSync(full);
      if (st.isSymbolicLink()) throw new Error(`symlink not allowed: ${full}`);
      if (st.isDirectory()) { walk(full, `${prefix}${name}/`); continue; }
      const hash = createHash('sha256').update(readFileSync(full)).digest('hex');
      files[prefix + name] = { size: st.size, hash };
    }
  };
  walk(dir);
  const integrity = createHash('sha256').update(JSON.stringify(files)).digest('hex');
  return { integrity, files };
}

export function writeLockEntry(lockDir, id, entry) {
  const lp = join(lockDir, 'plugins.lock');
  const lock = existsSync(lp) ? JSON.parse(readFileSync(lp, 'utf8')) : { version: 1, plugins: {} };
  lock.plugins[id] = entry;
  mkdirSync(lockDir, { recursive: true });
  writeFileSync(lp, JSON.stringify(lock, null, 2));
}

export function readLock(lockDir) {
  const lp = join(lockDir, 'plugins.lock');
  if (!existsSync(lp)) return { version: 1, plugins: {} };
  return JSON.parse(readFileSync(lp, 'utf8'));
}

export function diffPlugin(manifest, lockEntry) {
  if (!lockEntry) return { status: 'unlocked' };
  const surfaceChanged = JSON.stringify({ allowedHosts: manifest.allowedHosts, requiredEnv: manifest.requiredEnv }) !== JSON.stringify({ allowedHosts: lockEntry.consent?.allowedHosts, requiredEnv: lockEntry.consent?.requiredEnv });
  if (surfaceChanged) return { status: 'surface-widened' };
  if (manifest.version !== lockEntry.version) return { status: 'legit-update' };
  return { status: 'match' };
}

export function consentSurface(manifest) {
  return { allowedHosts: manifest.allowedHosts || [], requiredEnv: manifest.requiredEnv || [] };
}

export function lockGate(manifest, lockDir) {
  const lock = readLock(lockDir);
  const entry = lock.plugins[manifest.id];
  const status = diffPlugin(manifest, entry).status;
  if (status === 'drift-nobump' || status === 'surface-widened') return { load: false, reason: status };
  return { load: true };
}
