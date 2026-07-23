#!/usr/bin/env node
/**
 * gemini-eval.mjs — Multi-Model Job Evaluation
 *
 * Evaluates a job posting using Google Gemini AI.
 * Supports fallback to other models.
 *
 * Usage:
 *   node gemini-eval.mjs <url|jd-file>     # Evaluate a job URL or local JD file
 *   node gemini-eval.mjs --list             # List available models
 *   node gemini-eval.mjs --model gemini-2.0-flash <url>
 *
 * Environment:
 *   GEMINI_API_KEY  — Required. Google AI API key.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const ROOT = process.cwd();
const MODELS = {
  'gemini-2.0-flash': { name: 'Gemini 2.0 Flash', fast: true },
  'gemini-2.0-pro': { name: 'Gemini 2.0 Pro', fast: false },
  'gemini-1.5-pro': { name: 'Gemini 1.5 Pro', fast: false },
  'gemini-1.5-flash': { name: 'Gemini 1.5 Flash', fast: true },
};

async function evaluateWithGemini(apiKey, modelName, jdText) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `You are an expert career advisor evaluating a job posting against a candidate's CV.

JOB DESCRIPTION:
${jdText.substring(0, 40000)}

Evaluate this job posting and return a JSON object with these fields:
- title (string): Job title
- company (string): Company name
- matchScore (0-100): Overall fit score
- strengths (string[]): 3-5 key strengths/alignments
- gaps (string[]): 3-5 potential gaps or mismatches
- recommendation (string): "strong apply", "apply", "consider", or "skip"
- reasoning (string): 2-3 sentence rationale
- keyRequirements (string[]): Top 5 requirements extracted from JD

Respond ONLY with valid JSON. No markdown, no explanation.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  try {
    return JSON.parse(text.replace(/^```json?\s*/, '').replace(/```$/, '').trim());
  } catch {
    return { raw: text, matchScore: 0, recommendation: 'skip', reasoning: 'Failed to parse model response' };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apiKey = process.env.GEMINI_API_KEY;

  if (args.includes('--list')) {
    console.log('Available models:');
    for (const [id, info] of Object.entries(MODELS)) {
      console.log(`  ${id} (${info.name}) ${info.fast ? '[fast]' : '[quality]'}`);
    }
    process.exit(0);
  }

  if (!apiKey) {
    console.error('GEMINI_API_KEY environment variable required');
    process.exit(1);
  }

  const modelFlag = args.indexOf('--model');
  const modelName = modelFlag >= 0 ? args[modelFlag + 1] : 'gemini-2.0-flash';
  const target = args.filter(a => !a.startsWith('--'))[0];

  if (!target) {
    console.error('Usage: node gemini-eval.mjs <url|jd-file> [--model <model>]');
    process.exit(1);
  }

  let jdText;
  if (target.startsWith('http://') || target.startsWith('https://')) {
    const res = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    jdText = await res.text();
  } else if (existsSync(target)) {
    jdText = readFileSync(target, 'utf-8');
  } else {
    console.error(`File not found: ${target}`);
    process.exit(1);
  }

  console.error(`Evaluating with ${modelName}...`);
  const result = await evaluateWithGemini(apiKey, modelName, jdText);

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
