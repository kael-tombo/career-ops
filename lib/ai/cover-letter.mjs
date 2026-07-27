/**
 * lib/ai/cover-letter.mjs — AI Cover Letter Generator
 * Generates tailored cover letters for specific job applications.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { askGemini } from './gemini.mjs';

const ROOT = process.cwd();
const COVER_DIR = join(ROOT, 'output', 'cover-letters');

export async function generateCoverLetter(job, opts = {}) {
  const { company, role, hiringManager, description, jd } = job;
  const desc = description || jd || '';
  let cvContent = '';
  const cvPath = join(ROOT, 'cv.md');
  if (existsSync(cvPath)) cvContent = readFileSync(cvPath, 'utf-8');

  const prompt = `Write a professional cover letter for the following job application.

Company: ${company || 'Unknown'}
Role: ${role || 'Unknown'}
${hiringManager ? `Hiring Manager: ${hiringManager}` : ''}

## Job Description
${desc.slice(0, 4000)}

## Candidate CV
${cvContent.slice(0, 3000)}

## Instructions
1. Professional tone, 3-4 paragraphs
2. Opening: express interest and mention the role
3. Middle: connect specific CV achievements to job requirements
4. Closing: call to action, mention attached CV
5. Use "Dear ${hiringManager || 'Hiring Manager'},"
6. Output ONLY the letter body — no subject line, no signature block
7. Do not invent experience or metrics`;

  const letter = await askGemini(prompt, opts);

  if (!existsSync(COVER_DIR)) mkdirSync(COVER_DIR, { recursive: true });
  const slug = `${(company||'unknown').toLowerCase().replace(/[^a-z0-9]/g,'-')}-${(role||'role').toLowerCase().replace(/[^a-z0-9]/g,'-')}`;
  const path = join(COVER_DIR, `${slug}.md`);
  writeFileSync(path, letter);

  return { path, letter, slug };
}

export async function listCoverLetters() {
  if (!existsSync(COVER_DIR)) return [];
  const { readdirSync } = await import('fs');
  return readdirSync(COVER_DIR).filter(f => f.endsWith('.md'));
}

export default { generateCoverLetter, listCoverLetters };
