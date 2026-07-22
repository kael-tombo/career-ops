#!/usr/bin/env node

/**
 * prep-form.mjs — Autonomous Application Form Filler
 *
 * Opens a job application form in a visible browser, fills personal data,
 * uploads the tailored CV, and leaves the form ready for manual review.
 *
 * Usage:
 *   node prep-form.mjs <id>           # Prep form for application ID
 *   node prep-form.mjs 029            # Example: prep for Hawk application
 *
 * Supports: Greenhouse, Lever, Ashby, and generic ATS forms.
 */

import fs from 'fs';
import { join, resolve } from 'path';
import yaml from 'js-yaml';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const PROFILE_PATH = join(ROOT, 'config/profile.yml');
const APPS_PATH = join(ROOT, 'data/applications.md');
const OUTPUT_DIR = join(ROOT, 'output');

/**
 * Parse the applications.md tracker and extract job details by ID.
 * Handles variable column positions and multiple link formats.
 */
async function getJobDetails(id) {
    if (!fs.existsSync(APPS_PATH)) {
        throw new Error(`Applications tracker not found at ${APPS_PATH}`);
    }

    const content = fs.readFileSync(APPS_PATH, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    // Find the header row to determine column positions
    const headerLine = lines.find(line => line.startsWith('| #') || line.startsWith('| ID'));
    if (!headerLine) {
        throw new Error('Could not find header row in applications.md');
    }

    const headers = headerLine.split('|').map(h => h.trim().toLowerCase());
    const idIdx = headers.findIndex(h => h === '#' || h === 'id');
    const companyIdx = headers.findIndex(h => h === 'company');
    const roleIdx = headers.findIndex(h => h === 'role');
    const reportIdx = headers.findIndex(h => h === 'report');
    const linksIdx = headers.findIndex(h => h === 'links');

    if (idIdx === -1 || companyIdx === -1 || roleIdx === -1) {
        throw new Error('Could not parse tracker columns. Expected: | # | Date | Company | Role | ...');
    }

    // Find the row with matching ID
    const dataLines = lines.filter(line => line.startsWith('|') && !line.startsWith('| #') && !line.startsWith('|---'));
    const row = dataLines.find(line => {
        const parts = line.split('|').map(p => p.trim());
        return parts[idIdx] === id || parts[idIdx] === id.padStart(3, '0');
    });

    if (!row) {
        throw new Error(`Application with ID ${id} not found in tracker`);
    }

    const parts = row.split('|').map(p => p.trim());
    const company = parts[companyIdx];
    const role = parts[roleIdx];

    // Extract URL from various sources (in priority order):
    let url = null;

    // 1. Check for [JD](url) in links column
    if (linksIdx !== -1 && parts[linksIdx]) {
        const jdMatch = parts[linksIdx].match(/\[JD\]\((https?:\/\/[^)]+)\)/);
        if (jdMatch) {
            url = jdMatch[1];
        }
    }

    // 2. Check for direct URL anywhere in the row
    if (!url) {
        const urlMatch = row.match(/\[JD\]\((https?:\/\/[^)]+)\)/);
        if (urlMatch) {
            url = urlMatch[1];
        }
    }

    return { id, company, role, url };
}

/**
 * Detect the ATS type from URL patterns
 */
function detectATSType(url) {
    if (!url) return 'unknown';
    if (url.includes('greenhouse.io')) return 'greenhouse';
    if (url.includes('lever.co')) return 'lever';
    if (url.includes('ashbyhq.com')) return 'ashby';
    if (url.includes('jobs.lever.co')) return 'lever';
    if (url.includes('boards.greenhouse.io')) return 'greenhouse';
    return 'generic';
}

/**
 * Fill form fields with profile data using comprehensive selectors
 */
async function fillFormFields(page, profile, atsType) {
    const nameParts = profile.candidate.full_name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const mappings = [
        // Name fields
        { selectors: ['input[name="first_name"]', 'input[id*="first_name" i]', 'input[placeholder*="First Name" i]'], value: firstName, label: 'First Name' },
        { selectors: ['input[name="last_name"]', 'input[id*="last_name" i]', 'input[placeholder*="Last Name" i]'], value: lastName, label: 'Last Name' },
        { selectors: ['input[name="full_name"]', 'input[name="fullName"]', 'input[id*="full_name" i]', 'input[placeholder*="Full Name" i]'], value: profile.candidate.full_name, label: 'Full Name' },

        // Contact fields
        { selectors: ['input[type="email"]', 'input[name="email"]', 'input[id*="email" i]', 'input[placeholder*="Email" i]'], value: profile.candidate.email, label: 'Email' },
        { selectors: ['input[type="tel"]', 'input[name="phone"]', 'input[id*="phone" i]', 'input[placeholder*="Phone" i]'], value: profile.candidate.phone, label: 'Phone' },

        // Social/profile links
        { selectors: ['input[name*="linkedin" i]', 'input[id*="linkedin" i]', 'input[placeholder*="LinkedIn" i]'], value: profile.candidate.linkedin, label: 'LinkedIn' },
        { selectors: ['input[name*="github" i]', 'input[id*="github" i]', 'input[placeholder*="GitHub" i]'], value: profile.candidate.github, label: 'GitHub' },
        { selectors: ['input[name*="portfolio" i]', 'input[name*="website" i]', 'input[name*="personal_url" i]', 'input[placeholder*="Portfolio" i]', 'input[placeholder*="Website" i]'], value: profile.candidate.portfolio_url, label: 'Portfolio' },

        // Location
        { selectors: ['input[name*="location" i]', 'input[name*="city" i]', 'input[name*="address" i]', 'input[placeholder*="Location" i]', 'input[placeholder*="City" i]'], value: profile.candidate.location, label: 'Location' },

        // Common additional fields
        { selectors: ['input[name*="zipcode" i]', 'input[name*="postal_code" i]', 'input[placeholder*="Zip" i]', 'input[placeholder*="Postal" i]'], value: profile.candidate.postal_code || '', label: 'Postal Code' },
        { selectors: ['input[name*="country" i]', 'input[placeholder*="Country" i]'], value: profile.candidate.country || 'Madagascar', label: 'Country' },
    ];

    let filledCount = 0;

    for (const mapping of mappings) {
        if (!mapping.value) continue; // Skip empty values

        for (const selector of mapping.selectors) {
            try {
                const input = page.locator(selector).first();
                const isVisible = await input.isVisible({ timeout: 500 });

                if (isVisible) {
                    const currentValue = await input.inputValue().catch(() => '');
                    if (!currentValue || currentValue.trim() === '') {
                        await input.fill(mapping.value);
                        console.log(`   ✅ ${mapping.label}: ${mapping.value.substring(0, 30)}${mapping.value.length > 30 ? '...' : ''}`);
                        filledCount++;
                    }
                    break; // Move to next mapping once we've filled this one
                }
            } catch (e) {
                // Selector not found, try next one
            }
        }
    }

    return filledCount;
}

/**
 * Handle CV upload with proper file chooser event handling
 */
async function uploadCV(page, id, company) {
    // Look for tailored CV files matching the ID
    const cvFiles = fs.readdirSync(OUTPUT_DIR).filter(f =>
        f.startsWith(`cv-${id}`) && f.endsWith('.pdf')
    );

    // Fallback: look for company-specific CVs
    if (cvFiles.length === 0) {
        const companySlug = company.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const allFiles = fs.readdirSync(OUTPUT_DIR).filter(f =>
            f.toLowerCase().includes(companySlug) && f.endsWith('.pdf')
        );
        cvFiles.push(...allFiles.slice(0, 1)); // Take first match
    }

    if (cvFiles.length === 0) {
        console.log('   ⚠️  No tailored CV found in output/ — will upload generic CV if available');
        // Fallback to most recent PDF
        const allPdfs = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.pdf'));
        if (allPdfs.length === 0) {
            console.log('   ❌ No CV PDFs found in output/');
            return false;
        }
        cvFiles.push(allPdfs[allPdfs.length - 1]);
    }

    const cvPath = resolve(OUTPUT_DIR, cvFiles[0]);
    console.log(`   📎 CV: ${cvFiles[0]}`);

    // Strategy 1: Look for file input that's directly visible
    const fileInput = page.locator('input[type="file"][accept*="pdf"], input[type="file"]');
    const fileInputCount = await fileInput.count();

    if (fileInputCount > 0) {
        try {
            const visibleFile = fileInput.first();
            const isVisible = await visibleFile.isVisible({ timeout: 1000 });
            if (isVisible) {
                await visibleFile.setInputFiles(cvPath);
                console.log('   ✅ CV uploaded via file input');
                return true;
            }
        } catch (e) {
            // File input not visible, try button click strategy
        }
    }

    // Strategy 2: Click upload button and wait for file chooser
    const uploadSelectors = [
        'button:has-text("Upload Resume")',
        'button:has-text("Upload CV")',
        'button:has-text("Add Resume")',
        'label:has-text("Resume")',
        'label:has-text("CV")',
        'a:has-text("Upload")',
    ];

    for (const selector of uploadSelectors) {
        try {
            const btn = page.locator(selector).first();
            const isVisible = await btn.isVisible({ timeout: 500 });

            if (isVisible) {
                const [fileChooser] = await Promise.all([
                    page.waitForEvent('filechooser', { timeout: 2000 }),
                    btn.click(),
                ]);

                await fileChooser.setFiles([cvPath]);
                console.log('   ✅ CV uploaded via file chooser');
                return true;
            }
        } catch (e) {
            // Try next selector
        }
    }

    console.log('   ⚠️  Could not find CV upload mechanism — please upload manually');
    return false;
}

/**
 * Handle common application questions (textarea fields)
 */
async function fillApplicationQuestions(page, profile) {
    const questions = [
        {
            selectors: ['textarea[name*="cover_letter" i]', 'textarea[placeholder*="cover letter" i]', 'textarea[id*="cover" i]'],
            value: generateCoverLetter(profile),
            label: 'Cover Letter'
        },
        {
            selectors: ['textarea[name*="why_us" i]', 'textarea[name*="why_company" i]', 'textarea[placeholder*="why do you want" i]', 'textarea[placeholder*="why are you interested" i]'],
            value: `I'm a full-stack Java engineer with 5 years of experience building mission-critical systems at industrial scale. My expertise in Java EE, Spring Boot 3, and cloud-native architecture aligns perfectly with your tech stack. I'm looking for a senior role where I can own architecture decisions and deliver impactful solutions.`,
            label: 'Why Us'
        },
        {
            selectors: ['textarea[name*="salary" i]', 'textarea[placeholder*="salary" i]', 'input[name*="salary" i]', 'input[placeholder*="salary" i]'],
            value: profile.compensation?.target_range || 'Negotiable',
            label: 'Salary Expectations'
        },
        {
            selectors: ['textarea[name*="start_date" i]', 'textarea[placeholder*="start date" i]', 'input[name*="start_date" i]', 'input[placeholder*="start date" i]'],
            value: 'Available immediately',
            label: 'Start Date'
        },
    ];

    let filledCount = 0;

    for (const question of questions) {
        for (const selector of question.selectors) {
            try {
                const field = page.locator(selector).first();
                const isVisible = await field.isVisible({ timeout: 500 });

                if (isVisible) {
                    const currentValue = await field.inputValue().catch(() => '');
                    if (!currentValue || currentValue.trim() === '') {
                        await field.fill(question.value);
                        console.log(`   ✅ ${question.label} filled`);
                        filledCount++;
                    }
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }
    }

    return filledCount;
}

/**
 * Generate a brief cover letter from profile data
 */
function generateCoverLetter(profile) {
    const name = profile.candidate.full_name;
    const roles = profile.target_roles?.primary?.join(', ') || 'Software Engineer';
    const superpowers = profile.narrative?.superpowers?.slice(0, 2).join('; ') || 'full-stack development and system architecture';

    return `Dear Hiring Team,

I'm ${name}, a ${roles} with 5 years of experience building production systems. My core strengths include ${superpowers}.

I'm excited about this opportunity because it aligns with my expertise in enterprise Java, distributed systems, and delivering measurable business impact. I've consistently reduced system response times from hours to seconds and improved deployment efficiency by 80%+.

I'd welcome the chance to discuss how my experience can contribute to your team's success.

Best regards,
${name}`;
}

/**
 * Main execution
 */
async function main() {
    const id = process.argv[2];
    if (!id) {
        console.error('❌ Usage: node prep-form.mjs <id>');
        console.error('   Example: node prep-form.mjs 029');
        process.exit(1);
    }

    // Load profile
    if (!fs.existsSync(PROFILE_PATH)) {
        console.error(`❌ Profile not found at ${PROFILE_PATH}`);
        console.error('   Run career-ops setup first: node career-ops.mjs');
        process.exit(1);
    }

    const profile = yaml.load(fs.readFileSync(PROFILE_PATH, 'utf-8'));

    // Get job details
    console.log(`🔍 Looking up application ID ${id}...`);
    let job;
    try {
        job = await getJobDetails(id);
    } catch (err) {
        console.error(`❌ ${err.message}`);
        process.exit(1);
    }

    if (!job.url) {
        console.error(`❌ No URL found for ${job.company} — ${job.role}`);
        console.error('   Please add a [JD](url) link to the applications tracker');
        process.exit(1);
    }

    const atsType = detectATSType(job.url);
    console.log(`🎯 ${job.company} — ${job.role}`);
    console.log(`🔗 ${job.url}`);
    console.log(`🏷️  ATS: ${atsType}`);

    // Launch browser
    const browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized']
    });

    const context = await browser.newContext({
        viewport: null,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    try {
        // Navigate to job posting
        console.log(`\n📡 Navigating to job posting...`);
        await page.goto(job.url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Click Apply button if present (for multi-step forms)
        console.log(`🖱️  Checking for Apply button...`);
        const applyBtns = [
            'button:has-text("Apply Now")',
            'button:has-text("Apply")',
            'a:has-text("Apply Now")',
            'a:has-text("Apply")',
            'button:has-text("Interested")',
        ];

        for (const selector of applyBtns) {
            try {
                const btn = page.locator(selector).first();
                if (await btn.isVisible({ timeout: 1500 })) {
                    console.log(`   ✅ Clicking: Apply`);
                    await btn.click();
                    await page.waitForTimeout(3000);
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }

        // Fill form fields
        console.log(`\n📝 Filling application form...`);
        const filledFields = await fillFormFields(page, profile, atsType);
        console.log(`   ✅ ${filledFields} fields filled`);

        // Upload CV
        console.log(`\n📤 Uploading CV...`);
        await uploadCV(page, id, job.company);

        // Fill application questions
        console.log(`\n📋 Filling application questions...`);
        const filledQuestions = await fillApplicationQuestions(page, profile);
        if (filledQuestions > 0) {
            console.log(`   ✅ ${filledQuestions} questions filled`);
        }

        // Final instructions
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🏁 AUTONOMOUS FORM PREP COMPLETE`);
        console.log(`${'='.repeat(60)}`);
        console.log(`✅ Profile data filled: ${filledFields} fields`);
        console.log(`✅ Application questions filled: ${filledQuestions}`);
        console.log(`\n⚠️  IMPORTANT: Please review all fields before submitting.`);
        console.log(`   • Check that all information is accurate`);
        console.log(`   • Verify CV is attached`);
        console.log(`   • Complete any remaining fields manually`);
        console.log(`\n🚀 When ready, click Submit/Send Application manually.`);
        console.log(`${'='.repeat(60)}`);

        // Keep browser open for manual review
        // Browser will remain open until user closes it

    } catch (err) {
        console.error(`\n❌ Error during form prep: ${err.message}`);
        console.log(`   Browser is still open — you can continue manually`);

        // Don't exit immediately, keep browser open
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
