#!/usr/bin/env node

import fs from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const REGIONS_PATH = join(ROOT, 'config/regions.yml');
const PORTALS_PATH = join(ROOT, 'portals.yml');
const PIPELINE_PATH = join(ROOT, 'data/pipeline.md');

async function loadRegions() {
    if (!fs.existsSync(REGIONS_PATH)) {
        console.error('❌ config/regions.yml not found.');
        process.exit(1);
    }
    return yaml.load(fs.readFileSync(REGIONS_PATH, 'utf-8')).regions || {};
}

function loadTitleFilter() {
    if (!fs.existsSync(PORTALS_PATH)) return null;
    const cfg = yaml.load(fs.readFileSync(PORTALS_PATH, 'utf-8'));
    return cfg.title_filter || null;
}

function filterJob(title, filter) {
    if (!filter) return true;
    const t = title.toLowerCase();
    const matchesPositive = filter.positive.some(p => t.includes(p.toLowerCase()));
    const matchesNegative = filter.negative.some(n => t.includes(n.toLowerCase()));
    return matchesPositive && !matchesNegative;
}

function extractJobsFromGoogle(page) {
    return page.evaluate(() => {
        const results = [];
        const selectors = [
            'a[href*="/jobs/"]',
            'a[href*="linkedin.com/jobs"]',
            'a[href*="careers"]',
            'a[href*="job"]',
            'a[href*="greenhouse.io"]',
            'a[href*="lever.co"]',
            'a[href*="ashbyhq.com"]',
            'a[href*="indeed.com"]',
            'a[href*="glassdoor.com"]',
            'a[href*="remoteok.com"]',
            'a[href*="weworkremotely.com"]',
        ];
        const found = new Set();
        document.querySelectorAll('a').forEach(a => {
            const href = a.href || '';
            const text = (a.innerText || a.textContent || '').trim();
            if (!href || text.length < 10 || text.length > 150) return;
            if (found.has(href)) return;
            const matched = selectors.some(s => {
                try { return a.matches(s); } catch { return false; }
            });
            if (matched || href.includes('/jobs/') || href.includes('/careers') || href.includes('/job/')) {
                found.add(href);
                results.push({ title: text, url: href });
            }
        });
        // Also grab h3 elements near links (Google result titles)
        document.querySelectorAll('h3').forEach(h3 => {
            const a = h3.closest('a');
            if (!a) return;
            const href = a.href || '';
            const text = h3.innerText.trim();
            if (!href || !text || found.has(href)) return;
            if (text.length < 10 || text.length > 150) return;
            found.add(href);
            results.push({ title: text, url: href });
        });
        return results;
    });
}

function extractCompany(url, title) {
    try {
        const u = new URL(url);
        const host = u.hostname.replace('www.', '');
        // Extract company from common job board URLs
        if (host.includes('greenhouse.io')) return host.split('.')[0].replace('-jobs', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        if (host.includes('lever.co')) return host.split('.')[0].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        if (host.includes('ashbyhq.com')) return host.split('.')[0].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        if (host.includes('linkedin.com')) return 'LinkedIn — ' + (title.split(' at ')[1] || 'Unknown');
        return host;
    } catch {
        return title.split('-')[0]?.trim() || 'Unknown';
    }
}

function showHelp() {
    console.log(`
Usage: node search-region.mjs <region-or-country> [--scan]

Search for jobs by region or country using browser-based search.

Arguments:
  <region-or-country>   Region name (e.g., middle-east, europe, asia, africa)
                        or country/city name (e.g., dubai, singapore, tokyo)

Options:
  --scan        Also run portal scanner with same region filter
  --list        List available regions and countries
  --help        Show this help

Examples:
  node search-region.mjs dubai
  node search-region.mjs middle-east
  node search-region.mjs singapore
  node search-region.mjs "Saudi Arabia"
  node search-region.mjs europe --scan
  node search-region.mjs --list
`);
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help')) { showHelp(); return; }

    if (args.includes('--list')) {
        const regions = await loadRegions();
        console.log('🌍 Available Regions:\n');
        for (const [key, val] of Object.entries(regions)) {
            console.log(`  \x1b[1m${key}\x1b[0m — ${val.label}`);
            console.log(`     Countries: ${val.countries.join(', ')}`);
            console.log(`     Job sites: ${val.job_sites.join(', ')}`);
            console.log();
        }
        console.log('💡 You can also search by ANY country or city name.');
        return;
    }

    const target = args[0].toLowerCase();
    const doScan = args.includes('--scan');
    const regions = await loadRegions();
    const titleFilter = loadTitleFilter();

    let regionConfig = regions[target];
    let searchTerms;

    if (regionConfig) {
        searchTerms = regionConfig.keywords;
        console.log(`\n🔍 Searching jobs in: \x1b[1m${regionConfig.label}\x1b[0m`);
    } else {
        const cn = target.charAt(0).toUpperCase() + target.slice(1);
        searchTerms = `"${cn}" OR "Remote ${cn}" OR "${cn}" jobs`;
        console.log(`\n🔍 Searching jobs in: \x1b[1m${cn}\x1b[0m`);
    }

    const queries = [
        `(${searchTerms}) ("Java" OR "Spring Boot" OR "Backend Engineer") remote`,
        `(${searchTerms}) ("Software Engineer" OR "Full Stack" OR "Solutions Architect") remote`,
        `(${searchTerms}) ("AI" OR "Platform Engineer" OR "Microservices") remote`
    ];

    const browser = await chromium.launch({ headless: true });
    const allResults = new Map();

    for (let i = 0; i < queries.length; i++) {
        console.log(`   🌐 Search ${i + 1}/${queries.length}...`);
        const page = await browser.newPage();
        try {
            const url = `https://www.google.com/search?q=${encodeURIComponent(queries[i])}&num=30`;
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(2000); // Let JS render results

            const jobs = await extractJobsFromGoogle(page);
            for (const j of jobs) {
                if (!allResults.has(j.url)) {
                    const company = extractCompany(j.url, j.title);
                    allResults.set(j.url, { ...j, company });
                }
            }
        } catch (err) {
            console.log(`      ⚠️  Error: ${err.message.substring(0, 60)}`);
        } finally {
            await page.close();
        }
    }

    await browser.close();

    // Filter and deduplicate
    const matched = [...allResults.values()]
        .filter(j => filterJob(j.title, titleFilter))
        .filter(j => !j.url.includes('google.com') && !j.url.includes('youtube.com'));

    if (matched.length === 0) {
        console.log('\n   ℹ️  No matching jobs found via web search.');
        if (!doScan) console.log('   💡 Try --scan to also check tracked companies in this region.');
        if (doScan) {
            console.log('   Running portal scanner with --region...');
            const scanProcess = (await import('child_process')).spawn(
                'node', ['scan-portals.mjs', '--region', target],
                { stdio: 'inherit', cwd: ROOT }
            );
            await new Promise(r => scanProcess.on('close', r));
        }
        return;
    }

    const tag = ` [${target.toUpperCase()}]`;
    const pipelineRows = matched.map(j =>
        `- [ ] ${j.url} | ${j.company} | ${j.title}${tag}`
    ).join('\n');
    fs.appendFileSync(PIPELINE_PATH, '\n' + pipelineRows);

    console.log(`\n   ✅ Added ${matched.length} jobs to pipeline.md`);
    console.log('\n📋 Jobs found:');
    matched.slice(0, 20).forEach((j, idx) =>
        console.log(`   ${idx + 1}. ${j.company} — ${j.title}`)
    );
    if (matched.length > 20) console.log(`   ... and ${matched.length - 20} more`);

    if (doScan) {
        console.log(`\n🚀 Running portal scanner with --region ${target}...`);
        const scanProcess = (await import('child_process')).spawn(
            'node', ['scan-portals.mjs', '--region', target],
            { stdio: 'inherit', cwd: ROOT }
        );
        await new Promise(r => scanProcess.on('close', r));
    }

    console.log('\n✅ Done.');
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
