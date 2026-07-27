/**
 * lib/file-lock.mjs — Simple named mutex using SQLite
 *
 * Provides exclusive file-level locking to prevent concurrent writes
 * to shared data files (pipeline.md, applications.md, scan-history.tsv).
 *
 * Uses SQLite's BEGIN IMMEDIATE transaction as a cross-process mutex.
 */

import { getDb } from './db/index.mjs';

const locksHeld = new Set();

function ensureTable() {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS file_locks (
    name TEXT PRIMARY KEY,
    locked_at TEXT DEFAULT (datetime('now'))
  )`);
}

export function acquireLock(name, timeoutMs = 5000) {
  if (locksHeld.has(name)) return true;
  ensureTable();
  const db = getDb();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const acquired = db.transaction(() => {
        const row = db.prepare('SELECT 1 FROM file_locks WHERE name = ?').get(name);
        if (row) return false;
        db.prepare('INSERT INTO file_locks (name) VALUES (?)').run(name);
        return true;
      })();
      if (acquired) {
        locksHeld.add(name);
        return true;
      }
    } catch {
      // Lock contention — retry
    }
    // Exponential backoff
    const elapsed = Date.now() - (deadline - timeoutMs);
    const delay = Math.min(50 + elapsed * 0.5, 500);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
  }
  return false;
}

export function releaseLock(name) {
  if (!locksHeld.has(name)) return;
  ensureTable();
  const db = getDb();
  try {
    db.prepare('DELETE FROM file_locks WHERE name = ?').run(name);
  } catch {
    // Best-effort cleanup
  }
  locksHeld.delete(name);
}

export function withLock(name, fn, timeoutMs = 5000) {
  if (!acquireLock(name, timeoutMs)) {
    throw new Error(`Failed to acquire lock for "${name}" within ${timeoutMs}ms`);
  }
  try {
    return fn();
  } finally {
    releaseLock(name);
  }
}

export default { acquireLock, releaseLock, withLock };
