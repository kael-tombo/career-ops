/**
 * lib/ai/quality-scorer.mjs — AI Application Quality Scorer
 * Scores a tailored CV against a specific JD before submission.
 * Provides actionable improvement suggestions.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { askGeminiJSON } from './gemini.mjs';

const ROOT = process.cwd();

export async function scoreApplicationQuality(tailoredCvContent, jdText, opts = {}) {
  const prompt = `Score this tailored CV against the job description for application quality.

## Tailored CV
${tailoredCvContent.slice(0, 4000)}

## Job Description
${jdText.slice(0, 4000)}

Return JSON with EXACT structure:
{
  "overallScore": 0-100,
  "scoreBreakdown": {
    "keywordMatch": 0-100,
    "experienceRelevance": 0-100,
    "achievementQuality": 0-100,
    "formattingClarity": 0-100
  },
  "strengths": ["..."],
  "weaknesses": ["..."],
  "quickFixes": [{"priority": "high|medium|low", "action": "...", "expectedImpact": "..."}],
  "estimatedRank": "top 5%|top 10%|top 25%|top 50%|below average",
  "suggestedSummary": "Optimized summary line for this specific job",
  "readyToSubmit": true|false
}`;

  return await askGeminiJSON(prompt, opts) || { overallScore: 50, scoreBreakdown: {}, readyToSubmit: false };
}

export async function autoImproveCV(tailoredCvContent, jdText, opts = {}) {
  const quality = await scoreApplicationQuality(tailoredCvContent, jdText, opts);
  if (quality.readyToSubmit) return { quality, improvedCv: tailoredCvContent, changes: [] };

  const prompt = `Improve this CV for the job described. Keep ALL metrics intact. Do NOT invent experience.

## Current CV
${tailoredCvContent.slice(0, 4000)}

## Job Description
${jdText.slice(0, 4000)}

## Weaknesses to fix
${JSON.stringify(quality.weaknesses)}

Return the IMPROVED CV in clean markdown, then at the end add:
---
CHANGES MADE:
- change 1
- change 2`;

  const { askGemini } = await import('./gemini.mjs');
  const improved = await askGemini(prompt, opts);
  const parts = improved.split('---\nCHANGES MADE:\n');
  const changes = parts[1] ? parts[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.trim()) : [];

  return { quality, improvedCv: parts[0].trim(), changes };
}

export default { scoreApplicationQuality, autoImproveCV };
