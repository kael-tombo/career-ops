-- Career-OPS v3.0 Database Schema
-- SQLite with WAL mode for concurrent access

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ═══════════════════════════════════════════════════════════════
-- Applications (replaces data/applications.md)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS applications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT    NOT NULL,
  company       TEXT    NOT NULL,
  role          TEXT    NOT NULL,
  score         REAL,
  status        TEXT    NOT NULL DEFAULT 'Evaluated',
  pdf_generated INTEGER DEFAULT 0,
  report_path   TEXT,
  notes         TEXT    DEFAULT '',
  url           TEXT    DEFAULT '',
  source        TEXT    DEFAULT '',
  created_at    TEXT    DEFAULT (datetime('now')),
  updated_at    TEXT    DEFAULT (datetime('now')),
  UNIQUE(company, role)
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_score ON applications(score);
CREATE INDEX IF NOT EXISTS idx_applications_date ON applications(date);

-- ═══════════════════════════════════════════════════════════════
-- Pipeline (replaces data/pipeline.md)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pipeline (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  url           TEXT    NOT NULL UNIQUE,
  company       TEXT,
  role          TEXT,
  tag           TEXT,
  status        TEXT    DEFAULT 'pending',
  discovered_at TEXT    DEFAULT (datetime('now')),
  source        TEXT    DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_pipeline_status ON pipeline(status);

-- ═══════════════════════════════════════════════════════════════
-- Scan History (replaces data/scan-history.tsv)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS scan_history (
  url           TEXT    PRIMARY KEY,
  scanned_at    TEXT    NOT NULL,
  portal        TEXT    DEFAULT '',
  title         TEXT    DEFAULT '',
  company       TEXT    DEFAULT '',
  status        TEXT    DEFAULT 'added'
);

CREATE INDEX IF NOT EXISTS idx_scan_history_company ON scan_history(company);

-- ═══════════════════════════════════════════════════════════════
-- Job Queue (replaces in-memory queue)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS job_queue (
  id            TEXT    PRIMARY KEY,
  type          TEXT    NOT NULL,
  payload       TEXT    DEFAULT '{}',
  state         TEXT    DEFAULT 'queued',
  result        TEXT,
  error         TEXT,
  attempts      INTEGER DEFAULT 0,
  max_attempts  INTEGER DEFAULT 3,
  created_at    TEXT    DEFAULT (datetime('now')),
  started_at    TEXT,
  completed_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_queue_state ON job_queue(state);

-- ═══════════════════════════════════════════════════════════════
-- Agent Memory (NEW — learned preferences, context)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agent_memory (
  key           TEXT    PRIMARY KEY,
  value         TEXT    NOT NULL,
  category      TEXT    NOT NULL DEFAULT 'general',
  updated_at    TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_category ON agent_memory(category);

-- ═══════════════════════════════════════════════════════════════
-- Schema versioning
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS schema_version (
  version       INTEGER PRIMARY KEY,
  applied_at    TEXT    DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════
-- Deadline Tracker (replaces data/deadlines.json)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS deadline_tracker (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  url           TEXT    NOT NULL,
  company       TEXT,
  role          TEXT,
  has_deadline  INTEGER DEFAULT 0,
  deadline_date TEXT,
  deadline_type TEXT    DEFAULT 'unknown',
  timezone      TEXT,
  priority      TEXT    DEFAULT 'normal',
  days_remaining INTEGER,
  extracted_text TEXT,
  tracked_at    TEXT    DEFAULT (datetime('now')),
  UNIQUE(url)
);

CREATE INDEX IF NOT EXISTS idx_deadline_date ON deadline_tracker(deadline_date);

-- ═══════════════════════════════════════════════════════════════
-- Auto-Queue (replaces data/auto-queue.json)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS auto_queue (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  url           TEXT    NOT NULL,
  company       TEXT,
  role          TEXT,
  matched_resume TEXT,
  match_score   REAL,
  priority      TEXT    DEFAULT 'low',
  deadline      TEXT,
  auto_queued   INTEGER DEFAULT 1,
  queued_at     TEXT    DEFAULT (datetime('now')),
  UNIQUE(url)
);

CREATE INDEX IF NOT EXISTS idx_auto_queue_priority ON auto_queue(priority);
CREATE INDEX IF NOT EXISTS idx_auto_queue_resume ON auto_queue(matched_resume);

-- ═══════════════════════════════════════════════════════════════
-- Followups (replaces data/followups.json)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS followups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company       TEXT    NOT NULL,
  role          TEXT,
  email_snippet TEXT,
  sent_at       TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_followups_company ON followups(company);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
