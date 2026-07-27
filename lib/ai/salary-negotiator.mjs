/**
 * lib/ai/salary-negotiator.mjs — AI Salary Negotiator
 * Generates negotiation scripts based on offer details, market data, and profile.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { askGeminiJSON } from './gemini.mjs';
import yaml from 'js-yaml';

const ROOT = process.cwd();

export async function generateNegotiationScript(offer, opts = {}) {
  const { company, role, offeredSalary, currency, location, notes } = offer;

  let profile = {};
  const profilePath = join(ROOT, 'config/profile.yml');
  if (existsSync(profilePath)) {
    try { profile = yaml.load(readFileSync(profilePath, 'utf-8')); } catch {}
  }

  const targetRange = profile.compensation?.target_range || 'N/A';
  const minimum = profile.compensation?.minimum || 'N/A';

  const prompt = `You are a salary negotiation coach. Generate a negotiation strategy.

Company: ${company || 'Unknown'}
Role: ${role || 'Unknown'}
Offered: ${offeredSalary || 'Unknown'} ${currency || 'USD'}
Target Range: ${targetRange}
Minimum Acceptable: ${minimum}
Location: ${location || 'Remote'}
${notes ? `Context: ${notes}` : ''}

Return JSON:
{
  "assessment": "Is this offer fair, low, or high?",
  "marketContext": "Brief market rate context",
  "scripts": {
    "initialResponse": "Email/phone script for acknowledging the offer",
    "negotiationAsk": "Script for asking for more (with specific number)",
    "nonSalaryScript": "Script for negotiating non-salary items (equity, PTO, etc.)",
    "walkAwayScript": "Professional decline if minimum not met"
  },
  "recommendedAsk": "Suggested counter number with rationale",
  "nonSalaryItems": ["List of things to negotiate besides base salary"],
  "confidence": "high|medium|low"
}`;

  return await askGeminiJSON(prompt, opts) || { assessment: '', scripts: {}, recommendedAsk: '' };
}

export async function compareOffers(offers, opts = {}) {
  const prompt = `Compare these job offers and recommend the best overall:

${JSON.stringify(offers, null, 2)}

Return JSON:
{
  "rankings": [{ "company": "...", "rank": 1, "reasoning": "..." }],
  "totalCompComparison": { "bestBase": "...", "bestEquity": "...", "bestTotal": "..." },
  "nonCompFactors": [{ "company": "...", "pros": ["..."], "cons": ["..."] }],
  "recommendation": "..."
}`;
  return await askGeminiJSON(prompt, opts) || { rankings: [], recommendation: '' };
}

export default { generateNegotiationScript, compareOffers };
