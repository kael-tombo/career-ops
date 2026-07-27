/**
 * lib/ai/auto-matcher.mjs — AI Auto-Matcher
 * Automatically matches new jobs to the best resume type,
 * schedules optimal apply time, and queues actions.
 */
import { matchResumeToJob } from '../resume-manager.mjs';
import { getAll, getOne, run } from '../db/index.mjs';
import { extractDeadlineFromJD } from './deadline-tracker.mjs';
import { getApplicationStats } from './rejection-analyzer.mjs';
import { askGeminiJSON } from './gemini.mjs';

export function loadAutoQueue() {
  return getAll('SELECT * FROM auto_queue ORDER BY queued_at DESC');
}

export function saveAutoQueue(queue) {
  run('DELETE FROM auto_queue');
  for (const q of queue) {
    run(`INSERT INTO auto_queue (url, company, role, matched_resume, match_score, priority, deadline, auto_queued, queued_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [q.url, q.company, q.role, q.matchedResume, q.matchScore, q.priority,
       q.deadline || null, q.autoQueued ? 1 : 0, q.queuedAt || new Date().toISOString()]);
  }
}

export async function autoMatchJob(job, opts = {}) {
  const { company, role, description, jd, url } = job;
  const desc = description || jd || '';

  const resumeMatch = matchResumeToJob({ company, role, description: desc });

  let deadline = null;
  if (desc) {
    deadline = await extractDeadlineFromJD(url, company, role, desc, opts);
  }

  return {
    url,
    company,
    role,
    matchedResume: resumeMatch.resumeId,
    matchedResumeLabel: resumeMatch.resumeLabel,
    matchScore: resumeMatch.score,
    deadline: deadline?.hasDeadline ? deadline.deadlineDate : null,
    priority: resumeMatch.score > 50 ? 'high' : resumeMatch.score > 20 ? 'medium' : 'low',
    autoQueued: false,
  };
}

export async function batchAutoMatch(jobs, opts = {}) {
  const matched = [];
  for (const job of (jobs || []).slice(0, 50)) {
    const m = await autoMatchJob(job, opts);
    matched.push(m);
  }

  let newlyQueued = 0;
  for (const m of matched) {
    const existing = getOne('SELECT 1 FROM auto_queue WHERE url = ?', [m.url]);
    if (!existing) {
      run(`INSERT INTO auto_queue (url, company, role, matched_resume, match_score, priority, deadline, auto_queued, queued_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [m.url, m.company, m.role, m.matchedResume, m.matchScore, m.priority, m.deadline, new Date().toISOString()]);
      newlyQueued++;
    }
  }

  const totalQueued = getOne('SELECT COUNT(*) AS count FROM auto_queue').count;
  return { matched, newlyQueued, totalQueued };
}

export function getQueuedByResume(resumeId) {
  return getAll('SELECT * FROM auto_queue WHERE matched_resume = ? ORDER BY queued_at DESC', [resumeId]);
}

export function getPriorityQueue(threshold = 'medium') {
  const levels = { critical: 0, high: 1, medium: 2, low: 3 };
  const min = levels[threshold] || 0;
  return getAll(
    `SELECT * FROM auto_queue ORDER BY
       CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 99 END ASC,
       deadline ASC`
  ).filter(q => {
    const lvl = levels[q.priority] || 99;
    return lvl <= min;
  });
}

export default { autoMatchJob, batchAutoMatch, getQueuedByResume, getPriorityQueue, loadAutoQueue };
