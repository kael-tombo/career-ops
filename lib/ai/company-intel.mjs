/**
 * lib/ai/company-intel.mjs — AI Company Intelligence
 * Gathers structured intelligence on companies from their careers page, about page, and tech stack.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { askGeminiJSON } from './gemini.mjs';

const ROOT = process.cwd();
const INTEL_DIR = join(ROOT, 'data', 'company-intel');

export async function gatherCompanyIntel(company, opts = {}) {
  const { webSearch, webFetch } = opts;
  let aboutContent = '';
  let careersContent = '';

  if (webFetch) {
    try {
      const aboutUrl = `https://${company.toLowerCase().replace(/\s+/g, '')}.com/about`;
      const resp = await fetch(aboutUrl, { signal: AbortSignal.timeout(5000) });
      aboutContent = await resp.text();
      aboutContent = aboutContent.replace(/<[^>]*>/g, '').slice(0, 3000);
    } catch {}
    try {
      const careersUrl = `https://${company.toLowerCase().replace(/\s+/g, '')}.com/careers`;
      const resp = await fetch(careersUrl, { signal: AbortSignal.timeout(5000) });
      careersContent = await resp.text();
      careersContent = careersContent.replace(/<[^>]*>/g, '').slice(0, 3000);
    } catch {}
  }

  const prompt = `Analyze this company for a job applicant.

Company: ${company}

${aboutContent ? `## About Page\n${aboutContent}\n` : ''}
${careersContent ? `## Careers Page\n${careersContent}\n` : ''}

Return JSON:
{
  "companyName": "${company}",
  "industry": "...",
  "size": "startup|mid|enterprise",
  "fundingStage": "bootstrapped|seed|series-a|series-b|series-c|public|unknown",
  "engineeringCulture": ["..."],
  "techStackClues": ["..."],
  "remotePolicy": "remote|hybrid|onsite|unknown",
  "growthSignals": ["Recent growth indicators"],
  "redFlags": ["Potential concerns"],
  "interviewProcess": ["Expected stages based on industry/role"],
  "preparationTips": ["How to prepare for this specific company"],
  "cultureFitNotes": "...",
  "confidence": "high|medium|low"
}`;

  return await askGeminiJSON(prompt, opts) || {
    companyName: company, industry: 'unknown', size: 'unknown', remotePolicy: 'unknown', confidence: 'low'
  };
}

export async function saveCompanyIntel(company, intel) {
  if (!existsSync(INTEL_DIR)) mkdirSync(INTEL_DIR, { recursive: true });
  const slug = company.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const path = join(INTEL_DIR, `${slug}.json`);
  writeFileSync(path, JSON.stringify({ ...intel, updatedAt: new Date().toISOString() }, null, 2));
  return path;
}

export async function getCompanyIntel(company) {
  const slug = company.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const path = join(INTEL_DIR, `${slug}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export default { gatherCompanyIntel, saveCompanyIntel, getCompanyIntel };
