#!/usr/bin/env node

import fs from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const PORTALS_PATH = join(ROOT, 'portals.yml');
const REGIONS_PATH = join(ROOT, 'config/regions.yml');
const HISTORY_PATH = join(ROOT, 'data/scan-history.tsv');
const PIPELINE_PATH = join(ROOT, 'data/pipeline.md');

// ─── In-memory seen-set ───────────────────────────────────────────────────────

let _seenUrls = null;
let _dirty = false;

/**
 * Load portals.yml configuration.
 * @returns {object} Parsed portals config
 */
export function loadPortalsConfig() {
    return yaml.load(fs.readFileSync(PORTALS_PATH, 'utf-8'));
}

/**
 * Load regions.yml configuration.
 * @returns {object} Regions map
 */
export function loadRegions() {
    if (!fs.existsSync(REGIONS_PATH)) return {};
    const parsed = yaml.load(fs.readFileSync(REGIONS_PATH, 'utf-8'));
    return (parsed && parsed.regions) || {};
}

/**
 * Read scan-history.tsv into an in-memory set of seen URLs.
 * @returns {Set<string>} Set of seen URLs (stripped of query params)
 */
export function getSeenUrls() {
    if (_seenUrls) return _seenUrls;
    _seenUrls = new Set();
    if (!fs.existsSync(HISTORY_PATH)) return _seenUrls;
    const content = fs.readFileSync(HISTORY_PATH, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const url = trimmed.split('\t')[0];
        if (url) _seenUrls.add(url.split('?')[0]);
    }
    return _seenUrls;
}

/**
 * Mark a URL as seen (in-memory, not flushed to disk).
 * @param {string} url
 */
export function markSeen(url) {
    if (!_seenUrls) getSeenUrls();
    _seenUrls.add(url.split('?')[0]);
    _dirty = true;
}

/**
 * Flush newly scanned URLs to scan-history.tsv.
 * @param {Array<{url, company, title, portal: string}>} jobs
 */
export function saveSeen(jobs) {
    if (!jobs || jobs.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    const historyRows = jobs.map(j =>
        `${j.url}\t${today}\t${j.portal}\t${j.title}\t${j.company}\tadded`
    ).join('\n');
    const separator = fs.existsSync(HISTORY_PATH) ? '\n' : '';
    fs.appendFileSync(HISTORY_PATH, separator + historyRows);
    _dirty = false;
}

/**
 * Check if a company's notes match the given region config.
 * @param {string} notes - Company notes field
 * @param {object} regionConfig - Region config from regions.yml
 * @returns {boolean}
 */
export function matchRegion(notes, regionConfig) {
    if (!notes || !regionConfig) return false;
    const n = notes.toLowerCase();
    if (regionConfig.countries && regionConfig.countries.some(c => n.includes(c.toLowerCase()))) return true;
    if (regionConfig.keywords) {
        const keywords = typeof regionConfig.keywords === 'string'
            ? regionConfig.keywords
            : (regionConfig.keywords || '');
        const parts = keywords.split(' OR ');
        for (const k of parts) {
            const clean = k.replace(/"/g, '').toLowerCase().trim();
            if (clean && n.includes(clean)) return true;
        }
    }
    return false;
}

/**
 * Apply title filter (positive/negative matching).
 * @param {string} title - Job title
 * @param {object} filter - {positive: string[], negative: string[]}
 * @returns {boolean}
 */
export function applyTitleFilter(title, filter) {
    if (!filter) return true;
    if (!title) return false;
    const t = title.toLowerCase();
    const hasPositive = filter.positive && filter.positive.length > 0;
    const hasNegative = filter.negative && filter.negative.length > 0;
    if (hasPositive && !filter.positive.some(p => t.includes(p.toLowerCase()))) return false;
    if (hasNegative && filter.negative.some(n => t.includes(n.toLowerCase()))) return false;
    return true;
}

/**
 * Append new job entries to pipeline.md in checklist format.
 * @param {Array<{url, company, title, location?}>} jobs
 * @param {string} [tag] - Optional region tag like [EUROPE]
 */
export function appendToPipeline(jobs, tag) {
    if (!jobs || jobs.length === 0) return;
    const tagSuffix = tag ? ` ${tag}` : '';
    const rows = jobs.map(j =>
        `- [ ] ${j.url} | ${j.company} | ${j.title}${tagSuffix}`
    ).join('\n');
    const separator = fs.existsSync(PIPELINE_PATH) ? '\n' : '';
    fs.appendFileSync(PIPELINE_PATH, separator + rows);
}

/**
 * Detect which platform driver to use for a given company.
 *
 * @param {object} company - Company config from portals.yml
 * @returns {string} Platform name: 'greenhouse' | 'lever' | 'ashby' | 'indeed' | 'workday' | 'playwright'
 */
export function detectPlatform(company) {
    const url = (company.careers_url || company.api || '').toLowerCase();
    if (url.includes('greenhouse.io')) return 'greenhouse';
    if (url.includes('lever.co')) return 'lever';
    if (url.includes('ashbyhq.com')) return 'ashby';
    if (url.includes('myworkdayjobs') || url.includes('wd5.myworkday')) return 'workday';
    if (url.includes('indeed.com')) return 'indeed';
    return 'playwright';
}

/**
 * Scan a single company using the appropriate platform driver.
 * Falls back to Playwright if no specific driver matches.
 *
 * @param {object} company - Company config
 * @param {object} drivers - Map of platform name → driver module {scan}
 * @param {object} filter - Title filter
 * @param {object} [options] - Shared options (browser instance, etc.)
 * @returns {Promise<Array<{title, url, company, portal}>>}
 */
export async function scanCompany(company, drivers, filter, options = {}) {
    const platform = detectPlatform(company);
    const driver = drivers[platform];

    if (driver) {
        const jobs = await driver.scan(company, filter, options);
        return jobs.map(j => ({
            ...j,
            company: company.name,
            portal: `${driver.platform || platform} — ${company.name}`,
        }));
    }

    if (platform === 'playwright' && company.careers_url && options.browser) {
        return scanPlaywrightFallback(options.browser, company, filter);
    }

    console.log(`   ⚠️  ${company.name}: no driver for platform "${platform}"`);
    return [];
}

/**
 * Fallback Playwright scanner for companies without a specific platform driver.
 */
async function scanPlaywrightFallback(browser, company, filter) {
    console.log(`   🌐 ${company.name} (${company.careers_url.split('/').slice(-1)})...`);
    const page = await browser.newPage();
    try {
        await page.goto(company.careers_url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const jobs = await page.evaluate(() => {
            const results = [];
            document.querySelectorAll('a[href*="/jobs/"]').forEach(a => {
                const title = a.innerText.trim();
                if (title && title.length > 5 && title.length < 100 &&
                    !title.includes('Job Alert') && !title.includes('Create')) {
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
            .filter(j => applyTitleFilter(j.title, filter))
            .map(j => ({
                title: j.title,
                url: j.url,
                location: '',
                department: '',
                publishedAt: '',
                company: company.name,
                portal: `Playwright — ${company.name}`,
            }));
    } catch (err) {
        console.log(`      ⚠️  Browser error: ${err.message.substring(0, 60)}`);
        return [];
    } finally {
        await page.close();
    }
}

/**
 * Parse CLI args for the scanner.
 * @returns {{ region: string|null, country: string|null, listRegions: boolean, platform: string|null }}
 */
export function parseScanArgs() {
    const args = process.argv.slice(2);
    const opts = { region: null, country: null, listRegions: false, platform: null };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--region') opts.region = args[++i]?.toLowerCase();
        else if (args[i] === '--country') opts.country = args[++i]?.toLowerCase();
        else if (args[i] === '--list-regions') opts.listRegions = true;
        else if (args[i] === '--platform') opts.platform = args[++i]?.toLowerCase();
    }
    return opts;
}

/**
 * List available regions to stdout.
 */
export async function listRegions() {
    const regions = loadRegions();
    console.log('\n🌍 Available Regions:\n');
    for (const [key, val] of Object.entries(regions)) {
        console.log(`  ${key.padEnd(16)} ${val.label}`);
        console.log(`  ${' '.repeat(16)} Countries: ${(val.countries || []).slice(0, 8).join(', ')}${val.countries && val.countries.length > 8 ? '...' : ''}`);
        console.log();
    }
}

export default {
    loadPortalsConfig,
    loadRegions,
    getSeenUrls,
    markSeen,
    saveSeen,
    matchRegion,
    applyTitleFilter,
    appendToPipeline,
    detectPlatform,
    scanCompany,
    parseScanArgs,
    listRegions,
};
