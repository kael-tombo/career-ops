/**
 * lib/ai/followup.mjs — AI Auto-Followup Generator
 * Tracks applications past due for followup and generates personalized emails.
 */
import { run } from '../db/index.mjs';
import { getApplicationsDueForFollowup as getDue } from '../tracker-parser.mjs';
import { askGemini } from './gemini.mjs';

export function getApplicationsDueForFollowup(daysSinceApplied = 7) {
  return getDue(daysSinceApplied);
}

export async function generateFollowupEmail(application, opts = {}) {
  const { company, role, daysSince } = application;
  const prompt = `Write a professional follow-up email for a job application.

Company: ${company}
Role: ${role}
Days since application: ${daysSince}

Instructions:
1. Polite, professional tone
2. Reference the role and application date
3. Reiterate interest
4. Ask for status update
5. Keep it to 3-4 sentences
6. Output ONLY the email body

Email:`;

  return await askGemini(prompt, opts);
}

export async function logFollowup(company, role, emailContent) {
  run(`INSERT INTO followups (company, role, email_snippet, sent_at) VALUES (?, ?, ?, ?)`,
    [company, role, emailContent.slice(0, 200), new Date().toISOString()]);
  return { company, role, sentAt: new Date().toISOString(), email: emailContent.slice(0, 200) };
}

export default { getApplicationsDueForFollowup, generateFollowupEmail, logFollowup };
