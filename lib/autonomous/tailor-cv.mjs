/**
 * lib/autonomous/tailor-cv.mjs — CV Auto-Tailoring Engine
 *
 * Reads base CV (cv.md — or a specific resume file from resumes/) + job
 * description, uses LLM (Gemini) to generate a tailored CV, converts to
 * PDF for application submission.
 *
 * When resumeId is provided, uses that resume file as the base instead
 * of cv.md. Falls back to cv.md if resume file not found.
 *
 * Pipeline position: After evaluation (score >= threshold), before apply.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const ROOT = process.cwd();
const CV_PATH = join(ROOT, 'cv.md');
const RESUMES_DIR = join(ROOT, 'resumes');
const TAILORED_DIR = join(ROOT, 'output', 'tailored');
const ARTICLE_PATH = join(ROOT, 'article-digest.md');

let geminiAvailable = true;

try {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
} catch {
  geminiAvailable = false;
}

export const TAILOR_DEFAULTS = {
  model: 'models/gemini-2.0-flash-001',
  temperature: 0.3,
  maxTokens: 4096,
};

/**
 * Tailor CV for a specific job.
 * @param {object} job - { url, company, role, description, resumeId? }
 * @param {object} [options]
 * @returns {Promise<{tailoredPath: string|null, success: boolean, error?: string, resumeUsed?: string}>}
 */
export async function tailorCV(job, options = {}) {
  const { company, role, url, resumeId } = job;
  const description = job.description || job.jd || '';

  // Pick the base CV: resume file > cv.md
  let baseCv = null;
  let resumeUsed = 'cv.md';

  if (resumeId) {
    const resumeFile = join(RESUMES_DIR, `${resumeId}.md`);
    if (existsSync(resumeFile)) {
      const raw = readFileSync(resumeFile, 'utf-8');
      // Strip YAML frontmatter if present
      const content = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
      if (content) {
        baseCv = content;
        resumeUsed = resumeId;
      }
    }
  }

  if (!baseCv) {
    if (existsSync(CV_PATH)) {
      baseCv = readFileSync(CV_PATH, 'utf-8');
      resumeUsed = 'cv.md';
    } else {
      return { tailoredPath: null, success: false, error: 'No cv.md found', resumeUsed: null };
    }
  }

  if (!geminiAvailable) {
    return { tailoredPath: null, success: false, error: 'Gemini not available', resumeUsed };
  }

  const articleDigest = existsSync(ARTICLE_PATH) ? readFileSync(ARTICLE_PATH, 'utf-8') : '';

  const prompt = buildTailorPrompt(baseCv, company, role, description, articleDigest);

  let tailored;
  try {
    tailored = await callLLM(prompt, options);
  } catch (err) {
    return { tailoredPath: null, success: false, error: err.message };
  }

  if (!existsSync(TAILORED_DIR)) {
    mkdirSync(TAILORED_DIR, { recursive: true });
  }

  const slug = `${(company || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${(role || 'role').toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const outputPath = join(TAILORED_DIR, `${slug}.md`);
  writeFileSync(outputPath, tailored);

  return { tailoredPath: outputPath, success: true, resumeUsed };
}

function buildTailorPrompt(baseCv, company, role, description, articleDigest) {
  return `You are a professional CV writer. Tailor the following CV for a specific job application.

## Job
- Company: ${company || 'Unknown'}
- Role: ${role || 'Unknown'}
- Description:
${description || 'N/A'}

## Base CV
${baseCv}

${articleDigest ? `## Proof Points / Articles\n${articleDigest}\n` : ''}

## Instructions
1. Keep the same overall structure and length as the base CV
2. Reorder bullet points to prioritize experience relevant to this role
3. Use keywords from the job description where they naturally fit
4. Rewrite summary/objective to target this specific role and company
5. Keep ALL metrics and achievements intact — never invent numbers
6. Keep the skills section but reorder to match job requirements
7. Output ONLY the tailored CV in clean markdown — no explanations`;
}

async function callLLM(prompt, options = {}) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: options.model || TAILOR_DEFAULTS.model,
    generationConfig: {
      temperature: options.temperature ?? TAILOR_DEFAULTS.temperature,
      maxOutputTokens: options.maxTokens || TAILOR_DEFAULTS.maxTokens,
    },
  });

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

/**
 * Convert tailored markdown CV to PDF.
 * @param {string} mdPath - Path to tailored .md file
 * @returns {Promise<string|null>} Path to generated PDF
 */
export async function mdToPdf(mdPath) {
  if (!existsSync(mdPath)) return null;

  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const md = readFileSync(mdPath, 'utf-8');
    const html = `<html><body style="font-family: sans-serif; max-width: 800px; margin: auto; padding: 20px;">
      <pre style="white-space: pre-wrap; font-family: inherit;">${md.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </body></html>`;

    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdfPath = mdPath.replace(/\.md$/, '.pdf');
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
    await browser.close();
    return pdfPath;
  } catch {
    const { execSync } = await import('child_process');
    try {
      const pdfPath = mdPath.replace(/\.md$/, '.pdf');
      execSync(`pandoc "${mdPath}" -o "${pdfPath}" --pdf-engine=pdflatex`, { stdio: 'ignore' });
      return pdfPath;
    } catch {
      return null;
    }
  }
}

export default { tailorCV, mdToPdf };
