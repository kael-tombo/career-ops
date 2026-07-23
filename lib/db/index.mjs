#!/usr/bin/env node

/**
 * lib/db/index.mjs — SQLite database connection manager for Career-OPS v3.0
 *
 * Provides:
 *  - Auto-initialization from schema.sql
 *  - WAL mode for concurrent reads
 *  - Query helpers (getAll, getOne, run, transaction)
 *  - Schema versioning
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, 'schema.sql');

let _db = null;

/**
 * Get or create the database connection.
 * @param {string} [dbPath] - Override database file path
 * @returns {Database.Database}
 */
export function getDb(dbPath) {
  if (_db) return _db;

  const ROOT = process.cwd();
  const resolvedPath = dbPath || join(ROOT, 'data', 'career-ops.db');

  // Ensure data directory exists
  const dir = dirname(resolvedPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  _db = new Database(resolvedPath);

  // Performance pragmas
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('cache_size = -20000'); // 20MB cache

  // Auto-initialize schema if tables don't exist
  initSchema(_db);

  return _db;
}

/**
 * Initialize database schema from schema.sql.
 * Only creates tables that don't exist (IF NOT EXISTS).
 */
function initSchema(db) {
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');

  // Split by semicolons and execute each statement
  // Filter out PRAGMA statements (already applied above)
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('PRAGMA'));

  const transaction = db.transaction(() => {
    for (const stmt of statements) {
      try {
        db.exec(stmt);
      } catch (err) {
        // Ignore errors for already-existing objects
        if (!err.message.includes('already exists')) {
          console.error(`Schema error: ${err.message}\n  Statement: ${stmt.substring(0, 80)}...`);
        }
      }
    }
  });

  transaction();
}

/**
 * Get all rows from a query.
 * @param {string} sql
 * @param {object|Array} [params]
 * @returns {Array<object>}
 */
export function getAll(sql, params = {}) {
  const db = getDb();
  return db.prepare(sql).all(params);
}

/**
 * Get a single row from a query.
 * @param {string} sql
 * @param {object|Array} [params]
 * @returns {object|undefined}
 */
export function getOne(sql, params = {}) {
  const db = getDb();
  return db.prepare(sql).get(params);
}

/**
 * Run a modification query (INSERT, UPDATE, DELETE).
 * @param {string} sql
 * @param {object|Array} [params]
 * @returns {{ changes: number, lastInsertRowid: number }}
 */
export function run(sql, params = {}) {
  const db = getDb();
  return db.prepare(sql).run(params);
}

/**
 * Execute multiple statements in a transaction.
 * @param {function} fn - Function receiving (db) parameter
 * @returns {*} Return value of fn
 */
export function transaction(fn) {
  const db = getDb();
  const wrapped = db.transaction(fn);
  return wrapped(db);
}

/**
 * Close the database connection.
 */
export function close() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Get current schema version.
 * @returns {number}
 */
export function getSchemaVersion() {
  const db = getDb();
  try {
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get();
    return row?.v || 0;
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// Domain-specific query helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Get all applications, ordered by id desc.
 * @returns {Array<object>}
 */
export function getApplications() {
  return getAll(`
    SELECT id, date, company, role, score, status,
           pdf_generated, report_path, notes, url, source,
           created_at, updated_at
    FROM applications
    ORDER BY id DESC
  `);
}

/**
 * Upsert an application (insert or update on company+role conflict).
 * @param {object} app
 * @returns {{ changes: number, lastInsertRowid: number }}
 */
export function upsertApplication(app) {
  return run(`
    INSERT INTO applications (date, company, role, score, status, pdf_generated, report_path, notes, url, source)
    VALUES (@date, @company, @role, @score, @status, @pdf_generated, @report_path, @notes, @url, @source)
    ON CONFLICT(company, role) DO UPDATE SET
      score = excluded.score,
      status = excluded.status,
      pdf_generated = excluded.pdf_generated,
      report_path = excluded.report_path,
      notes = excluded.notes,
      url = excluded.url,
      updated_at = datetime('now')
  `, app);
}

/**
 * Update application status and/or notes by id.
 * @param {number} id
 * @param {object} updates - { status?, notes? }
 * @returns {boolean}
 */
export function updateApplicationStatus(id, updates) {
  const sets = [];
  const params = { id };

  if (updates.status !== undefined) {
    sets.push('status = @status');
    params.status = updates.status;
  }
  if (updates.notes !== undefined) {
    sets.push('notes = @notes');
    params.notes = updates.notes;
  }

  if (sets.length === 0) return false;

  sets.push("updated_at = datetime('now')");

  const result = run(`UPDATE applications SET ${sets.join(', ')} WHERE id = @id`, params);
  return result.changes > 0;
}

/**
 * Get all pipeline items.
 * @returns {Array<object>}
 */
export function getPipelineItems() {
  return getAll(`
    SELECT id, url, company, role, tag, status, discovered_at, source
    FROM pipeline
    ORDER BY id DESC
  `);
}

/**
 * Add items to pipeline (skip duplicates by URL).
 * @param {Array<object>} items
 * @returns {number} Number of new items added
 */
export function addPipelineItems(items) {
  let added = 0;
  transaction((db) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO pipeline (url, company, role, tag, source)
      VALUES (@url, @company, @role, @tag, @source)
    `);
    for (const item of items) {
      const result = stmt.run(item);
      if (result.changes > 0) added++;
    }
  });
  return added;
}

/**
 * Check if a URL has been seen in scan history.
 * @param {string} url
 * @returns {boolean}
 */
export function isUrlSeen(url) {
  const clean = url.split('?')[0];
  const row = getOne('SELECT 1 FROM scan_history WHERE url = ?', [clean]);
  return !!row;
}

/**
 * Get all seen URLs as a Set.
 * @returns {Set<string>}
 */
export function getSeenUrls() {
  const rows = getAll('SELECT url FROM scan_history');
  return new Set(rows.map(r => r.url));
}

/**
 * Add scan history entries.
 * @param {Array<object>} entries
 */
export function addScanHistory(entries) {
  transaction((db) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO scan_history (url, scanned_at, portal, title, company, status)
      VALUES (@url, @scanned_at, @portal, @title, @company, @status)
    `);
    for (const entry of entries) {
      stmt.run({
        url: entry.url.split('?')[0],
        scanned_at: entry.scanned_at || new Date().toISOString().split('T')[0],
        portal: entry.portal || '',
        title: entry.title || '',
        company: entry.company || '',
        status: entry.status || 'added',
      });
    }
  });
}

export default {
  getDb,
  getAll,
  getOne,
  run,
  transaction,
  close,
  getSchemaVersion,
  getApplications,
  upsertApplication,
  updateApplicationStatus,
  getPipelineItems,
  addPipelineItems,
  isUrlSeen,
  getSeenUrls,
  addScanHistory,
};
