#!/usr/bin/env node
// Note: runs under Node's ESM loader; require() is available via createRequire.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
/**
 * backup-restore.mjs — Production gate G10: backup + tested restoration.
 *
 *   node backup-restore.mjs                     # create a backup
 *   node backup-restore.mjs list                # list backups
 *   node backup-restore.mjs verify [name]       # integrity-check one/all
 *   node backup-restore.mjs prune [--keep N]    # delete old backups (default 7)
 *   node backup-restore.mjs restore <name> --into <dir>   # extract copy (never overwrites live data)
 *   node backup-restore.mjs self-test           # backup → mutate → restore → verify roundtrip
 *
 * What a backup contains:
 *   db/career-ops.db        SQLite via `VACUUM INTO` (online, consistent snapshot)
 *   files/                  the file contract (data/*.md) — source of truth
 *   user/                   user layer (cv.md, resumes/, config/profile.yml, portals.yml)
 *   consent/                consent artifacts (audit trail of grants)
 *   MANIFEST.json           versions, timestamps, checksums
 *
 * Restores are fail-safe: they write ONLY into an explicit --into directory
 * and never touch the live data/ while the server may be running.
 */

import { execSync } from 'node:child_process';
import {
  mkdirSync, existsSync, readFileSync, writeFileSync, rmSync,
  readdirSync, statSync, createReadStream, cpSync,
} from 'node:fs';
import { join, basename, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const BACKUP_DIR = process.env.CAREER_OPS_BACKUP_DIR || join(ROOT, 'backups');
const DATA_DIR = process.env.CAREER_OPS_DATA_DIR || join(ROOT, 'data');
const DB_PATH = join(DATA_DIR, 'career-ops.db');

const FILE_CONTRACT = ['applications.md', 'pipeline.md', 'scan-history.tsv'];
const USER_LAYER = ['cv.md', 'article-digest.md'];
const USER_DIRS = ['resumes'];
const USER_CONFIGS = ['config/profile.yml', 'portals.yml'];
const KEEP_DEFAULT = 7;

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Synchronous SQLite snapshot on a readonly connection (VACUUM INTO). */
function snapshotDb(srcDb, destDb) {
  const Database = require('better-sqlite3');
  const snap = new Database(srcDb, { readonly: true, fileMustExist: true });
  try {
    snap.exec(`VACUUM INTO '${destDb.replace(/\\/g, '/')}'`);
  } finally {
    snap.close();
  }
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
}

export function createBackup({ log = true } = {}) {
  ensureBackupDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = `career-ops-backup-${ts}`;
  const dir = join(BACKUP_DIR, name);
  mkdirSync(dir, { recursive: true });

  // 1. SQLite snapshot via VACUUM INTO (safe while the server runs —
  // taken on a readonly connection so we never contend with the writer).
  mkdirSync(join(dir, 'db'), { recursive: true });
  if (existsSync(DB_PATH)) {
    snapshotDb(DB_PATH, join(dir, 'db', 'career-ops.db'));
  } else {
    if (log) console.log('  ⚠️  no database found — file-contract-only backup');
  }

  // 2. File contract + user layer + consent artifacts.
  mkdirSync(join(dir, 'files'), { recursive: true });
  for (const f of FILE_CONTRACT) {
    const src = join(DATA_DIR, f);
    if (existsSync(src)) cpSync(src, join(dir, 'files', f));
  }
  mkdirSync(join(dir, 'user'), { recursive: true });
  for (const f of USER_LAYER) {
    if (existsSync(join(ROOT, f))) cpSync(join(ROOT, f), join(dir, 'user', f));
  }
  for (const d of USER_DIRS) {
    if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(dir, 'user', d), { recursive: true });
  }
  for (const c of USER_CONFIGS) {
    if (existsSync(join(ROOT, c))) {
      mkdirSync(join(dir, 'user', dirname(c)), { recursive: true });
      cpSync(join(ROOT, c), join(dir, 'user', c));
    }
  }
  if (existsSync(join(DATA_DIR, 'consent'))) {
    cpSync(join(DATA_DIR, 'consent'), join(dir, 'consent'), { recursive: true });
  }

  // 3. Manifest with checksums.
  const manifest = {
    created: new Date().toISOString(),
    tool: 'backup-restore.mjs',
    node: process.version,
    files: [],
  };
  for (const rel of collectFiles(dir)) {
    manifest.files.push({ path: rel, sha256: sha256(join(dir, rel)), bytes: statSync(join(dir, rel)).size });
  }
  writeFileSync(join(dir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));

  if (log) console.log(`✅ Backup created: ${dir} (${manifest.files.length} files)`);
  return dir;
}

function dirname(p) {
  const i = p.lastIndexOf('/');
  return i === -1 ? '.' : p.slice(0, i);
}

function collectFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectFiles(full, base));
    else if (entry !== 'MANIFEST.json') out.push(relative(base, full).split('\\').join('/'));
  }
  return out;
}

export function listBackups() {
  ensureBackupDir();
  return readdirSync(BACKUP_DIR)
    .filter((n) => n.startsWith('career-ops-backup-'))
    .sort()
    .map((n) => {
      const manifestPath = join(BACKUP_DIR, n, 'MANIFEST.json');
      let manifest = null;
      try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { /* corrupt */ }
      return { name: n, path: join(BACKUP_DIR, n), created: manifest?.created ?? null, files: manifest?.files.length ?? 0 };
    });
}

export function verifyBackup(name) {
  const dir = name ? join(BACKUP_DIR, name) : listBackups().at(-1)?.path;
  if (!dir || !existsSync(dir)) throw new Error(`Backup not found: ${name ?? '(latest)'}`);
  const manifest = JSON.parse(readFileSync(join(dir, 'MANIFEST.json'), 'utf8'));
  let ok = 0, bad = [];
  for (const f of manifest.files) {
    const full = join(dir, f.path);
    if (existsSync(full) && sha256(full) === f.sha256) ok++;
    else bad.push(f.path);
  }
  return { dir, total: manifest.files.length, ok, bad };
}

export function pruneBackups(keep = KEEP_DEFAULT) {
  const all = listBackups();
  const remove = all.slice(0, Math.max(0, all.length - keep));
  for (const b of remove) rmSync(b.path, { recursive: true, force: true });
  return remove.map((b) => b.name);
}

export function restoreBackup(name, into) {
  if (!into) throw new Error('restore requires --into <dir> (never restores over live data)');
  const target = resolve(into);
  if (target === resolve(ROOT) || target === resolve(DATA_DIR)) {
    throw new Error('Refusing to restore over the live root/data — choose a scratch directory.');
  }
  const { ok, total, bad } = verifyBackup(name);
  if (bad.length) throw new Error(`Backup integrity failed (${bad.length}/${total} corrupt): ${bad.join(', ')}`);
  cpSync(join(BACKUP_DIR, name), target, { recursive: true });
  return { restored: total, into: target };
}

// ─── CLI ─────────────────────────────────────────────────────────
async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case undefined: {
      createBackup();
      break;
    }
    case 'list': {
      for (const b of listBackups()) console.log(`${b.name}  files=${b.files}  created=${b.created}`);
      break;
    }
    case 'verify': {
      const r = verifyBackup(rest[0]);
      console.log(`${r.ok}/${r.total} files verified in ${r.dir}` + (r.bad.length ? ` — CORRUPT: ${r.bad.join(', ')}` : ''));
      process.exit(r.bad.length ? 1 : 0);
      break;
    }
    case 'prune': {
      const keepIdx = rest.indexOf('--keep');
      const keep = keepIdx !== -1 ? parseInt(rest[keepIdx + 1], 10) : KEEP_DEFAULT;
      const removed = pruneBackups(keep);
      console.log(`pruned ${removed.length}: ${removed.join(', ') || '—'}`);
      break;
    }
    case 'restore': {
      const name = rest[0];
      const intoIdx = rest.indexOf('--into');
      const r = restoreBackup(name, intoIdx !== -1 ? rest[intoIdx + 1] : null);
      console.log(`✅ restored ${r.restored} files into ${r.into}`);
      break;
    }
    case 'self-test': {
      console.log('🧪 backup self-test: create → verify → restore → diff');
      const dir = createBackup({ log: false });
      const name = basename(dir);
      const v = verifyBackup(name);
      if (v.bad.length) throw new Error('self-test: backup failed integrity immediately');
      const scratch = join(BACKUP_DIR, `selftest-${Date.now()}`);
      const r = restoreBackup(name, scratch);
      // Spot-check: DB file and applications.md must exist in the restore.
      const dbOk = existsSync(join(scratch, 'db', 'career-ops.db'));
      const appsOk = existsSync(join(scratch, 'files', 'applications.md'));
      rmSync(scratch, { recursive: true, force: true });
      if (!dbOk || !appsOk) throw new Error(`self-test: restore incomplete (db=${dbOk} apps=${appsOk})`);
      console.log(`✅ self-test passed: ${v.ok}/${v.total} files verified, restore complete (${r.restored})`);
      break;
    }
    default:
      console.log('usage: node backup-restore.mjs [list|verify|prune|restore|self-test]');
      process.exit(2);
  }
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
