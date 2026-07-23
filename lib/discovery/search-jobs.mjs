/**
 * lib/discovery/search-jobs.mjs — Multi-source Job Discovery Engine
 *
 * Searches across Google, LinkedIn, Indeed, Glassdoor, and job boards
 * for job postings matching the user's target roles and keywords.
 *
 * Each source returns normalized results: { title, company, url, location, source }
 */

import { chromium } from 'playwright';
import { load } from 'js-yaml';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const PROFILE_PATH = join(ROOT, 'config/profile.yml');

// ─── Google Custom Search ────────────────────────────────────────────
const SEARCH_ENGINES = {
  // Google job search (uses "Jobs" tab results)
  google: {
    base: 'https://www.google.com/search?q=',
    query: (query) => `site:linkedin.com/jobs OR site:indeed.com OR site:glassdoor.com "${query}"`,
  },
  // Direct job board searches
  linkedin: {
    base: 'https://www.linkedin.com/jobs/search/?keywords=',
    query: (query) => encodeURIComponent(query),
  },
  indeed: {
    base: 'https://www.indeed.com/q-',
    query: (query) => encodeURIComponent(query),
  },
  glassdoor: {
    base: 'https://www.glassdoor.com/Job/jobs.htm?sc.keyword=',
    query: (query) => encodeURIComponent(query),
  },
  ziprecruiter: {
    base: 'https://www.ziprecruiter.com/candidate/search?search=',
    query: (query) => encodeURIComponent(query),
  },
};

/**
 * Load user's target roles from profile.
 * @returns {string[]} List of search queries
 */
export function buildSearchQueries() {
  const queries = [];

  if (existsSync(PROFILE_PATH)) {
    try {
      const profile = load(readFileSync(PROFILE_PATH, 'utf-8'));
      const roles = profile.target_roles?.primary || [];

      // Each primary role becomes a search query
      for (const role of roles) {
        queries.push(role);
        // Add variations
        const short = role.replace(/^(Senior|Lead|Principal|Staff|Head of|Director of)\s+/i, '');
        if (short !== role) queries.push(short);
      }
    } catch {}
  }

  // Default queries if no profile
  if (queries.length === 0) {
    queries.push('software engineer', 'backend engineer', 'full stack developer');
  }

  return [...new Set(queries)];
}

/**
 * Search Google for job postings matching a query.
 * Uses Playwright to navigate Google and extract job links.
 * @param {string} query - Search query
 * @param {object} [options] - { browser?, maxResults?, location? }
 * @returns {Promise<Array<{title, company, url, location, source}>>}
 */
export async function searchGoogle(query, options = {}) {
  const browser = options.browser || await chromium.launch({ headless: true });
  const maxResults = options.maxResults || 50;

  try {
    const page = await browser.newPage();
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' job')}&ibp=htl;jobs`;
    const results = [];

    try {
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);

      // Extract job results from Google's job search UI
      const jobs = await page.evaluate(() => {
        const items = [];
        // Google's job search panel
        document.querySelectorAll('[class*="job-card"], [class*="job_"], [role="listitem"]').forEach(el => {
          const title = el.querySelector('[class*="title"], h3, [class*="jobTitle"]')?.innerText?.trim() || '';
          const company = el.querySelector('[class*="company"], [class*="employer"]')?.innerText?.trim() || '';
          const location = el.querySelector('[class*="location"]')?.innerText?.trim() || '';
          const link = el.querySelector('a')?.href || '';
          if (title) items.push({ title, company, location, url: link, source: 'google' });
        });
        return items;
      });

      results.push(...jobs);

      // Also search regular Google results for job board links
      if (results.length < maxResults) {
        const page2 = await browser.newPage();
        try {
          await page2.goto(`https://www.google.com/search?q=${encodeURIComponent(query + ' job application')}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          const links = await page2.evaluate(() => {
            return [...document.querySelectorAll('a[href*="linkedin.com/jobs"], a[href*="indeed.com"], a[href*="glassdoor.com"], a[href*="greenhouse.io"], a[href*="lever.co"], a[href*="ashbyhq.com"]')]
              .map(a => ({
                title: a.innerText?.trim() || a.title || a.getAttribute('aria-label') || '',
                url: a.href,
                company: '',
                location: '',
                source: 'google-web',
              })).filter(i => i.title);
          });
          results.push(...links);
        } finally {
          await page2.close();
        }
      }
    } catch {
      // Google may block — return what we have
    }

    await page.close();
    return results.slice(0, maxResults);

  } finally {
    if (!options.browser) await browser.close();
  }
}

/**
 * Search Indeed for jobs.
 * @param {string} query - Search query
 * @param {object} [options] - { browser?, maxResults?, location? }
 * @returns {Promise<Array<{title, company, url, location, source}>>}
 */
export async function searchIndeed(query, options = {}) {
  const browser = options.browser || await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const loc = options.location || '';
    const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}${loc ? '&l=' + encodeURIComponent(loc) : ''}`;

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);

      return page.evaluate(() => {
        return [...document.querySelectorAll('.jobsearch-SerpJobCard, [class*="job_seen"], li[class*="result"]')]
          .map(card => {
            const titleEl = card.querySelector('a[class*="jobtitle"], h2 a, [id*="job_"]');
            const companyEl = card.querySelector('[class*="company"], [class*="employer"]');
            const locationEl = card.querySelector('[class*="location"]');
            return {
              title: titleEl?.innerText?.trim() || '',
              company: companyEl?.innerText?.trim() || '',
              url: titleEl?.href || '',
              location: locationEl?.innerText?.trim() || '',
              source: 'indeed',
            };
          }).filter(j => j.title);
      });
    } catch { return []; }
    finally { await page.close(); }
  } finally {
    if (!options.browser) await browser.close();
  }
}

/**
 * Search LinkedIn for jobs.
 * @param {string} query - Search query
 * @param {object} [options] - { browser?, maxResults? }
 * @returns {Promise<Array<{title, company, url, location, source}>>}
 */
export async function searchLinkedIn(query, options = {}) {
  // LinkedIn blocks aggressively. Extract from Google search results instead.
  return [];
}

/**
 * Run all job search sources for a set of queries.
 * @param {string[]} queries - List of search queries
 * @param {object} [options] - { maxResults, location, browser }
 * @returns {Promise<Array<{title, company, url, location, source}>>}
 */
export async function searchAllSources(queries, options = {}) {
  const browser = await chromium.launch({ headless: true });
  const allResults = [];
  const seen = new Set();

  try {
    for (const query of queries) {
      const opts = { ...options, browser };

      // Google search
      const googleJobs = await searchGoogle(query, opts);
      for (const j of googleJobs) {
        const key = j.url.split('?')[0];
        if (!seen.has(key)) { seen.add(key); allResults.push(j); }
      }

      // Indeed search
      const indeedJobs = await searchIndeed(query, opts);
      for (const j of indeedJobs) {
        const key = j.url.split('?')[0];
        if (!seen.has(key)) { seen.add(key); allResults.push(j); }
      }
    }
  } finally {
    await browser.close();
  }

  // Dedup and limit
  return allResults.slice(0, options.maxResults || 200);
}

/**
 * Discover company career pages from a list of company names.
 * @param {string[]} companies - Company names
 * @param {object} [options] - { browser? }
 * @returns {Promise<Array<{name, careersUrl}>>}
 */
export async function discoverCompanyPages(companies, options = {}) {
  const browser = options.browser || await chromium.launch({ headless: true });
  const results = [];

  try {
    const page = await browser.newPage();

    for (const company of companies) {
      try {
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(company + ' careers job application')}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        const urls = await page.evaluate((name) => {
          return [...document.querySelectorAll('a[href*="career"], a[href*="jobs"], a[href*="greenhouse.io"], a[href*="lever.co"], a[href*="bamboohr"]')]
            .map(a => a.href)
            .filter(h => h.toLowerCase().includes(name.toLowerCase()) || h.includes('career') || h.includes('job'));
        }, company);

        if (urls.length > 0) {
          results.push({ name: company, careersUrl: urls[0], allUrls: urls });
        }
      } catch {}
    }

    await page.close();
  } finally {
    if (!options.browser) await browser.close();
  }

  return results;
}

export default { buildSearchQueries, searchGoogle, searchIndeed, searchLinkedIn, searchAllSources, discoverCompanyPages };
