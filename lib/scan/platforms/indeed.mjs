import { chromium } from 'playwright';

/**
 * Scan Indeed.com via Playwright.
 * Indeed does NOT have a public API, so this uses browser-based scanning.
 * Note: Indeed aggressively blocks automated access — stealth mode is used
 * but results may be limited.
 *
 * @param {object} company - Company config from portals.yml
 * @param {object} filter - Title filter {positive: string[], negative: string[]}
 * @param {object} [options] - Scan options
 * @param {object} [options.browser] - Reusable Playwright browser instance
 * @returns {Promise<Array<{title, url, location, department, publishedAt}>>}
 */
export async function scan(company, filter, options = {}) {
    const query = buildQuery(company);
    console.log(`   🌐 Indeed — ${query.query} (${query.location})...`);

    let browser = options.browser;
    let ownBrowser = false;
    if (!browser) {
        browser = await chromium.launch({ headless: true });
        ownBrowser = true;
    }

    const results = [];
    try {
        for (let pageNum = 0; pageNum < 3; pageNum++) {
            const start = pageNum * 10;
            const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(query.query)}&l=${encodeURIComponent(query.location)}&start=${start}`;

            const page = await browser.newPage();
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await page.waitForTimeout(3000);

                const jobs = await page.evaluate(() => {
                    const items = [];
                    const cards = document.querySelectorAll('.job_seen_beacon, .jobsearch-SerpJobCard, .cardOutline, .tapItem, div[data-testid="job-card"]');

                    cards.forEach(card => {
                        const titleEl = card.querySelector('.jobTitle, .jobTitle-color-purple, a[data-jk], h2.jobTitle > a, a.jobTitle');
                        if (!titleEl) return;

                        const title = titleEl.innerText.trim() || titleEl.getAttribute('title') || '';
                        if (!title) return;

                        const href = titleEl.getAttribute('href') || '';
                        const url = href.startsWith('http') ? href : `https://www.indeed.com${href}`;

                        const companyEl = card.querySelector('.companyName, .company, span[data-testid="company-name"]');
                        const companyName = companyEl ? companyEl.innerText.trim() : '';

                        const locationEl = card.querySelector('.companyLocation, .location, div[data-testid="text-location"]');
                        const location = locationEl ? locationEl.innerText.trim() : '';

                        items.push({ title, url, company: companyName, location });
                    });
                    return items;
                });

                results.push(...jobs);

                const hasNext = await page.evaluate(() => {
                    const nav = document.querySelector('nav[aria-label="pagination"]');
                    if (!nav) return false;
                    const current = nav.querySelector('b');
                    if (!current) return false;
                    const next = current.parentElement.nextElementSibling;
                    return !!next;
                });

                if (!hasNext) break;
            } finally {
                await page.close();
            }
        }
    } catch (err) {
        console.log(`      ⚠️  Indeed error: ${err.message.substring(0, 80)}`);
        return [];
    } finally {
        if (ownBrowser) await browser.close();
    }

    return results
        .filter(j => applyTitleFilter(j.title, filter))
        .map(j => ({
            title: j.title,
            url: j.url,
            location: j.location || '',
            department: '',
            publishedAt: '',
        }));
}

/**
 * Build Indeed search query from company config.
 */
function buildQuery(company) {
    if (company.scan_query) {
        return { query: company.scan_query, location: '' };
    }
    const roles = ['Java', 'Backend', 'Software Engineer'];
    return { query: roles.join(' '), location: '' };
}

/**
 * Check whether a job title matches the configured title filter.
 */
function applyTitleFilter(title, filter) {
    if (!filter) return true;
    if (!title) return false;
    const t = title.toLowerCase();
    const hasPositive = filter.positive && filter.positive.length > 0;
    const hasNegative = filter.negative && filter.negative.length > 0;
    if (hasPositive && !filter.positive.some(p => t.includes(p.toLowerCase()))) return false;
    if (hasNegative && filter.negative.some(n => t.includes(n.toLowerCase()))) return false;
    return true;
}

export const platform = 'indeed';
