/**
 * lib/ai/skill-gap.mjs — AI Skill Gap Analyzer
 * Compares CV skills vs JD requirements, generates learning path.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { askGeminiJSON } from './gemini.mjs';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const GAP_DIR = join(ROOT, 'data', 'skill-gaps');

export async function analyzeSkillGap(jdText, opts = {}) {
  let cvContent = '';
  const cvPath = join(ROOT, 'cv.md');
  if (existsSync(cvPath)) cvContent = readFileSync(cvPath, 'utf-8');

  let profileSkills = [];
  const profilePath = join(ROOT, 'config/profile.yml');
  if (existsSync(profilePath)) {
    try {
      const p = yaml.load(readFileSync(profilePath, 'utf-8'));
      profileSkills = p.candidate?.skills || [];
    } catch {}
  }

  const prompt = `Analyze the skill gap between this candidate and the job description.

## Current Skills (from CV + Profile)
CV sections: ${cvContent.slice(0, 3000)}
Profile skills: ${profileSkills.join(', ')}

## Target Job Requirements
${jdText.slice(0, 4000)}

Return JSON:
{
  "existingSkills": [{"name": "...", "proficiency": "expert|advanced|intermediate|beginner", "relevanceToJob": "critical|important|nice-to-have"}],
  "gapSkills": [{"name": "...", "importance": "critical|important|nice-to-have", "currentLevel": "none|beginner", "estimatedTimeToLearn": "weeks/months", "learningResources": [{"type": "course|book|project", "name": "...", "url": "..."}]}],
  "quickWins": ["Skills you already have that are undervalued in CV"],
  "learningPath": [{"priority": 1, "focus": "...", "estimatedWeeks": 2, "resources": ["..."]}],
  "overallGapScore": "low|medium|high",
  "shouldApply": true|false
}`;

  return await askGeminiJSON(prompt, opts) || { gapSkills: [], overallGapScore: 'medium', shouldApply: true };
}

export async function generateLearningPlan(gapAnalysis, opts = {}) {
  const prompt = `Create a detailed 4-week learning plan to close these skill gaps:

${JSON.stringify(gapAnalysis.gapSkills, null, 2)}

Return JSON:
{
  "weeklyPlan": [{ "week": 1, "focus": "...", "dailyTasks": ["..."], "projectsToBuild": ["..."], "hoursRequired": 10 }],
  "totalHours": 40,
  "recommendedCourses": [{"name": "...", "platform": "coursera|udemy|etc", "url": "..."}],
  "milestones": ["What you'll be able to do after each week"]
}`;
  return await askGeminiJSON(prompt, opts) || { weeklyPlan: [], totalHours: 0 };
}

export async function saveSkillGapReport(company, role, analysis) {
  if (!existsSync(GAP_DIR)) mkdirSync(GAP_DIR, { recursive: true });
  const slug = `${(company||'unknown').toLowerCase().replace(/[^a-z0-9]/g,'-')}-${(role||'role').toLowerCase().replace(/[^a-z0-9]/g,'-')}`;
  const path = join(GAP_DIR, `${slug}.json`);
  writeFileSync(path, JSON.stringify({ company, role, analyzedAt: new Date().toISOString(), ...analysis }, null, 2));
  return path;
}

export async function listGapReports() {
  if (!existsSync(GAP_DIR)) return [];
  const { readdirSync } = await import('fs');
  return readdirSync(GAP_DIR).filter(f => f.endsWith('.json'));
}

export default { analyzeSkillGap, generateLearningPlan, saveSkillGapReport, listGapReports };
