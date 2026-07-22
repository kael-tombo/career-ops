#!/usr/bin/env node

import fs from 'fs';
import { resolve, join } from 'path';
import yaml from 'js-yaml';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const PORTALS_PATH = join(ROOT, 'portals.yml');
const REGIONS_PATH = join(ROOT, 'config/regions.yml');
const HISTORY_PATH = join(ROOT, 'data/scan-history.tsv');
const PIPELINE_PATH = join(ROOT, 'data/pipeline.md');

async function loadConfig() {
    return yaml.load(fs.readFileSync(PORTALS_PATH, 'utf-8'));
}

async function loadRegions() {
    if (!fs.existsSync(REGIONS_PATH)) return {};
    return yaml.load(fs.readFileSync(REGIONS_PATH, 'utf-8')).regions || {};
}

async function getSeenUrls() {
    if (!fs.existsSync(HISTORY_PATH)) return new Set();
    const content = fs.readFileSync(HISTORY_PATH, 'utf-8');
    return new Set(content.split('\n').filter(l => l.trim()).map(line => line.split('\t')[0]));
}

function filterJob(title, filter) {
    const t = title.toLowerCase();
    const matchesPositive = filter.positive.some(p => t.includes(p.toLowerCase()));
    const matchesNegative = filter.negative.some(n => t.includes(n.toLowerCase()));
    return matchesPositive && !matchesNegative;
}

function matchRegion(notes, regionConfig) {
    if (!notes) return false;
    const n = notes.toLowerCase();
    if (regionConfig.countries.some(c => n.includes(c.toLowerCase()))) return true;
    if (regionConfig.keywords && regionConfig.keywords.split(' OR ').some(k => n.includes(k.replace(/"/g, '').toLowerCase().trim()))) return true;
    return false;
}

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = { region: null, country: null, listRegions: false };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--region') opts.region = args[++i]?.toLowerCase();
        else if (args[i] === '--country') opts.country = args[++i]?.toLowerCase();
        else if (args[i] === '--list-regions') opts.listRegions = true;
    }
    return opts;
}

const GREENHOUSE_API_BASE = 'https://boards-api.greenhouse.io/v1/boards';

async function scanGreenhouseApi(company, boardToken, filter) {
    const apiUrl = `${GREENHOUSE_API_BASE}/${boardToken}/jobs`;
    console.log(`   📡 ${company}...`);
    try {
        const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) {
            console.log(`      ⚠️  HTTP ${resp.status} — skipping`);
            return [];
        }
        const data = await resp.json();
        const jobs = data.jobs || [];
        return jobs
            .filter(j => filterJob(j.title, filter))
            .map(j => ({
                title: j.title,
                url: j.absolute_url,
                company: company,
                portal: `Greenhouse — ${company}`
            }));
    } catch (err) {
        if (err.name === 'TimeoutError') {
            console.log(`      ⏱️  Timeout — skipping`);
        } else {
            console.log(`      ❌ Error: ${err.message.substring(0, 60)}`);
        }
        return [];
    }
}

async function scanPlaywright(browser, company, careersUrl, filter) {
    console.log(`   🌐 ${company} (${careersUrl.split('/').slice(-1)})...`);
    const page = await browser.newPage();
    try {
        await page.goto(careersUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const jobs = await page.evaluate(() => {
            const results = [];
            document.querySelectorAll('a[href*="/jobs/"]').forEach(a => {
                const title = a.innerText.trim();
                if (title && title.length > 5 && title.length < 100 && !title.includes('Job Alert') && !title.includes('Create')) {
                    results.push({ title, url: a.href });
                }
            });
            document.querySelectorAll('.posting-title a').forEach(a => {
                const title = a.innerText.trim();
                if (title && !results.some(r => r.title === title)) {
                    results.push({ title, url: a.href });
                }
            });
            return results;
        });
        return jobs
            .filter(j => filterJob(j.title, filter))
            .map(j => ({ ...j, company, portal: `Playwright — ${company}` }));
    } catch (err) {
        console.log(`      ⚠️  Browser error: ${err.message.substring(0, 60)}`);
        return [];
    } finally {
        await page.close();
    }
}

async function main() {
    const opts = parseArgs();

    // Handle --list-regions
    if (opts.listRegions) {
        const regions = await loadRegions();
        console.log('🌍 Available Regions:\n');
        for (const [key, val] of Object.entries(regions)) {
            console.log(`  ${key.padEnd(16)} ${val.label}`);
            console.log(`  ${' '.repeat(16)} Countries: ${val.countries.slice(0, 8).join(', ')}${val.countries.length > 8 ? '...' : ''}`);
            console.log();
        }
        return;
    }

    console.log('🚀 Career-Ops Portal Scanner\n');
    const config = await loadConfig();
    const regions = await loadRegions();
    const seenUrls = await getSeenUrls();
    const foundJobs = [];
    const regionFilter = opts.region ? regions[opts.region] : null;

    if (opts.region && !regionFilter) {
        console.error(`❌ Unknown region: "${opts.region}". Use --list-regions to see available regions.`);
        process.exit(1);
    }

    // Filter companies by region if specified
    let companies = config.tracked_companies.filter(c => c.enabled !== false);
    if (regionFilter) {
        const before = companies.length;
        companies = companies.filter(c => matchRegion(c.notes, regionFilter));
        console.log(`🎯 Region: ${regionFilter.label} (${companies.length}/${before} companies match)\n`);
    }
    if (opts.country) {
        console.log(`🎯 Country filter: "${opts.country}" — results will be filtered to matching jobs\n`);
    }

    const browser = await chromium.launch({ headless: true });

    // Enumeration pass: count companies by scan method
    let apiCount = 0, playwrightCount = 0, websearchCount = 0;
    for (const company of companies) {
        if (company.api) { apiCount++; }
        else if (company.careers_url) { 
            if (company.scan_method === 'websearch') websearchCount++;
            else playwrightCount++;
        }
    }

    console.log(`📊 ${companies.length} companies: ${apiCount} API, ${playwrightCount} Playwright, ${websearchCount} WebSearch\n`);

    // Level 1: Greenhouse API scans
    if (apiCount > 0) {
        console.log('📡 Scanning Greenhouse APIs...');
        for (const company of companies) {
            if (!company.api) continue;
            const boardToken = company.api.replace(GREENHOUSE_API_BASE + '/', '').replace('/jobs', '');
            const jobs = await scanGreenhouseApi(company.name, boardToken, config.title_filter);
            foundJobs.push(...jobs);
        }
    }

    // Level 2: Playwright direct scans
    const pwCompanies = companies.filter(c => !c.api && c.careers_url && c.scan_method !== 'websearch');
    if (pwCompanies.length > 0) {
        console.log('\n🌐 Scanning career pages via browser...');
        for (const company of pwCompanies) {
            const jobs = await scanPlaywright(browser, company.name, company.careers_url, config.title_filter);
            foundJobs.push(...jobs);
        }
    }

    await browser.close();

    // Filter by country if specified
    let filteredJobs = foundJobs;
    if (opts.country) {
        const c = opts.country.toLowerCase();
        filteredJobs = foundJobs.filter(j => {
            const company = config.tracked_companies.find(co => co.name === j.company);
            return company && company.notes && company.notes.toLowerCase().includes(c);
        });
        // If company notes don't match, fall back to title-based country matching
        if (filteredJobs.length === 0) {
            filteredJobs = foundJobs.filter(j => j.title.toLowerCase().includes(c));
        }
    }

    // Deduplicate and filter seen URLs
    const newJobs = filteredJobs.filter(j => !seenUrls.has(j.url.split('?')[0]));
    const unique = new Map();
    newJobs.forEach(j => unique.set(j.url.split('?')[0], j));
    const uniqueNew = [...unique.values()];

    console.log(`\n📊 Scan Complete. Total found: ${foundJobs.length} | Filtered: ${filteredJobs.length} | New: ${uniqueNew.length}`);

    if (uniqueNew.length > 0) {
        // Add to scan history
        const today = new Date().toISOString().split('T')[0];
        const historyRows = uniqueNew.map(j =>
            `${j.url}\t${today}\t${j.portal}\t${j.title}\t${j.company}\tadded`
        ).join('\n');
        fs.appendFileSync(HISTORY_PATH, '\n' + historyRows);

        // Add to pipeline with region tag
        const tag = regionFilter ? ` [${opts.region.toUpperCase()}]` : (opts.country ? ` [${opts.country.toUpperCase()}]` : '');
        const pipelineRows = uniqueNew.map(j =>
            `- [ ] ${j.url} | ${j.company} | ${j.title}${tag}`
        ).join('\n');
        fs.appendFileSync(PIPELINE_PATH, '\n' + pipelineRows);

        console.log(`   ✅ Added ${uniqueNew.length} new jobs to pipeline.md`);
        console.log('\n📋 New opportunities:');
        uniqueNew.slice(0, 20).forEach(j =>
            console.log(`   • ${j.company} — ${j.title}`)
        );
        if (uniqueNew.length > 20) {
            console.log(`   ... and ${uniqueNew.length - 20} more`);
        }
    } else {
        console.log('   ℹ️  No new opportunities found');
    }
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
