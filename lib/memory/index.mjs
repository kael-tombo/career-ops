/**
 * lib/memory/index.mjs — AI Memory System Core
 *
 * Persistent, self-improving knowledge base that learns from:
 *  - Every evaluation (scores, JD keywords, company patterns)
 *  - User feedback (score corrections, apply/skip decisions)
 *  - Application outcomes (responses, interviews, offers, rejections)
 *  - Company interaction history
 *  - Preference signals over time
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb, run, getOne, getAll } from '../db/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, 'schema.sql');
const ROOT = join(__dirname, '..', '..');

function ensureSchema() {
  const db = getDb();
  if (!existsSync(SCHEMA_PATH)) return;
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');
  for (const stmt of schema.split(';').filter(s => s.trim())) {
    try { db.exec(stmt); } catch { /* table may already exist */ }
  }
}

ensureSchema();

// ═══════════════════════════════════════════════════════════════
// LEARNINGS
// ═══════════════════════════════════════════════════════════════

/**
 * Store a learning fact.
 */
export function remember(category, key, value, { confidence = 0.5, source = '', metadata = {} } = {}) {
  run(`
    INSERT INTO memory_learnings (category, key, value, confidence, source, metadata, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(category, key) DO UPDATE SET
      value = excluded.value,
      confidence = excluded.confidence,
      source = excluded.source,
      metadata = excluded.metadata,
      updated_at = datetime('now')
  `, [category, key, JSON.stringify(typeof value === 'string' ? value : value), confidence, source, JSON.stringify(metadata)]);
}

/**
 * Recall a learning fact.
 */
export function recall(category, key) {
  const row = getOne('SELECT * FROM memory_learnings WHERE category = ? AND key = ?', [category, key]);
  if (!row) return null;
  return {
    ...row,
    value: tryParseJSON(row.value),
    metadata: tryParseJSON(row.metadata),
  };
}

/**
 * Search across learnings.
 */
export function searchLearnings({ category, query, minConfidence = 0, limit = 50 } = {}) {
  let sql = 'SELECT * FROM memory_learnings WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (query) { sql += ' AND (key LIKE ? OR value LIKE ?)'; params.push(`%${query}%`, `%${query}%`); }
  sql += ' AND confidence >= ? ORDER BY confidence DESC, updated_at DESC LIMIT ?';
  params.push(minConfidence, limit);
  return getAll(sql, params).map(r => ({ ...r, value: tryParseJSON(r.value), metadata: tryParseJSON(r.metadata) }));
}

/**
 * Get summary stats across all learnings.
 */
export function getLearningStats() {
  return {
    total: getOne('SELECT COUNT(*) as c FROM memory_learnings')?.c || 0,
    byCategory: getAll('SELECT category, COUNT(*) as count, AVG(confidence) as avg_confidence FROM memory_learnings GROUP BY category'),
    recent: getAll('SELECT * FROM memory_learnings ORDER BY updated_at DESC LIMIT 20').map(r => ({ ...r, value: tryParseJSON(r.value) })),
  };
}

// ═══════════════════════════════════════════════════════════════
// FEEDBACK
// ═══════════════════════════════════════════════════════════════

/**
 * Record user feedback on an evaluation.
 */
export function recordFeedback({ company, role, url, originalScore, userScore, userRating, userNotes, actionTaken }) {
  const result = run(`
    INSERT INTO memory_feedback (company, role, url, original_score, user_score, user_rating, user_notes, action_taken)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [company, role, url, originalScore, userScore, userRating, userNotes || '', actionTaken || '']);

  processFeedbackIntoPreferences({ company, role, score: userScore || originalScore, action: actionTaken });
  updateCompanyIntel({ company, action: actionTaken, score: userScore || originalScore });

  return { id: result?.lastInsertRowid || null };
}

/**
 * Get feedback history.
 */
export function getFeedback({ company, limit = 50 } = {}) {
  let sql = 'SELECT * FROM memory_feedback WHERE 1=1';
  const params = [];
  if (company) { sql += ' AND company = ?'; params.push(company); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  return getAll(sql, params);
}

/**
 * Get feedback summary stats.
 */
export function getFeedbackStats() {
  return {
    total: getOne('SELECT COUNT(*) as c FROM memory_feedback')?.c || 0,
    avgUserScore: getOne('SELECT AVG(user_score) as avg FROM memory_feedback WHERE user_score IS NOT NULL')?.avg || 0,
    avgRating: getOne('SELECT AVG(user_rating) as avg FROM memory_feedback WHERE user_rating IS NOT NULL')?.avg || 0,
    byAction: getAll('SELECT action_taken, COUNT(*) as count FROM memory_feedback GROUP BY action_taken'),
    recent: getAll('SELECT * FROM memory_feedback ORDER BY created_at DESC LIMIT 20'),
  };
}

// ═══════════════════════════════════════════════════════════════
// COMPANY INTELLIGENCE
// ═══════════════════════════════════════════════════════════════

/**
 * Get or create company intel record.
 */
function getCompanyRecord(company) {
  let record = getOne('SELECT * FROM memory_companies WHERE company = ?', [company]);
  if (!record) {
    run('INSERT INTO memory_companies (company) VALUES (?)', [company]);
    record = getOne('SELECT * FROM memory_companies WHERE company = ?', [company]);
  }
  return record;
}

/**
 * Update company intelligence from an interaction.
 */
export function updateCompanyIntel({ company, action, score = null, role = '', keywords = [] }) {
  if (!company) return;
  const record = getCompanyRecord(company);

  const updates = {
    total_jobs_seen: (record.total_jobs_seen || 0) + 1,
    last_interaction: new Date().toISOString(),
  };

  if (action === 'applied' || action === 'Applied') updates.total_applied = (record.total_applied || 0) + 1;
  else if (action === 'skipped' || action === 'SKIP' || action === 'Discarded') updates.total_skipped = (record.total_skipped || 0) + 1;
  else if (action === 'responded' || action === 'Responded') updates.total_responded = (record.total_responded || 0) + 1;
  else if (action === 'interview' || action === 'Interview') updates.total_interviewed = (record.total_interviewed || 0) + 1;
  else if (action === 'offer' || action === 'Offer') updates.total_offers = (record.total_offers || 0) + 1;
  else if (action === 'rejected' || action === 'Rejected') updates.total_rejected = (record.total_rejected || 0) + 1;
  else if (action === 'evaluated' || action === 'Evaluated') { /* just increment seen */ }

  if (score !== null) {
    const oldAvg = record.avg_score || 0;
    const oldCount = record.total_jobs_seen || 0;
    updates.avg_score = oldCount > 0 ? (oldAvg * oldCount + score) / (oldCount + 1) : score;
  }

  if (role) {
    const existingRoles = tryParseJSON(record.common_roles) || [];
    if (!existingRoles.includes(role)) {
      existingRoles.push(role);
      updates.common_roles = JSON.stringify(existingRoles);
    }
  }

  if (keywords.length > 0 && action === 'applied') {
    const existingPreferred = tryParseJSON(record.preferred_keywords) || [];
    const updated = [...new Set([...existingPreferred, ...keywords])].slice(0, 50);
    updates.preferred_keywords = JSON.stringify(updated);
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const setValues = Object.values(updates);
  run(`UPDATE memory_companies SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`, [...setValues, record.id]);
}

/**
 * Get company intelligence.
 */
export function getCompanyIntel({ company, sortBy = 'total_jobs_seen', limit = 100 } = {}) {
  if (company) {
    const record = getOne('SELECT * FROM memory_companies WHERE company = ?', [company]);
    if (!record) return null;
    return {
      ...record,
      preferred_keywords: tryParseJSON(record.preferred_keywords),
      avoided_keywords: tryParseJSON(record.avoided_keywords),
      common_roles: tryParseJSON(record.common_roles),
    };
  }

  const allowedSorts = ['total_jobs_seen', 'total_applied', 'avg_score', 'last_interaction', 'total_interviewed'];
  const orderBy = allowedSorts.includes(sortBy) ? sortBy : 'total_jobs_seen';
  const records = getAll(`SELECT * FROM memory_companies ORDER BY ${orderBy} DESC LIMIT ?`, [limit]);
  return records.map(r => ({
    ...r,
    preferred_keywords: tryParseJSON(r.preferred_keywords),
    avoided_keywords: tryParseJSON(r.avoided_keywords),
    common_roles: tryParseJSON(r.common_roles),
  }));
}

/**
 * Get company intelligence summary.
 */
export function getCompanyStats() {
  return {
    total: getOne('SELECT COUNT(*) as c FROM memory_companies')?.c || 0,
    totalApplied: getOne('SELECT SUM(total_applied) as s FROM memory_companies')?.s || 0,
    totalResponded: getOne('SELECT SUM(total_responded) as s FROM memory_companies')?.s || 0,
    totalInterviewed: getOne('SELECT SUM(total_interviewed) as s FROM memory_companies')?.s || 0,
    totalOffers: getOne('SELECT SUM(total_offers) as s FROM memory_companies')?.s || 0,
    totalRejected: getOne('SELECT SUM(total_rejected) as s FROM memory_companies')?.s || 0,
    avgResponseRate: calculateResponseRate(),
    topCompanies: getAll('SELECT company, total_applied, total_responded, total_interviewed, avg_score FROM memory_companies ORDER BY total_jobs_seen DESC LIMIT 10'),
  };
}

function calculateResponseRate() {
  const totalApplied = getOne('SELECT SUM(total_applied) as s FROM memory_companies')?.s || 0;
  const totalResponded = getOne('SELECT SUM(total_responded) as s FROM memory_companies')?.s || 0;
  if (totalApplied === 0) return 0;
  return Math.round((totalResponded / totalApplied) * 100);
}

// ═══════════════════════════════════════════════════════════════
// PREFERENCES
// ═══════════════════════════════════════════════════════════════

/**
 * Record a preference signal.
 */
export function recordPreference(category, key, signalDelta = 1) {
  const existing = getOne('SELECT * FROM memory_preferences WHERE category = ? AND key = ?', [category, key]);
  if (existing) {
    run(`
      UPDATE memory_preferences SET signal = signal + ?, count = count + 1, last_seen = datetime('now')
      WHERE category = ? AND key = ?
    `, [signalDelta, category, key]);
  } else {
    run('INSERT INTO memory_preferences (category, key, signal, count) VALUES (?, ?, ?, 1)', [category, key, signalDelta]);
  }
}

/**
 * Get all preferences, optionally filtered by category.
 */
export function getPreferences({ category, minSignal = -Infinity, limit = 100 } = {}) {
  let sql = 'SELECT * FROM memory_preferences WHERE signal >= ?';
  const params = [minSignal];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY signal DESC, count DESC LIMIT ?';
  params.push(limit);
  return getAll(sql, params);
}

/**
 * Get preference summary.
 */
export function getPreferenceSummary() {
  const categories = getAll('SELECT category, COUNT(*) as count, SUM(signal) as total_signal, AVG(signal) as avg_signal FROM memory_preferences GROUP BY category');
  const topLikes = getAll("SELECT * FROM memory_preferences WHERE signal > 0 ORDER BY signal DESC LIMIT 20");
  const topDislikes = getAll("SELECT * FROM memory_preferences WHERE signal < 0 ORDER BY signal ASC LIMIT 20");
  return { categories, topLikes, topDislikes, total: getOne('SELECT COUNT(*) as c FROM memory_preferences')?.c || 0 };
}

/**
 * Process feedback into preference signals automatically.
 */
function processFeedbackIntoPreferences({ company, role, score, action }) {
  if (!role) return;

  const roleLower = role.toLowerCase();

  if (action === 'applied' || action === 'Applied') {
    recordPreference('role_type', roleLower, 0.5);
    const seniority = detectSeniority(roleLower);
    if (seniority) recordPreference('seniority', seniority, 0.3);
  } else if (action === 'skipped' || action === 'Discarded' || action === 'SKIP') {
    recordPreference('role_type', roleLower, -0.5);
  }

  if (score !== null) {
    if (score >= 4) {
      recordPreference('high_score', roleLower, 0.3 + score / 10);
    } else if (score <= 2) {
      recordPreference('low_score', roleLower, -0.3 - (5 - score) / 10);
    }
  }
}

function detectSeniority(role) {
  if (/senior|sr|staff|principal|lead|head|chief|director|vp|manager/i.test(role)) return 'senior';
  if (/junior|jr|associate|entry|trainee|intern/i.test(role)) return 'junior';
  if (/mid|intermediate|mid-level/i.test(role)) return 'mid';
  return null;
}

// ═══════════════════════════════════════════════════════════════
// PATTERNS
// ═══════════════════════════════════════════════════════════════

/**
 * Record a recognized pattern.
 */
export function recordPattern(patternType, pattern, weight = 0, metadata = {}) {
  const existing = getOne('SELECT * FROM memory_patterns WHERE pattern_type = ? AND pattern = ?', [patternType, pattern]);
  if (existing) {
    run(`
      UPDATE memory_patterns SET weight = weight + ?, sample_size = sample_size + 1, metadata = ?, updated_at = datetime('now')
      WHERE pattern_type = ? AND pattern = ?
    `, [weight, JSON.stringify(metadata), patternType, pattern]);
  } else {
    run('INSERT INTO memory_patterns (pattern_type, pattern, weight, sample_size, metadata) VALUES (?, ?, ?, 1, ?)',
      [patternType, pattern, weight, JSON.stringify(metadata)]);
  }
}

/**
 * Get patterns by type.
 */
export function getPatterns({ patternType, minWeight = 0, limit = 50 } = {}) {
  let sql = 'SELECT * FROM memory_patterns WHERE weight >= ?';
  const params = [minWeight];
  if (patternType) { sql += ' AND pattern_type = ?'; params.push(patternType); }
  sql += ' ORDER BY weight DESC, sample_size DESC LIMIT ?';
  params.push(limit);
  return getAll(sql, params).map(r => ({ ...r, metadata: tryParseJSON(r.metadata) }));
}

/**
 * Get pattern summary.
 */
export function getPatternStats() {
  return {
    total: getOne('SELECT COUNT(*) as c FROM memory_patterns')?.c || 0,
    byType: getAll('SELECT pattern_type, COUNT(*) as count, AVG(weight) as avg_weight FROM memory_patterns GROUP BY pattern_type'),
    topPatterns: getAll('SELECT * FROM memory_patterns ORDER BY weight DESC, sample_size DESC LIMIT 20').map(r => ({ ...r, metadata: tryParseJSON(r.metadata) })),
  };
}

// ═══════════════════════════════════════════════════════════════
// COMPREHENSIVE MEMORY QUERIES
// ═══════════════════════════════════════════════════════════════

/**
 * Get full memory snapshot for dashboard.
 */
export function getMemorySnapshot() {
  return {
    learnings: getLearningStats(),
    feedback: getFeedbackStats(),
    companies: getCompanyStats(),
    preferences: getPreferenceSummary(),
    patterns: getPatternStats(),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get learning-weighted score adjustment for a job.
 * Returns a modifier to add to the base LLM score.
 */
export function getScoreAdjustment({ company, role, keywords = [] }) {
  let adjustment = 0;

  const roleLower = (role || '').toLowerCase();
  const companyLower = (company || '').toLowerCase();

  const prefLikes = getPreferences({ category: 'role_type', minSignal: 0 });
  const prefDislikes = getPreferences({ category: 'role_type' }).filter(p => p.signal < 0);

  const like = prefLikes.find(p => roleLower.includes(p.key));
  const dislike = prefDislikes.find(p => roleLower.includes(p.key));

  if (like) adjustment += Math.min(0.5, like.signal / 10);
  if (dislike) adjustment -= Math.min(0.5, Math.abs(dislike.signal) / 10);

  const companyIntel = company ? getOne('SELECT * FROM memory_companies WHERE company = ?', [company]) : null;
  if (companyIntel) {
    if (companyIntel.total_interviewed > 0) adjustment += 0.3;
    if (companyIntel.total_rejected > (companyIntel.total_applied || 0) * 0.7) adjustment -= 0.3;
    if (companyIntel.total_offers > 0) adjustment += 0.5;
  }

  if (keywords.length > 0 && companyIntel) {
    const preferred = tryParseJSON(companyIntel.preferred_keywords) || [];
    const matchCount = keywords.filter(k => preferred.some(p => p.toLowerCase().includes(k.toLowerCase()))).length;
    adjustment += matchCount * 0.1;
  }

  return Math.max(-1.5, Math.min(1.5, adjustment));
}

/**
 * Learn from a completed evaluation.
 */
export function learnFromEvaluation({ company, role, score, url, jdKeywords = [], source = 'manual' }) {
  remember('evaluation', `${company}|${role}|${Date.now()}`, {
    company, role, score, url, jdKeywords, source,
  }, { confidence: 0.7, source });

  updateCompanyIntel({ company, role, action: 'evaluated', score, keywords: jdKeywords });

  if (score >= 4) {
    recordPreference('high_score_role', role.toLowerCase(), 0.2);
    if (jdKeywords.length > 0) {
      jdKeywords.forEach(kw => recordPreference('positive_keyword', kw.toLowerCase(), 0.15));
    }
  } else if (score <= 2) {
    recordPreference('low_score_role', role.toLowerCase(), -0.2);
    if (jdKeywords.length > 0) {
      jdKeywords.forEach(kw => recordPreference('negative_keyword', kw.toLowerCase(), -0.15));
    }
  }
}

/**
 * Learn from an application outcome.
 */
export function learnFromOutcome({ company, role, outcome, score, notes = '' }) {
  updateCompanyIntel({ company, role, action: outcome, score });

  if (outcome === 'offer' || outcome === 'Offer') {
    remember('success', company, { role, outcome, notes }, { confidence: 0.9, source: 'outcome' });
    recordPreference('successful_company', company.toLowerCase(), 0.5);
  } else if (outcome === 'rejected' || outcome === 'Rejected') {
    remember('rejection', company, { role, notes }, { confidence: 0.6, source: 'outcome' });
    recordPattern('rejection_reason', notes || 'no reason given', -0.3, { company, role });
  } else if (outcome === 'interview' || outcome === 'Interview') {
    remember('interview', company, { role, notes }, { confidence: 0.8, source: 'outcome' });
    recordPreference('interviewed_company', company.toLowerCase(), 0.3);
  }
}

/**
 * Get a comprehensive memory briefing for the AI to use during evaluations.
 */
export function getMemoryBriefing() {
  const topPatterns = getPatterns({ minWeight: 0.5, limit: 10 });
  const topPreferences = getPreferences({ minSignal: 1, limit: 10 });
  const topCompanies = getCompanyIntel({ sortBy: 'total_interviewed', limit: 10 });

  let briefing = '# AI Memory Briefing\n\n';

  if (topPreferences.length > 0) {
    briefing += '## Learned Preferences\n';
    topPreferences.forEach(p => {
      briefing += `- ${p.key}: signal ${p.signal >= 0 ? '+' : ''}${p.signal.toFixed(1)} (observed ${p.count}x)\n`;
    });
    briefing += '\n';
  }

  if (topPatterns.length > 0) {
    briefing += '## Recognized Patterns\n';
    topPatterns.forEach(p => {
      briefing += `- [${p.pattern_type}] ${p.pattern}: weight ${p.weight.toFixed(2)} (${p.sample_size} samples)\n`;
    });
    briefing += '\n';
  }

  if (topCompanies.length > 0) {
    briefing += '## Company Intelligence\n';
    topCompanies.slice(0, 5).forEach(c => {
      briefing += `- ${c.company}: ${c.total_applied || 0} applied, ${c.total_responded || 0} responses, ${c.total_interviewed || 0} interviews, avg score ${(c.avg_score || 0).toFixed(1)}\n`;
    });
    briefing += '\n';
  }

  return briefing;
}

function tryParseJSON(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return str; }
}

export default {
  remember, recall, searchLearnings, getLearningStats,
  recordFeedback, getFeedback, getFeedbackStats,
  updateCompanyIntel, getCompanyIntel, getCompanyStats,
  recordPreference, getPreferences, getPreferenceSummary,
  recordPattern, getPatterns, getPatternStats,
  getMemorySnapshot, getScoreAdjustment, getMemoryBriefing,
  learnFromEvaluation, learnFromOutcome,
};
