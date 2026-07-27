/**
 * lib/ai/keyword-optimizer.mjs — AI Keyword Optimizer
 * Analyzes CV keyword gaps against job descriptions and suggests improvements.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { askGeminiJSON } from './gemini.mjs';

const ROOT = process.cwd();

export async function analyzeKeywordGap(cvContent, jdText, opts = {}) {
  const prompt = `Analyze this CV against the job description for keyword gaps.

## CV
${cvContent.slice(0, 3000)}

## Job Description
${jdText.slice(0, 4000)}

Return JSON:
{
  "missingKeywords": [{"keyword": "...", "importance": "critical|important|nice-to-have", "foundInCV": false}],
  "presentKeywords": [{"keyword": "...", "strength": "explicit|implied|weak"}],
  "suggestedAdditions": [{"section": "Skills|Experience|Summary", "text": "Suggested addition to CV", "reasoning": "..."}],
  "atsScore": 0-100,
  "improvementSuggestions": ["..."],
  "overallAssessment": "..."
}`;

  return await askGeminiJSON(prompt, opts) || { missingKeywords: [], atsScore: 50, improvementSuggestions: [] };
}

export async function bulkAnalyzeKeywords(cvPath, jdList, opts = {}) {
  const cv = existsSync(cvPath) ? readFileSync(cvPath, 'utf-8') : '';
  const results = [];
  for (const jd of jdList.slice(0, 20)) {
    const r = await analyzeKeywordGap(cv, jd.text || jd.description || '', opts);
    results.push({ url: jd.url, company: jd.company, ...r });
  }
  return { total: results.length, avgScore: Math.round(results.reduce((a,r) => a + (r.atsScore||0), 0) / results.length), results };
}

export default { analyzeKeywordGap, bulkAnalyzeKeywords };
