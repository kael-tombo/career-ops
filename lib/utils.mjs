#!/usr/bin/env node
/**
 * lib/utils.mjs — Shared utilities for career-ops
 *
 * Centralizes common functions used across multiple scripts to prevent drift.
 * Import this instead of duplicating logic in every script.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const CAREER_OPS = dirname(fileURLToPath(import.meta.url));

// ─── Status Management ───────────────────────────────────────────────────────

/**
 * Canonical application statuses (source of truth: templates/states.yml)
 */
export const CANONICAL_STATES = [
  'Evaluated', 'Applied', 'Responded', 'Interview',
  'Offer', 'Rejected', 'Discarded', 'SKIP'
];

/**
 * Status aliases map — maps all known variations to canonical statuses
 */
const STATUS_ALIASES = {
  // Spanish → English
  'evaluada': 'Evaluated', 'condicional': 'Evaluated', 'hold': 'Evaluated',
  'evaluar': 'Evaluated', 'verificar': 'Evaluated',
  'aplicado': 'Applied', 'enviada': 'Applied', 'aplicada': 'Applied',
  'applied': 'Applied', 'sent': 'Applied',
  'respondido': 'Responded',
  'entrevista': 'Interview',
  'oferta': 'Offer',
  'rechazado': 'Rejected', 'rechazada': 'Rejected',
  'descartado': 'Discarded', 'descartada': 'Discarded',
  'cerrada': 'Discarded', 'cancelada': 'Discarded',
  'no aplicar': 'SKIP', 'no_aplicar': 'SKIP', 'skip': 'SKIP',
  'monitor': 'SKIP', 'geo blocker': 'SKIP',
  // Duplicates/reposts
  'duplicado': 'Discarded', 'dup': 'Discarded', 'repost': 'Discarded',
};

/**
 * Normalize a raw status string to canonical form.
 * @param {string} raw - Raw status from tracker
 * @returns {{ status: string, moveToNotes?: string }} Normalized status
 */
export function normalizeStatus(raw) {
  if (!raw) return { status: 'Discarded' };

  // Strip markdown bold and trim
  let s = raw.replace(/\*\*/g, '').trim();
  const lower = s.toLowerCase().trim();

  // Empty/em-dash → Discarded
  if (lower === '' || lower === '—' || lower === '-') {
    return { status: 'Discarded' };
  }

  // Check aliases first
  for (const [alias, canonical] of Object.entries(STATUS_ALIASES)) {
    if (lower === alias || lower.startsWith(alias + ' ')) {
      return { status: canonical };
    }
  }

  // Strip dates from status (e.g., "Applied 2026-04-12")
  const noDate = lower.replace(/\s+\d{4}-\d{2}-\d{2}.*$/, '').trim();
  if (STATUS_ALIASES[noDate]) {
    return { status: STATUS_ALIASES[noDate] };
  }

  // Already canonical
  for (const canonical of CANONICAL_STATES) {
    if (lower === canonical.toLowerCase()) {
      return { status: canonical };
    }
  }

  // Unknown → default to Evaluated with warning
  console.warn(`⚠️  Non-canonical status "${raw}" → defaulting to "Evaluated"`);
  return { status: 'Evaluated' };
}

/**
 * Validate if a status is canonical.
 */
export function isCanonicalStatus(status) {
  if (!status) return false;
  const clean = status.replace(/\*\*/g, '').trim();
  return CANONICAL_STATES.some(c => c.toLowerCase() === clean.toLowerCase());
}

// ─── Score Parsing ───────────────────────────────────────────────────────────

/**
 * Parse a score string to float. Handles "4.2/5", "4.2", "4.2 | PDF Ready", etc.
 * @param {string} raw - Raw score string
 * @returns {number|null} Parsed score or null
 */
export function parseScore(raw) {
  if (!raw) return null;
  const match = raw.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Format a score to standard "X.X/5" format.
 */
export function formatScore(score) {
  if (score == null) return 'N/A';
  return `${score.toFixed(1)}/5`;
}

// ─── Company/Role Normalization ──────────────────────────────────────────────

/**
 * Normalize company name for comparison.
 */
export function normalizeCompany(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

/**
 * Normalize role title for comparison.
 */
export function normalizeRole(role) {
  if (!role) return '';
  return role.toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 /]/g, '')
    .trim();
}

/**
 * Fuzzy match two role titles.
 * Returns true if they share 2+ significant words.
 */
export function roleFuzzyMatch(a, b) {
  const ROLE_STOPWORDS = new Set([
    'senior', 'junior', 'lead', 'staff', 'principal', 'head', 'chief',
    'manager', 'director', 'associate', 'intern', 'contractor',
    'remote', 'hybrid', 'onsite', 'engineer', 'engineering',
  ]);

  const wordsA = a.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !ROLE_STOPWORDS.has(w));
  const wordsB = b.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !ROLE_STOPWORDS.has(w));

  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const overlap = wordsA.filter(w => wordsB.some(wb => wb.includes(w) || w.includes(wb)));
  return overlap.length >= 2;
}

/**
 * Check if two role titles match (exact or fuzzy).
 */
export function roleMatch(a, b, options = {}) {
  const { strict = false } = options;
  if (strict) return normalizeRole(a) === normalizeRole(b);
  return roleFuzzyMatch(a, b);
}

// ─── Tracker Parsing ─────────────────────────────────────────────────────────

/**
 * Parse applications.md into structured data.
 * @param {string} filePath - Path to applications.md
 * @returns {{ headers: string[], rows: object[] }} Parsed tracker data
 */
export function parseTracker(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Tracker file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Find header row
  const headerLine = lines.find(line => line.startsWith('| #') || line.startsWith('| ID'));
  if (!headerLine) {
    throw new Error('Could not find header row in tracker');
  }

  const headers = headerLine.split('|').map(h => h.trim().toLowerCase()).filter(h => h);

  // Parse data rows
  const dataLines = lines.filter(line =>
    line.startsWith('|') &&
    !line.startsWith('| #') &&
    !line.startsWith('|---') &&
    !line.startsWith('| ID')
  );

  const rows = dataLines.map(line => {
    const parts = line.split('|').map(p => p.trim()).filter((_, idx) => idx > 0); // Remove first empty element
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = parts[idx] || '';
    });
    return row;
  });

  return { headers, rows };
}

/**
 * Find a job by ID in the tracker.
 * @param {string} filePath - Path to applications.md
 * @param {string} id - Job ID to find
 * @returns {object|null} Job details or null
 */
export function findJobById(filePath, id) {
  const { rows } = parseTracker(filePath);
  const idField = rows[0] && ('#' in rows[0]) ? '#' : 'id';

  return rows.find(row => {
    const rowId = row[idField];
    return rowId === id || rowId === id.padStart(3, '0');
  }) || null;
}

// ─── Profile Loading ─────────────────────────────────────────────────────────

/**
 * Load and validate candidate profile from config/profile.yml.
 * @param {string} rootPath - Project root directory
 * @returns {object} Profile data with defaults
 */
export function loadProfile(rootPath) {
  const profilePath = join(rootPath, 'config/profile.yml');

  if (!existsSync(profilePath)) {
    throw new Error(`Profile not found: ${profilePath}\nRun career-ops setup first.`);
  }

  const profile = yaml.load(readFileSync(profilePath, 'utf-8'));

  // Validate required fields
  const required = ['candidate.full_name', 'candidate.email'];
  for (const field of required) {
    const parts = field.split('.');
    let obj = profile;
    for (const part of parts) {
      if (obj == null || !(part in obj)) {
        throw new Error(`Missing required profile field: ${field}`);
      }
      obj = obj[part];
    }
  }

  // Apply defaults for optional fields
  profile.candidate.phone ||= '';
  profile.candidate.location ||= '';
  profile.candidate.linkedin ||= '';
  profile.candidate.github ||= '';
  profile.candidate.portfolio_url ||= '';
  profile.target_roles ||= { primary: [] };
  profile.narrative ||= {};
  profile.compensation ||= {};

  return profile;
}

// ─── Logging ─────────────────────────────────────────────────────────────────

/**
 * Simple logger with levels.
 */
export const logger = {
  level: process.env.CAREER_OPS_LOG_LEVEL || 'info',

  debug(...args) {
    if (this.level === 'debug') console.debug('[DEBUG]', ...args);
  },

  info(...args) {
    if (['info', 'debug'].includes(this.level)) console.log(...args);
  },

  warn(...args) {
    if (['info', 'warn', 'debug'].includes(this.level)) console.warn(...args);
  },

  error(...args) {
    console.error(...args);
  },

  // Progress indicator
  progress(current, total, message) {
    const pct = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    process.stdout.write(`\r[${bar}] ${pct}% — ${message}`);
    if (current === total) process.stdout.write('\n');
  }
};

// ─── Retry Logic ─────────────────────────────────────────────────────────────

/**
 * Retry a function with exponential backoff.
 * @param {Function} fn - Async function to retry
 * @param {object} options - Retry options
 * @returns {Promise<any>} Result of fn
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry = () => {}
  } = options;

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) break;

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      onRetry(err, attempt, delay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ─── ATS Detection ───────────────────────────────────────────────────────────

/**
 * Detect ATS type from job URL.
 */
export function detectATSType(url) {
  if (!url) return 'unknown';
  if (url.includes('greenhouse.io')) return 'greenhouse';
  if (url.includes('lever.co')) return 'lever';
  if (url.includes('ashbyhq.com')) return 'ashby';
  if (url.includes('jobs.lever.co')) return 'lever';
  if (url.includes('boards.greenhouse.io')) return 'greenhouse';
  if (url.includes('myworkdayjobs.com') || url.includes('myworkday.com')) return 'workday';
  if (url.includes('taleo.net')) return 'taleo';
  if (url.includes('sap.com') && url.includes('successfactors')) return 'successfactors';
  return 'generic';
}
