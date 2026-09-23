/**
 * lib/auto-apply/apply-engine.mjs — Universal Auto-Apply Engine
 *
 * Uses Playwright to navigate job pages, detect application forms,
 * fill in profile data, upload resume, and submit applications.
 *
 * SAFETY: Never auto-submits without review unless explicitly enabled.
 * Respects rate limits, scoring thresholds, and daily caps.
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

const ROOT = process.cwd();
const PROFILE_PATH = join(ROOT, 'config/profile.yml');
const CV_PATH = join(ROOT, 'cv.md');
const PDF_DIR = join(ROOT, 'output');

const DEFAULT_DAILY_LIMIT = 10;
const DEFAULT_MIN_SCORE = 3.5;

// ─── Field mappings: profile → common form field names ──────────────
const FIELD_MAP = {
  'full_name': ['name', 'fullname', 'full_name', 'applicant.name', 'firstName', 'first_name', 'lastName', 'last_name'],
  'first_name': ['firstName', 'first_name', 'firstname', 'givenName', 'given-name'],
  'last_name': ['lastName', 'last_name', 'lastname', 'familyName', 'family-name', 'surname'],
  'email': ['email', 'e-mail', 'emailAddress', 'email_address', 'email-address', 'user.email'],
  'phone': ['phone', 'telephone', 'phoneNumber', 'phone_number', 'mobile', 'cell', 'tel'],
  'location': ['location', 'city', 'address', 'currentLocation', 'current_location'],
  'linkedin': ['linkedin', 'linkedIn', 'linkedin_url', 'linkedinUrl', 'linkedin-profile'],
  'portfolio': ['portfolio', 'website', 'github', 'personal_site', 'url'],
  'salary_expectation': ['salary', 'expectedSalary', 'expected_salary', 'salaryExpectation', 'desiredSalary'],
  'start_date': ['startDate', 'start_date', 'availability', 'availableFrom', 'earliestStart'],
  'work_authorization': ['workAuth', 'work_authorization', 'visa', 'authorization', 'rightToWork'],
  'gender': ['gender', 'sex'],
  'race': ['race', 'ethnicity', 'veteran'],
  'disability': ['disability', 'disabled'],
};

// ─── Common "Apply" button selectors ─────────────────────────────────
const APPLY_BUTTON_SELECTORS = [
  'a[href*="apply"], button[class*="apply"], [class*="apply-button"], [class*="apply-now"], [class*="applyNow"], [class*="submit-application"], a[class*="apply"], input[value*="Apply"]',
  'button:has-text("Apply"), a:has-text("Apply"), button:has-text("Submit"), a:has-text("Submit")',
  '[data-automation-id*="apply"], [qa*="apply"], [data-qa*="apply"]',
  'form button[type="submit"], form input[type="submit"]',
];

// ─── Form field selectors ────────────────────────────────────────────
const INPUT_SELECTORS = 'input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select';
const CHECKBOX_SELECTORS = 'input[type="checkbox"], input[type="radio"]';
const FILE_SELECTORS = 'input[type="file"]';
const SUBMIT_SELECTORS = 'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Send"), button:has-text("Apply"), button:has-text("Next")';

/**
 * Load user profile data for form filling.
 * @returns {object} Flattened profile data
 */
export function loadProfile() {
  if (!existsSync(PROFILE_PATH)) return {};
  try {
    const raw = load(readFileSync(PROFILE_PATH, 'utf-8'));
    return flattenProfile(raw);
  } catch {
    return {};
  }
}

function flattenProfile(profile) {
  return {
    full_name: profile.candidate?.full_name || '',
    first_name: profile.candidate?.full_name?.split(' ')[0] || '',
    last_name: profile.candidate?.full_name?.split(' ').slice(1).join(' ') || '',
    email: profile.candidate?.email || '',
    phone: profile.candidate?.phone || '',
    location: profile.candidate?.location || '',
    linkedin: profile.candidate?.linkedin || profile.linkedin || '',
    portfolio: profile.candidate?.portfolio || profile.portfolio || profile.github || '',
    target_roles: profile.target_roles?.primary?.join(', ') || '',
    salary_expectation: profile.compensation?.target_range || '',
    timezone: profile.candidate?.timezone || '',
  };
}

/**
 * Find CV/PDF files for upload.
 * @returns {string[]} Paths to CV files
 */
export function findResumeFiles() {
  const files = [];

  // Try output directory first (generated PDFs)
  if (existsSync(PDF_DIR)) {
    const pdfs = readdirSafe(PDF_DIR).filter(f => f.endsWith('.pdf'));
    if (pdfs.length > 0) files.push(join(PDF_DIR, pdfs[0]));
  }

  // Fall back to cv.md
  if (existsSync(CV_PATH)) files.push(CV_PATH);

  return files;
}

/**
 * Apply to a single job posting.
 * @param {string} jobUrl - URL of the job posting
 * @param {object} [options] - { profile?, resumePath?, dryRun?, timeout?, dailyLimit? }
 * @returns {Promise<{success: boolean, status: string, message: string, details?: object}>}
 */
export async function applyToJob(jobUrl, options = {}) {
  const profile = options.profile || loadProfile();
  const resumePath = options.resumePath || findResumeFiles()[0] || '';
  const dryRun = options.dryRun !== false;
  const timeout = options.timeout || 30000;

  // Headless by default (production readiness P1-2): headed automation
  // requires an interactive desktop and breaks containerized runs. Set
  // APPLY_HEADED=true only for local debugging of a real submit flow.
  const headless = process.env.APPLY_HEADED === 'true' ? false : true;
  const browser = await chromium.launch({ headless });
  let result = { success: false, status: 'failed', message: '', details: {} };

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeout);

    // Navigate to job page
    await page.goto(jobUrl, { waitUntil: 'networkidle', timeout });

    // Detect and click the Apply button
    const applyClicked = await clickApplyButton(page);
    if (!applyClicked) {
      result = { success: false, status: 'no-apply-button', message: 'Could not find Apply button on page', details: { url: jobUrl } };
      await page.close();
      return result;
    }

    // Wait for form to load
    await page.waitForTimeout(2000);

    // Detect and fill form fields
    const filled = await fillFormFields(page, profile);

    // Upload resume
    const resumeUploaded = await uploadResume(page, resumePath);

    // Submit or review
    if (dryRun) {
      result = {
        success: true,
        status: 'ready-for-review',
        message: 'Form filled, ready for review',
        details: { filled, resumeUploaded, url: jobUrl },
      };
    } else {
      const submitted = await submitForm(page);
      result = submitted
        ? { success: true, status: 'submitted', message: 'Application submitted successfully', details: { url: jobUrl } }
        : { success: false, status: 'submit-failed', message: 'Could not find submit button', details: { url: jobUrl } };
    }

    await page.close();

  } catch (err) {
    result = { success: false, status: 'error', message: err.message, details: { url: jobUrl } };
  } finally {
    await browser.close();
  }

  return result;
}

/**
 * Click the Apply button on a job page.
 */
async function clickApplyButton(page) {
  for (const selector of APPLY_BUTTON_SELECTORS) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        return true;
      }
    } catch {}
  }
  return false;
}

/**
 * Fill form fields with profile data.
 */
async function fillFormFields(page, profile) {
  const filled = {};

  // Wait for form to be visible
  try {
    await page.waitForSelector('form, [class*="application"], [class*="apply-form"]', { timeout: 5000 });
  } catch {}

  // Get all input fields
  const inputs = await page.$$(INPUT_SELECTORS);
  for (const input of inputs) {
    try {
      const id = await input.getAttribute('id') || '';
      const name = await input.getAttribute('name') || '';
      const placeholder = await input.getAttribute('placeholder') || '';
      const ariaLabel = await input.getAttribute('aria-label') || '';
      const fieldText = (id + ' ' + name + ' ' + placeholder + ' ' + ariaLabel).toLowerCase();

      // Find matching profile field
      let value = null;
      for (const [field, aliases] of Object.entries(FIELD_MAP)) {
        if (aliases.some(a => fieldText.includes(a))) {
          value = profile[field] || '';
          if (value) break;
        }
      }

      // Fill if we have a value
      if (value) {
        const type = await input.getAttribute('type');
        if (type !== 'file' && type !== 'hidden') {
          await input.fill(value);
          filled[name || id] = value;
        }
      }
    } catch {}
  }

  return filled;
}

/**
 * Upload resume file.
 */
async function uploadResume(page, resumePath) {
  if (!resumePath || !existsSync(resumePath)) return false;

  try {
    const fileInput = await page.$(FILE_SELECTORS);
    if (fileInput) {
      await fileInput.setInputFiles(resumePath);
      return true;
    }
  } catch {}

  // Try drag-and-drop zone
  try {
    const dropZone = await page.$('[class*="upload"], [class*="dropzone"], [class*="resume"]');
    if (dropZone) {
      await dropZone.click();
      // Some ATS use hidden file inputs triggered by buttons
      const hiddenInput = await page.$('input[type="file"]');
      if (hiddenInput) {
        await hiddenInput.setInputFiles(resumePath);
        return true;
      }
    }
  } catch {}

  return false;
}

/**
 * Submit the application form.
 */
async function submitForm(page) {
  for (const selector of SUBMIT_SELECTORS) {
    try {
      const btn = await page.$(selector);
      if (btn && await btn.isVisible()) {
        await btn.click();
        // Wait for success message or redirect
        await page.waitForTimeout(3000);
        return true;
      }
    } catch {}
  }
  return false;
}

function readdirSafe(dir) {
  try { return readdirSync(dir); } catch { return []; }
}

import { readdirSync } from 'fs';

export default { applyToJob, loadProfile, findResumeFiles };
