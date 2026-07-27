/**
 * lib/ai/interview-predict.mjs — AI Interview Question Predictor
 * Predicts likely interview questions from a JD + CV, categorized by type.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { askGeminiJSON } from './gemini.mjs';

const ROOT = process.cwd();

export async function predictQuestions(job, opts = {}) {
  const { company, role, description, jd } = job;
  const desc = description || jd || '';
  let cvContent = '';
  const cvPath = join(ROOT, 'cv.md');
  if (existsSync(cvPath)) cvContent = readFileSync(cvPath, 'utf-8');

  const prompt = `You are an interview coach. Predict likely interview questions for this job.

Company: ${company || 'Unknown'}
Role: ${role || 'Unknown'}

## Job Description
${desc.slice(0, 4000)}

## Candidate CV
${cvContent.slice(0, 3000)}

Return a JSON object with this exact structure:
{
  "technical": [{ "question": "...", "expectedConcepts": ["..."], "preparationTip": "..." }],
  "behavioral": [{ "question": "...", "starSituation": "Hint: ...", "preparationTip": "..." }],
  "systemDesign": [{ "question": "...", "keyAreas": ["..."], "preparationTip": "..." }],
  "companySpecific": [{ "question": "...", "whyThisMatters": "..." }],
  "estimatedDifficulty": "junior|mid|senior|staff"
}`;

  const result = await askGeminiJSON(prompt, opts);
  return result || { technical: [], behavioral: [], systemDesign: [], companySpecific: [], estimatedDifficulty: 'mid' };
}

export async function generateStudyPlan(questions, opts = {}) {
  const prompt = `Create a 3-day interview study plan from these questions.
${JSON.stringify(questions, null, 2)}

Return JSON: { "days": [{ "day": 1, "focus": "...", "tasks": ["..."], "estimatedHours": 2 }], "totalHours": 6 }`;
  return await askGeminiJSON(prompt, opts) || { days: [], totalHours: 0 };
}

export default { predictQuestions, generateStudyPlan };
