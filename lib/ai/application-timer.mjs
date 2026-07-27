/**
 * lib/ai/application-timer.mjs — AI Application Timer
 * Analyzes optimal application timing based on historical success patterns.
 */
import { parseTracker } from '../tracker-parser.mjs';
import { askGeminiJSON } from './gemini.mjs';

export function getApplicationTimeline() {
  return parseTracker()
    .filter(a => a.date)
    .map(a => ({
      date: a.date,
      company: a.company,
      status: a.status,
      dayOfWeek: new Date(a.date).getDay(),
    }));
}

export async function analyzeBestTiming(timeline, opts = {}) {
  const prompt = `Analyze this application timeline to find optimal timing patterns.

${JSON.stringify(timeline.slice(-50), null, 2)}

Return JSON:
{
  "bestDayOfWeek": "Monday|Tuesday|etc",
  "bestTimeOfDay": "morning|afternoon|evening",
  "dayRanking": [{"day": "Monday", "successRate": "X%", "sampleSize": 5}],
  "timeRanking": [{"period": "morning", "successRate": "X%", "sampleSize": 5}],
  "insights": ["Key timing observations"],
  "recommendation": "When to submit applications for best results"
}`;

  return await askGeminiJSON(prompt, opts) || {
    bestDayOfWeek: 'Unknown', bestTimeOfDay: 'Unknown',
    dayRanking: [], timeRanking: [], insights: [], recommendation: ''
  };
}

export default { getApplicationTimeline, analyzeBestTiming };
