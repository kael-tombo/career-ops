/**
 * lib/server/routes/memory.mjs — AI Memory System API Routes
 *
 * Endpoints for the persistent learning system:
 *  - Learnings (store/recall/search)
 *  - Feedback (record user corrections)
 *  - Company intelligence
 *  - Preferences
 *  - Dashboard snapshot
 */

import {
  getMemorySnapshot, searchLearnings, recall,
  recordFeedback, getFeedback,
  getCompanyIntel, getCompanyStats,
  getPreferences, getPreferenceSummary,
  getPatterns, getScoreAdjustment, getMemoryBriefing,
  learnFromEvaluation, learnFromOutcome,
} from '../../memory/index.mjs';

export default async function memoryRoutes(fastify) {
  // ── Snapshot ────────────────────────────────────────────
  fastify.get('/api/memory', async () => getMemorySnapshot());

  // ── Learnings ───────────────────────────────────────────
  fastify.get('/api/memory/learnings', async (req) => {
    const { category, query, minConfidence, limit } = req.query;
    return searchLearnings({
      category: category || undefined,
      query: query || undefined,
      minConfidence: minConfidence ? parseFloat(minConfidence) : 0,
      limit: limit ? parseInt(limit) : 50,
    });
  });

  fastify.get('/api/memory/learnings/:category/:key', async (req) => {
    const result = recall(req.params.category, req.params.key);
    if (!result) return { error: 'not found' };
    return result;
  });

  // ── Feedback ────────────────────────────────────────────
  fastify.post('/api/memory/feedback', async (req, reply) => {
    const { company, role, url, originalScore, userScore, userRating, userNotes, actionTaken } = req.body;
    if (!company) return reply.code(400).send({ error: 'company required' });
    const result = recordFeedback({ company, role, url, originalScore, userScore, userRating, userNotes, actionTaken });
    return { success: true, ...result };
  });

  fastify.get('/api/memory/feedback', async (req) => {
    const { company, limit } = req.query;
    return getFeedback({
      company: company || undefined,
      limit: limit ? parseInt(limit) : 50,
    });
  });

  // ── Company Intelligence ─────────────────────────────────
  fastify.get('/api/memory/companies', async (req) => {
    const { company, sortBy, limit } = req.query;
    if (company) return getCompanyIntel({ company });
    return getCompanyIntel({
      sortBy: sortBy || 'total_jobs_seen',
      limit: limit ? parseInt(limit) : 100,
    });
  });

  fastify.get('/api/memory/companies/stats', async () => getCompanyStats());

  // ── Preferences ─────────────────────────────────────────
  fastify.get('/api/memory/preferences', async (req) => {
    const { category, minSignal, limit } = req.query;
    return getPreferences({
      category: category || undefined,
      minSignal: minSignal ? parseFloat(minSignal) : -Infinity,
      limit: limit ? parseInt(limit) : 100,
    });
  });

  fastify.get('/api/memory/preferences/summary', async () => getPreferenceSummary());

  // ── Patterns ────────────────────────────────────────────
  fastify.get('/api/memory/patterns', async (req) => {
    const { patternType, minWeight, limit } = req.query;
    return getPatterns({
      patternType: patternType || undefined,
      minWeight: minWeight ? parseFloat(minWeight) : 0,
      limit: limit ? parseInt(limit) : 50,
    });
  });

  // ── Score Adjustment (for pipeline) ─────────────────────
  fastify.post('/api/memory/adjust-score', async (req) => {
    const { company, role, keywords } = req.body || {};
    const adjustment = getScoreAdjustment({ company, role, keywords: keywords || [] });
    return { adjustment };
  });

  // ── Learn from evaluation (AI self-improvement) ─────────
  fastify.post('/api/memory/learn/evaluation', async (req) => {
    const { company, role, score, url, jdKeywords, source } = req.body || {};
    learnFromEvaluation({ company, role, score, url, jdKeywords, source });
    return { learned: true };
  });

  fastify.post('/api/memory/learn/outcome', async (req) => {
    const { company, role, outcome, score, notes } = req.body || {};
    learnFromOutcome({ company, role, outcome, score, notes });
    return { learned: true };
  });

  // ── Briefing (for AI context) ───────────────────────────
  fastify.get('/api/memory/briefing', async () => {
    return { briefing: getMemoryBriefing() };
  });
}
