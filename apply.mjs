#!/usr/bin/env node

/**
 * apply.mjs — Automatic job application form filler (SAFE MODE)
 *
 * Opens a visible browser, fills forms with profile data, uploads PDF.
 * DOES NOT auto-submit — requires manual review and submission.
 *
 * Usage:
 *   node apply.mjs --dry-run              # Default: fill forms, don't submit
 *   node apply.mjs --live --confirm       # LIVE: fill forms (still no auto-submit)
 *   node apply.mjs test                   # Alias for --dry-run
 *
 * Jobs are loaded from data/applications.md (status: "🎯 Aplicar" or "Applied").
 */

import { chromium } from 'playwright';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { loadConfig } from './lib/config.mjs';
import { detectATSType, logger, withRetry } from './lib/utils.mjs';
import { dirname, fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PDF_DIR = resolve(ROOT, 'output');
const APPS_PATH = resolve(ROOT, 'data/applications.md');

// Safety flags
const DRY_RUN = process.argv.includes('test') ||
  process.argv.includes('--dry-run') ||
  process.argv.includes('dry') ||
  !process.argv.includes('--live');
const LIVE_MODE = process.argv.includes('--live') && process.argv.includes('--confirm');

if (LIVE_MODE && DRY_RUN) {
  console.error('❌ Cannot use both --dry-run and --live');
  process.exit(1);
}

/**
 * Parse applications.md and return jobs ready to apply.
 */
function loadJobsToApply() {
  if (!existsSync(APPS_PATH)) {
    throw new Error('Applications tracker not found');
  }

  const content = readFileSync(APPS_PATH, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().startsWith('|'));

  // Find header
  const headerLine = lines.find(l => l.includes('| # |') || l.includes('| ID |'));
  if (!headerLine) throw new Error('Could not parse tracker header');

  const headers = headerLine.split('|').map(h => h.trim().toLowerCase()).filter(h => h);
  const statusIdx = headers.findIndex(h => h === 'status');
  const pdfIdx = headers.findIndex(h => h === 'pdf');

  // Parse rows
  return lines
    .filter(l => !l.startsWith('| #') && !l.startsWith('|---') && !l.startsWith('| ID'))
    .map(line => {
      const parts = line.split('|').map(p => p.trim()).filter((_, i) => i > 0);
      const row = {};
      headers.forEach((h, i) => row[h] = parts[i] || '');
      return row;
    })
    .filter(row => {
      const status = (row.status || '').toLowerCase();
      // Apply to: "Aplicar", "Applied", "Enviada", or scores >= 4.0
      return status.includes('aplicar') ||
        status.includes('applied') ||
        status.includes('enviada') ||
        (row.score && parseFloat(row.score) >= 4.0);
    });
}

/**
 * Upload PDF to file input.
 */
async function uploadPdf(page, pdfPath) {
  try {
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible({ timeout: 2000 })) {
      await fileInput.setInputFiles(pdfPath);
      return true;
    }
  } catch {
    // Try file chooser approach
    try {
      const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Resume"), button:has-text("CV")').first();
      if (await uploadBtn.isVisible({ timeout: 2000 })) {
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 3000 }),
          uploadBtn.click(),
        ]);
        await fileChooser.setFiles([pdfPath]);
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Fill form and prepare for submission.
 * NEVER auto-submits — always requires manual review.
 */
async function fillAndPrepare(page, job, profile) {
  const pdfPath = resolve(PDF_DIR, job.pdf);
  const url = job.url || job.links || '';
  const company = job.company || 'Unknown';
  const role = job.role || 'Unknown Role';

  console.log(`\n📋 Preparing: ${company} — ${role}`);
  console.log(`   URL: ${url || '(no URL provided)'}`);
  console.log(`   PDF: ${job.pdf || '(none)'}`);

  if (!url) {
    console.log('   ⚠️  Skipping — no URL in tracker');
    return { success: false, reason: 'No URL' };
  }

  try {
    // Navigate to job posting
    await withRetry(
      async () => {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
      },
      {
        maxRetries: 2, baseDelay: 1000, onRetry: (err, attempt) => {
          console.log(`   🔄 Navigation retry ${attempt}/2: ${err.message}`);
        }
      }
    );

    // Click Apply button if present (multi-step forms)
    const applySelectors = [
      'button:has-text("Apply Now")',
      'button:has-text("Apply")',
      'a:has-text("Apply Now")',
      'a:has-text("Apply")',
    ];

    for (const selector of applySelectors) {
      try {
        const btn = page.locator(selector).first();
        if (await btn.isVisible({ timeout: 1500 })) {
          console.log(`   🖱️  Clicking Apply...`);
          await btn.click();
          await page.waitForTimeout(3000);
          break;
        }
      } catch {
        // Try next selector
      }
    }

    // Fill personal info
    const name = profile.candidate.full_name.split(' ');
    const fields = [
      { selectors: ['input[name="first_name"]', 'input[placeholder*="First Name" i]'], value: name[0] },
      { selectors: ['input[name="last_name"]', 'input[placeholder*="Last Name" i]'], value: name.slice(1).join(' ') },
      { selectors: ['input[type="email"]', 'input[name="email"]'], value: profile.candidate.email },
      { selectors: ['input[type="tel"]', 'input[name="phone"]'], value: profile.candidate.phone },
      { selectors: ['input[name*="linkedin" i]'], value: profile.candidate.linkedin },
    ];

    let filledCount = 0;
    for (const field of fields) {
      if (!field.value) continue;
      for (const selector of field.selectors) {
        try {
          const input = page.locator(selector).first();
          if (await input.isVisible({ timeout: 500 })) {
            const current = await input.inputValue().catch(() => '');
            if (!current.trim()) {
              await input.fill(field.value);
              filledCount++;
            }
            break;
          }
        } catch {
          // Try next selector
        }
      }
    }

    if (filledCount > 0) {
      console.log(`   ✅ Filled ${filledCount} fields`);
    }

    // Upload PDF
    let uploaded = false;
    if (existsSync(pdfPath)) {
      uploaded = await uploadPdf(page, pdfPath);
      if (uploaded) console.log(`   📄 PDF uploaded`);
    } else if (job.pdf) {
      console.log(`   ⚠️  PDF not found: ${job.pdf}`);
    }

    // Find submit button but DON'T click it — highlight it for user
    const submitBtn = await page.locator('button[type="submit"], input[type="submit"]').first();
    const hasSubmit = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasSubmit) {
      // Highlight the submit button for visibility
      await submitBtn.evaluate(el => {
        el.style.outline = '3px solid red';
        el.style.outlineOffset = '2px';
      });
      console.log(`   🔴 Submit button highlighted in RED — review and click manually`);
    }

    return { success: true, manual: true, filled: filledCount, uploaded };

  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 Career-Ops Application Prep`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (safe)' : 'LIVE (still requires manual submit)'}`);
  console.log(`   Browser: Visible (you control everything)`);
  console.log(`${'='.repeat(60)}\n`);

  if (DRY_RUN) {
    console.log('ℹ️  DRY RUN: Forms will be filled but NOT submitted.');
    console.log('   Review everything and click Submit manually.\n');
  }

  // Load profile
  let profile;
  try {
    profile = loadConfig(ROOT);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  // Load jobs
  let jobs;
  try {
    jobs = loadJobsToApply();
  } catch (err) {
    console.error(`❌ Failed to load jobs: ${err.message}`);
    process.exit(1);
  }

  if (jobs.length === 0) {
    console.log('ℹ️  No jobs ready to apply. Check tracker for jobs with status "🎯 Aplicar" or score >= 4.0');
    return;
  }

  console.log(`📦 Found ${jobs.length} job(s) to prepare\n`);

  // Limit via args
  const limitArg = process.argv.find(a => /^\d+$/.test(a));
  const limit = limitArg ? parseInt(limitArg) : jobs.length;
  const jobsToProcess = jobs.slice(0, limit);

  // Launch browser
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  let prepared = 0;
  let manual = 0;
  let failed = 0;

  try {
    for (let i = 0; i < jobsToProcess.length; i++) {
      const job = jobsToProcess[i];
      logger.progress(i + 1, jobsToProcess.length, `Preparing ${job.company}...`);

      const result = await fillAndPrepare(page, job, profile);
      if (result.success) {
        if (result.manual) manual++;
        else prepared++;
      } else {
        failed++;
      }

      // Wait between jobs (avoid rate limiting)
      if (i < jobsToProcess.length - 1) {
        await page.waitForTimeout(3000);
      }
    }
  } finally {
    // Keep browser open for user to review results
    console.log('\n💡 Browser kept open for you to review and submit applications manually');
    console.log('   Close the browser window when you are done.');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Preparation Complete!`);
  console.log(`   Prepared: ${prepared} | Manual review: ${manual} | Failed: ${failed}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\n⚠️  IMPORTANT: All applications require manual review before submission.`);
  console.log(`   • Verify all fields are accurate`);
  console.log(`   • Complete any custom questions`);
  console.log(`   • Click Submit manually when ready`);

  if (DRY_RUN) {
    console.log('\n💡 Run with --live --confirm to prepare with real data.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
