/**
 * lib/ai/job-priority.mjs — AI Job Priority Scorer
 * Scores and ranks new jobs based on historical success patterns.
 */
import { askGeminiJSON } from './gemini.mjs';
import { getApplicationStats, getRejectionData } from './rejection-analyzer.mjs';

export async function prioritizeJob(job, historicalPatterns, opts = {}) {
  const { company, role, description, jd, location, salary, remote } = job;
  const desc = description || jd || '';

  const prompt = `Score this job's priority based on historical success patterns.

## Job
Company: ${company || 'Unknown'}
Role: ${role || 'Unknown'}
Location: ${location || 'Unknown'}
Salary: ${salary || 'Unknown'}
Remote: ${remote !== undefined ? remote : 'Unknown'}
Description: ${desc.slice(0, 2000)}

## Historical Patterns
${JSON.stringify(historicalPatterns, null, 2).slice(0, 1500)}

Return JSON:
{
  "priorityScore": 1-100,
  "priorityLabel": "critical|high|medium|low",
  "factors": [{"factor": "...", "impact": "+/- N points"}],
  "recommendedAction": "apply-now|research-first|consider|skip",
  "reasoning": "Brief explanation of score"
}`;

  return await askGeminiJSON(prompt, opts) || { priorityScore: 50, priorityLabel: 'medium', recommendedAction: 'consider' };
}

export async function batchPrioritize(jobs, opts = {}) {
  const results = [];
  for (const job of (jobs || []).slice(0, 20)) {
    const scored = await prioritizeJob(job, {}, opts);
    results.push({ ...job, ...scored });
  }
  return results.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
}

export default { prioritizeJob, batchPrioritize };
