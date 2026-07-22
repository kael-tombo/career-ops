import { chromium } from 'playwright';

/**
 * Scan a Workday career site via Playwright.
 * Workday career pages are JavaScript-heavy SPAs. This driver waits for
 * job listings to render and tries multiple selector strategies.
 *
 * @param {object} company - Company config from portals.yml
 * @param {object} filter - Title filter {positive: string[], negative: string[]}
 * @param {object} [options] - Scan options
 * @param {object} [options.browser] - Reusable Playwright browser instance
 * @returns {Promise<Array<{title, url, location, department, publishedAt}>>}
 */
export async function scan(company, filter, options = {}) {
    const url = company.careers_url;
    if (!url) {
        console.log(`   ⚠️  ${company.name}: no careers_url configured`);
        return [];
    }

    console.log(`   🏢 Workday — ${company.name}...`);

    let browser = options.browser;
    let ownBrowser = false;
    if (!browser) {
        browser = await chromium.launch({ headless: true });
        ownBrowser = true;
    }

    const results = [];
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(5000);

        const jobs = await page.evaluate(() => {
            const items = [];

            const selectors = [
                'ul[data-automation-id="jobResultsList"] li',
                'div[data-automation-id="jobResults"] div[data-automation-id*="job"]',
                'ul.job-list li',
                'table.job-results-table tr',
                'li.job-result-list-item',
                'a[data-automation-id*="jobTitle"]',
                'div[class*="job-listing"]',
                'a[class*="job-title"]',
                'li[class*="job"] a[href*="job"]',
            ];

            for (const sel of selectors) {
                const elements = document.querySelectorAll(sel);
                if (elements.length > 0) {
                    elements.forEach(el => {
                        const titleEl = el.querySelector('a[data-automation-id*="jobTitle"], a[class*="title"], a[class*="job"]');
                        const directLink = el.tagName === 'A' ? el : null;
                        const anchor = titleEl || directLink;

                        if (!anchor) return;
                        const title = anchor.innerText.trim() || anchor.getAttribute('aria-label') || '';
                        if (!title || title.length < 3) return;

                        const href = anchor.getAttribute('href') || '';
                        const jobUrl = href.startsWith('http') ? href : `${window.location.origin}${href}`;

                        const locationEl = el.querySelector('[data-automation-id*="location"], [class*="location"]');
                        const location = locationEl ? locationEl.innerText.trim() : '';

                        if (!items.some(i => i.title === title && i.location === location)) {
                            items.push({ title, url: jobUrl, location });
                        }
                    });
                    break;
                }
            }

            return items;
        });

        results.push(...jobs);
    } catch (err) {
        console.log(`      ⚠️  Workday error: ${err.message.substring(0, 80)}`);
    } finally {
        await page.close();
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

export const platform = 'workday';
