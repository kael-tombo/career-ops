#!/usr/bin/env node

import fs from 'fs';
import { join } from 'path';
import { chromium } from 'playwright';

import {
    loadPortalsConfig,
    loadRegions,
    getSeenUrls,
    saveSeen,
    matchRegion,
    appendToPipeline,
    detectPlatform,
    scanCompany,
    parseScanArgs,
    listRegions,
} from './lib/scan/scanner-core.mjs';

import * as greenhouseDriver from './lib/scan/platforms/greenhouse.mjs';
import * as leverDriver from './lib/scan/platforms/lever.mjs';
import * as ashbyDriver from './lib/scan/platforms/ashby.mjs';
import * as indeedDriver from './lib/scan/platforms/indeed.mjs';
import * as workdayDriver from './lib/scan/platforms/workday.mjs';

const ROOT = process.cwd();
const HISTORY_PATH = join(ROOT, 'data/scan-history.tsv');

// ─── Platform driver registry ─────────────────────────────────────────────────

const PLATFORM_DRIVERS = {
    greenhouse: greenhouseDriver,
    lever: leverDriver,
    ashby: ashbyDriver,
    indeed: indeedDriver,
    workday: workdayDriver,
};

async function main() {
    const opts = parseScanArgs();

    // ── List regions mode ──
    if (opts.listRegions) {
        await listRegions();
        return;
    }

    console.log('🚀 Career-Ops Universal Scanner\n');

    const config = loadPortalsConfig();
    const regions = loadRegions();
    const seenUrls = getSeenUrls();
    const foundJobs = [];
    const regionFilter = opts.region ? regions[opts.region] : null;

    if (opts.region && !regionFilter) {
        console.error(`❌ Unknown region: "${opts.region}". Use --list-regions to see available regions.`);
        process.exit(1);
    }

    // ── Filter companies ──
    let companies = (config.tracked_companies || []).filter(c => c.enabled !== false);

    if (regionFilter) {
        const before = companies.length;
        companies = companies.filter(c => matchRegion(c.notes, regionFilter));
        console.log(`🎯 Region: ${regionFilter.label} (${companies.length}/${before} companies match)\n`);
    }

    if (opts.country) {
        console.log(`🎯 Country filter: "${opts.country}" — results will be filtered to matching jobs\n`);
    }

    if (opts.platform) {
        const before = companies.length;
        companies = companies.filter(c => detectPlatform(c) === opts.platform);
        console.log(`🎯 Platform filter: "${opts.platform}" (${companies.length}/${before} companies match)\n`);
    }

    // ── Count by platform ──
    const counts = {};
    for (const c of companies) {
        const p = detectPlatform(c);
        counts[p] = (counts[p] || 0) + 1;
    }
    const summary = Object.entries(counts)
        .map(([p, n]) => `${n} ${p}`)
        .join(', ');
    console.log(`📊 ${companies.length} companies: ${summary}\n`);

    // ── Launch browser once for Playwright-based drivers ──
    const needBrowser = companies.some(c => {
        const p = detectPlatform(c);
        return p === 'indeed' || p === 'workday' || p === 'playwright';
    });

    let browser = null;
    if (needBrowser) {
        browser = await chromium.launch({ headless: true });
    }

    const sharedOptions = { browser };

    // ── Scan each company ──
    for (const company of companies) {
        const jobs = await scanCompany(company, PLATFORM_DRIVERS, config.title_filter, sharedOptions);
        foundJobs.push(...jobs);
    }

    if (browser) await browser.close();

    // ── Filter by country if specified ──
    let filteredJobs = foundJobs;
    if (opts.country) {
        const c = opts.country.toLowerCase();
        filteredJobs = foundJobs.filter(j => {
            const company = (config.tracked_companies || []).find(co => co.name === j.company);
            return company && company.notes && company.notes.toLowerCase().includes(c);
        });
        if (filteredJobs.length === 0) {
            filteredJobs = foundJobs.filter(j => j.title.toLowerCase().includes(c));
        }
    }

    // ── Deduplicate against seen URLs ──
    const newJobs = filteredJobs.filter(j => !seenUrls.has(j.url.split('?')[0]));
    const unique = new Map();
    newJobs.forEach(j => unique.set(j.url.split('?')[0], j));
    const uniqueNew = [...unique.values()];

    console.log(`\n📊 Scan Complete. Total found: ${foundJobs.length} | Filtered: ${filteredJobs.length} | New: ${uniqueNew.length}`);

    // ── Persist results ──
    if (uniqueNew.length > 0) {
        saveSeen(uniqueNew);

        const tag = regionFilter
            ? ` [${opts.region.toUpperCase()}]`
            : (opts.country ? ` [${opts.country.toUpperCase()}]` : '');
        appendToPipeline(uniqueNew, tag);

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
