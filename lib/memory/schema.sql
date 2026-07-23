-- Career-OPS Memory System Schema
-- Persistent AI learnings, feedback, and company intelligence

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ═══════════════════════════════════════════════════════════════
-- Learnings: key-value knowledge base (what the AI has learned)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS memory_learnings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT    NOT NULL DEFAULT 'general',
  key           TEXT    NOT NULL,
  value         TEXT    NOT NULL DEFAULT '{}',
  confidence    REAL    DEFAULT 0.5,
  source        TEXT    DEFAULT '',
  metadata      TEXT    DEFAULT '{}',
  created_at    TEXT    DEFAULT (datetime('now')),
  updated_at    TEXT    DEFAULT (datetime('now')),
  UNIQUE(category, key)
);

CREATE INDEX IF NOT EXISTS idx_memory_category ON memory_learnings(category);
CREATE INDEX IF NOT EXISTS idx_memory_confidence ON memory_learnings(confidence);

-- ═══════════════════════════════════════════════════════════════
-- Feedback: user corrections on evaluations
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS memory_feedback (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id  INTEGER,
  company         TEXT    NOT NULL,
  role            TEXT    NOT NULL,
  url             TEXT    DEFAULT '',
  original_score  REAL,
  user_score      REAL,
  user_rating     INTEGER, -- 1-5 stars
  user_notes      TEXT    DEFAULT '',
  action_taken    TEXT    DEFAULT '', -- 'applied', 'skipped', 'saved', 'discarded'
  created_at      TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_company ON memory_feedback(company);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON memory_feedback(user_rating);

-- ═══════════════════════════════════════════════════════════════
-- Company Intelligence: per-company interaction history
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS memory_companies (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  company               TEXT    NOT NULL UNIQUE,
  industry              TEXT    DEFAULT '',
  size_category         TEXT    DEFAULT '', -- 'startup', 'mid', 'enterprise'
  total_jobs_seen       INTEGER DEFAULT 0,
  total_applied         INTEGER DEFAULT 0,
  total_responded       INTEGER DEFAULT 0,
  total_interviewed     INTEGER DEFAULT 0,
  total_offers          INTEGER DEFAULT 0,
  total_rejected        INTEGER DEFAULT 0,
  total_skipped         INTEGER DEFAULT 0,
  avg_score             REAL    DEFAULT 0,
  avg_response_days     REAL    DEFAULT NULL,
  last_interaction      TEXT,
  preferred_keywords    TEXT    DEFAULT '[]', -- JSON array
  avoided_keywords      TEXT    DEFAULT '[]', -- JSON array
  common_roles          TEXT    DEFAULT '[]', -- JSON array
  notes                 TEXT    DEFAULT '',
  created_at            TEXT    DEFAULT (datetime('now')),
  updated_at            TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_companies_applied ON memory_companies(total_applied DESC);
CREATE INDEX IF NOT EXISTS idx_companies_score ON memory_companies(avg_score DESC);

-- ═══════════════════════════════════════════════════════════════
-- Preferences: learned user preferences over time
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS memory_preferences (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT    NOT NULL, -- 'role_type', 'tech_stack', 'company_size', 'industry', 'location', 'work_style'
  key           TEXT    NOT NULL, -- the specific value
  signal        REAL    DEFAULT 0, -- positive = liked, negative = disliked
  count         INTEGER DEFAULT 1,
  last_seen     TEXT    DEFAULT (datetime('now')),
  created_at    TEXT    DEFAULT (datetime('now')),
  UNIQUE(category, key)
);

CREATE INDEX IF NOT EXISTS idx_preferences_category ON memory_preferences(category);
CREATE INDEX IF NOT EXISTS idx_preferences_signal ON memory_preferences(signal DESC);

-- ═══════════════════════════════════════════════════════════════
-- Pattern Recognition: keyword and pattern analysis results
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS memory_patterns (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_type  TEXT    NOT NULL, -- 'keyword_correlation', 'rejection_reason', 'success_pattern'
  pattern       TEXT    NOT NULL,
  weight        REAL    DEFAULT 0,
  sample_size   INTEGER DEFAULT 1,
  metadata      TEXT    DEFAULT '{}',
  created_at    TEXT    DEFAULT (datetime('now')),
  updated_at    TEXT    DEFAULT (datetime('now')),
  UNIQUE(pattern_type, pattern)
);

CREATE INDEX IF NOT EXISTS idx_patterns_type ON memory_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_weight ON memory_patterns(weight DESC);
