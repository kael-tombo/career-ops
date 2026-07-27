/**
 * lib/ai/rejection-analyzer.mjs — AI Rejection Pattern Analyzer
 * Analyzes rejection patterns across all applications and suggests improvements.
 */
import { parseTracker, getApplicationStats } from '../tracker-parser.mjs';
import { askGeminiJSON } from './gemini.mjs';

export function getRejectionData() {
  return parseTracker()
    .filter(a => a.status === 'Rejected' || a.status === 'Discarded' || a.notes.toLowerCase().includes('rejected'))
    .map(a => ({
      date: a.date,
      company: a.company,
      role: a.role,
      status: a.status,
      notes: a.notes,
      score: a.score != null ? `${a.score}/5` : '',
    }));
}

export { getApplicationStats };

export async function analyzeRejectionPatterns(rejections, opts = {}) {
  const data = Array.isArray(rejections) ? rejections : getRejectionData();
  const stats = getApplicationStats();
  const prompt = `Analyze these rejection patterns and suggest improvements.

## Application Stats
Applied: ${stats.applied} | Rejected: ${stats.rejected} | Interview: ${stats.interview} | Offer: ${stats.offer}
Rejection rate: ${stats.applied > 0 ? Math.round(stats.rejected / stats.applied * 100) : 0}%

## Rejections Details
${JSON.stringify(data.slice(-20), null, 2)}

Return JSON:
{
  "patterns": [{"pattern": "...", "frequency": "high|medium|low", "evidence": "..."}],
  "topReasons": [{"reason": "...", "occurrences": 5, "advice": "..."}],
  "stageDropoff": {"applied": stats.applied, "screening": "How many make it past screening?", "interview": stats.interview, "offer": stats.offer},
  "improvements": [{"area": "...", "action": "...", "expectedImpact": "..."}],
  "overallHealth": "good|needsWork|critical",
  "recommendedFocus": "Single most important thing to improve"
}`;

  return await askGeminiJSON(prompt, opts) || { patterns: [], topReasons: [], improvements: [], overallHealth: 'needsWork' };
}

export default { getRejectionData, getApplicationStats, analyzeRejectionPatterns };
