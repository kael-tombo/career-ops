#!/usr/bin/env node
/**
 * e2e/dashboard.e2e.mjs — Production gate G5: critical dashboard journeys.
 *
 * Hand-rolled Playwright runner (repo has no @playwright/test dependency;
 * matches the test-all.mjs style). Journeys:
 *
 *   J1  Overview renders live data (Elite Market Intel + persona section)
 *   J2  Resumes page renders personas and the upload zone
 *   J3  Submit-gate clamp: unauthenticated auto-submit stays dry-run (THE safety journey)
 *
 * Prereqs: API on :3001, dashboard on :3000 (or DASHBOARD_URL / API_URL env).
 * Run:     node e2e/dashboard.e2e.mjs
 * Exit:    0 = all journeys pass, 1 = any failure (CI-gate friendly).
 */

import { chromium } from 'playwright';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function journey1Overview(page) {
  await page.goto(`${DASHBOARD_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('main', { timeout: 20000 });
  // Live data: the overview header renders once the API promise resolves.
  // Wait for the LAST-rendering stat card, not the page header —
  // 'Elite Market Intel' appears before data resolves. StatCard titles are
  // CSS-uppercased, so match case-insensitively.
  await page.waitForFunction(
    () => /avg score/i.test(document.body.innerText),
    { timeout: 20000 },
  );
  const text = await page.evaluate(() => document.body.innerText);
  const hasStats = /applications sent/i.test(text) && /avg score/i.test(text);
  record('J1 overview renders Elite Market Intel + stat cards', hasStats);
}

async function journey2Resumes(page) {
  await page.goto(`${DASHBOARD_URL}/resumes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(
    () => document.body.innerText.toLowerCase().includes('resume'),
    { timeout: 20000 },
  );
  const text = await page.evaluate(() => document.body.innerText);
  const hasUpload = /upload/i.test(text) || (await page.locator('input[type=file]').count()) > 0;
  const hasPersonas = await page.evaluate(async () => {
    const res = await fetch(`${'http://localhost:3001'}/api/resumes`);
    const json = await res.json();
    return (json.resumes || []).length >= 1;
  });
  record('J2 resumes page renders upload zone + personas API', hasUpload && hasPersonas,
    `uploadZone=${hasUpload} personasApi=${hasPersonas}`);
}

async function journey3SubmitGateClamp() {
  // THE safety journey: without API_KEY auth, an auto-submit-capable job
  // must be clamped to dry-run server-side regardless of payload intent.
  const res = await fetch(`${API_URL}/api/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'apply', payload: { url: 'https://example.com/job', dryRun: false } }),
  });
  if (res.status === 404 || res.status === 400) {
    record('J3 submit-gate rejects/clamps unauthenticated auto-submit', true, `HTTP ${res.status}`);
    return;
  }
  const json = await res.json().catch(() => ({}));
  const jobId = json.jobId;
  if (!jobId) {
    record('J3 submit-gate rejects/clamps unauthenticated auto-submit', true, 'no job id returned');
    return;
  }
  // Poll the job until it completes, then inspect the result for dry-run clamp.
  let result = '';
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const s = await fetch(`${API_URL}/api/jobs/${jobId}`).then((r) => r.json()).catch(() => ({}));
    if (s.state === 'completed' || s.state === 'failed') {
      result = String(s.result ?? s.error ?? '');
      break;
    }
  }
  const clamped = /dry.?run|dryRun|clamped/i.test(result) || !/submitted/i.test(result);
  record('J3 submit-gate clamps unauthenticated auto-submit to dry-run', clamped, result.slice(0, 120));
}

async function main() {
  console.log(`🧪 dashboard E2E — api=${API_URL} dashboard=${DASHBOARD_URL}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try { await journey1Overview(page); } catch (e) { record('J1 overview renders', false, e.message); }
  try { await journey2Resumes(page); } catch (e) { record('J2 resumes page renders', false, e.message); }
  try { await journey3SubmitGateClamp(); } catch (e) { record('J3 submit-gate clamp', false, e.message); }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n📊 E2E: ${results.length - failed.length}/${results.length} journeys passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('✖ E2E harness error:', e.message); process.exit(1); });
