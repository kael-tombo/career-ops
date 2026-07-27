/**
 * lib/ai/deadline-tracker.mjs — AI Deadline Tracker
 * Extracts and tracks application deadlines from job descriptions.
 */
import { getAll, getOne, run } from '../db/index.mjs';
import { askGeminiJSON } from './gemini.mjs';

export function loadDeadlines() {
  return getAll('SELECT * FROM deadline_tracker ORDER BY tracked_at DESC');
}

export function saveDeadlines(deadlines) {
  run('DELETE FROM deadline_tracker');
  for (const d of deadlines) {
    run(`INSERT INTO deadline_tracker (url, company, role, has_deadline, deadline_date, deadline_type, timezone, priority, days_remaining, extracted_text, tracked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.url, d.company, d.role, d.hasDeadline ? 1 : 0, d.deadlineDate, d.deadlineType,
       d.timezone || '', d.priority || 'normal', d.daysRemaining || 0, d.extractedText || '', d.trackedAt || new Date().toISOString()]);
  }
}

export async function extractDeadlineFromJD(url, company, role, jdText, opts = {}) {
  const prompt = `Extract application deadline information from this job posting.

URL: ${url}
Company: ${company}
Role: ${role}
Job Description: ${jdText.slice(0, 3000)}

Return JSON:
{
  "hasDeadline": true|false,
  "deadlineDate": "YYYY-MM-DD or null if not found",
  "deadlineType": "hard|rolling|unknown",
  "timezone": "If specified",
  "priority": "urgent|normal|flexible",
  "daysRemaining": 0,
  "extractedText": "The exact text mentioning the deadline"
}`;

  return await askGeminiJSON(prompt, opts) || { hasDeadline: false, deadlineDate: null, deadlineType: 'unknown', daysRemaining: 0 };
}

export async function trackDeadline(url, company, role, jdText, opts = {}) {
  const extracted = await extractDeadlineFromJD(url, company, role, jdText, opts);
  run(`INSERT OR REPLACE INTO deadline_tracker (url, company, role, has_deadline, deadline_date, deadline_type, timezone, priority, days_remaining, extracted_text, tracked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [url, company, role, extracted.hasDeadline ? 1 : 0, extracted.deadlineDate, extracted.deadlineType,
     extracted.timezone || '', extracted.priority || 'normal', extracted.daysRemaining || 0,
     extracted.extractedText || '', new Date().toISOString()]);
  return extracted;
}

export function getUpcomingDeadlines(daysAhead = 14) {
  return getAll(
    `SELECT *, (julianday(deadline_date) - julianday('now')) AS days_remaining
     FROM deadline_tracker
     WHERE has_deadline = 1 AND deadline_date IS NOT NULL
       AND deadline_date >= date('now')
       AND deadline_date <= date('now', '+' || ? || ' days')
     ORDER BY deadline_date ASC`,
    [daysAhead]
  );
}

export function getOverdueDeadlines() {
  return getAll(
    `SELECT *, CAST(julianday('now') - julianday(deadline_date) AS INTEGER) AS days_overdue
     FROM deadline_tracker
     WHERE has_deadline = 1 AND deadline_date IS NOT NULL AND deadline_date < date('now')
     ORDER BY deadline_date ASC`
  );
}

export default { extractDeadlineFromJD, trackDeadline, getUpcomingDeadlines, getOverdueDeadlines, loadDeadlines };
