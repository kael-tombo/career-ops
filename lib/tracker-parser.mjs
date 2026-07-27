/**
 * lib/tracker-parser.mjs — Canonical Tracker Parser
 *
 * Single source of truth for parsing data/applications.md.
 * Eliminates 4+ duplicate parsers scattered across modules.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const TRACKER_PATH = join(ROOT, 'data/applications.md');

/**
 * Parse applications.md and return structured application objects.
 * Supports both legacy and current table formats.
 * Pass a `content` string to parse inline (for testing); otherwise reads from disk.
 * @param {string} [inlineContent] — Optional markdown content to parse instead of reading the file.
 * @returns {Array<{id: number, date: string, company: string, role: string, status: string, score: number|null, pdf: boolean, report: string, notes: string, line: string}>}
 */
export function parseTracker(inlineContent) {
  const content = inlineContent ?? (existsSync(TRACKER_PATH) ? readFileSync(TRACKER_PATH, 'utf-8') : '');
  const lines = content.split('\n');

  const apps = [];
  let headerFound = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('| ---')) continue;
    if (trimmed.startsWith('|') && !headerFound) {
      headerFound = true;
      continue;
    }
    if (!trimmed.startsWith('|')) continue;

    const parts = trimmed.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length < 7) continue;

    const id = parseInt(parts[0], 10);
    if (isNaN(id)) continue;

    const scoreStr = parts[4] || '';
    const scoreMatch = scoreStr.match(/([\d.]+)\/5/);

    apps.push({
      id,
      date: parts[1] || '',
      company: parts[2] || '',
      role: parts[3] || '',
      score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
      status: parts[5] || '',
      pdf: parts[6]?.includes('✅') || false,
      report: parts[7] || '',
      notes: parts[8] || '',
      line,
    });
  }

  return apps;
}

/**
 * Get applications filtered by status.
 * @param {string} status
 * @param {string} [inlineContent] — Optional inline markdown (for testing)
 * @returns {Array}
 */
export function getByStatus(status, inlineContent) {
  return parseTracker(inlineContent).filter(a => a.status === status);
}

/**
 * Get all 'Applied' entries for follow-up checks.
 * @param {string|number} [inlineContentOrDays] — Optional inline markdown (for testing) or minDaysSince
 * @param {number} [minDaysSince] — Minimum days since applied
 * @returns {Array<{company: string, role: string, appliedDate: string, daysSince: number}>}
 */
export function getApplicationsDueForFollowup(inlineContentOrDays = 7, minDaysSince) {
  const now = new Date();
  let content;
  let days;
  if (typeof inlineContentOrDays === 'string') {
    content = inlineContentOrDays;
    days = minDaysSince ?? 7;
  } else {
    content = undefined;
    days = inlineContentOrDays;
  }
  return parseTracker(content)
    .filter(a => a.status === 'Applied' && a.date)
    .map(a => ({
      company: a.company,
      role: a.role,
      appliedDate: a.date,
      daysSince: Math.floor((now - new Date(a.date)) / (1000 * 60 * 60 * 24)),
    }))
    .filter(a => a.daysSince >= minDaysSince)
    .sort((a, b) => b.daysSince - a.daysSince);
}

/**
 * Get application statistics.
 * @param {string} [inlineContent] — Optional inline markdown (for testing)
 * @returns {{total: number, byStatus: object, applied: number, interviewed: number, offered: number, rejected: number, scoreAvg: number|null}}
 */
export function getApplicationStats(inlineContent) {
  const apps = parseTracker(inlineContent);
  const byStatus = {};

  for (const a of apps) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
  }

  const scored = apps.filter(a => a.score != null);
  const scoreAvg = scored.length > 0
    ? Math.round(scored.reduce((s, a) => s + a.score, 0) / scored.length * 10) / 10
    : null;

  return {
    total: apps.length,
    byStatus,
    applied: byStatus['Applied'] || 0,
    interviewed: byStatus['Interview'] || 0,
    offered: byStatus['Offer'] || 0,
    rejected: byStatus['Rejected'] || 0,
    scoreAvg,
  };
}

export default { parseTracker, getByStatus, getApplicationsDueForFollowup, getApplicationStats };
