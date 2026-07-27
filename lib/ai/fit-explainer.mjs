/**
 * lib/ai/fit-explainer.mjs — AI Fit Explainer
 * Generates human-readable breakdowns of why a score was given.
 * Attaches explainability metadata to every evaluation.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { askGeminiJSON } from './gemini.mjs';
import yaml from 'js-yaml';

const ROOT = process.cwd();

export async function explainScore(score, job, opts = {}) {
  const { company, role, description, jd } = job;
  const desc = description || jd || '';
  let cvContent = '';
  const cvPath = join(ROOT, 'cv.md');
  if (existsSync(cvPath)) cvContent = readFileSync(cvPath, 'utf-8');

  let profile = {};
  const profilePath = join(ROOT, 'config/profile.yml');
  if (existsSync(profilePath)) {
    try { profile = yaml.load(readFileSync(profilePath, 'utf-8')); } catch {}
  }

  const prompt = `Explain why this job scored ${score}/5 for this candidate.

## Score: ${score}/5

## Job
Company: ${company || 'Unknown'}
Role: ${role || 'Unknown'}
Description: ${desc.slice(0, 3000)}

## Candidate Profile
${JSON.stringify(profile, null, 2).slice(0, 2000)}

## CV Summary
${cvContent.slice(0, 2000)}

Return JSON:
{
  "overallSummary": "1-2 sentence explanation",
  "positiveFactors": [{"factor": "...", "weight": "high|medium|low", "detail": "..."}],
  "negativeFactors": [{"factor": "...", "weight": "high|medium|low", "detail": "..."}],
  "skillMatches": [{"skill": "...", "matchLevel": "exact|partial|gap", "evidence": "..."}],
  "improvementSuggestions": ["What would improve this score"],
  "recommendation": "apply|consider|skip",
  "confidenceInScore": "high|medium|low"
}`;

  return await askGeminiJSON(prompt, opts) || {
    overallSummary: `Job scored ${score}/5`,
    positiveFactors: [], negativeFactors: [],
    recommendation: score >= 3.5 ? 'apply' : 'skip',
    confidenceInScore: 'medium',
  };
}

export async function batchExplain(scores, opts = {}) {
  const results = [];
  for (const item of scores) {
    const explanation = await explainScore(item.score, item.job, opts);
    results.push({ url: item.job.url, company: item.job.company, score: item.score, ...explanation });
  }
  return results;
}

export default { explainScore, batchExplain };
