/**
 * lib/scraper/scrape-jobs.mjs — Universal Job Scraper
 *
 * Scrapes job listings from ANY career page or job board using
 * Playwright browser automation. Handles 30+ ATS platforms with
 * platform-specific optimizations and a generic fallback.
 *
 * Usage:
 *   import { scrapeJobs } from './lib/scraper/scrape-jobs.mjs';
 *   const jobs = await scrapeJobs('https://company.careers-page.com');
 */

import { chromium } from 'playwright';
import { detectFromUrl, detectFromContent, getStrategy } from './ats-detector.mjs';

const DEFAULT_TIMEOUT = 20000;

// ─── Platform-specific selectors ────────────────────────────────────
const SELECTORS = {
  workday: {
    jobCards:      '[data-automation-id="jobResults"], [class*="job-listing"], tr[class*="job"], div[class*="requisition"]',
    title:         '[data-automation-id="jobTitle"], a[class*="jobTitle"], [class*="position-title"]',
    link:          'a[href*="/job/"], a[data-automation-id*="jobTitle"]',
    location:      '[data-automation-id="jobLocation"], [class*="location"]',
    department:    '[data-automation-id="jobDepartment"], [class*="department"]',
    nextPage:      '[data-automation-id="paginationNext"], a[aria-label="Next"]',
    description:   '[data-automation-id="jobPostingDescription"], [class*="description"]',
  },
  smartrecruiters: {
    jobCards:      '[class*="job-list"] a, [class*="opening"]',
    title:         '[class*="job-title"], [class*="position"] h2, [class*="opening"] h3',
    link:          'a[href*="/careers/"], a[href*="/jobs/"]',
    location:      '[class*="location"], [class*="city"]',
    department:    '[class*="department"], [class*="team"]',
    nextPage:      '[aria-label="Next"], [class*="pagination"] a:last-child',
    description:   '[class*="description"], [class*="content"]',
  },
  linkedin: {
    jobCards:      '[class*="job-card"], [data-urn*="job"], article[class*="job"]',
    title:         'a[class*="job-title"], [class*="job-card"] h3, h3[class*="title"]',
    link:          'a[href*="/jobs/view"], a[class*="job-card"]',
    location:      '[class*="job-location"], [class*="location"], li[class*="location"]',
    department:    '',
    nextPage:      'button[aria-label*="Next"], [class*="pagination"] button:last-child',
    description:   '[class*="description"], [class*="show-more-less"]',
  },
  indeed: {
    jobCards:      '[class*="job_seen"], .jobsearch-SerpJobCard, li[class*="result"]',
    title:         'a[class*="jobtitle"], h2[class*="title"] a, a[id*="job_"]',
    link:          'a[class*="jobtitle"], a[id*="job_"]',
    location:      '[class*="location"], div[class*="location"]',
    department:    '',
    nextPage:      'a[aria-label*="Next"], [class*="pagination"] a:last-child',
    description:   '#jobDescriptionText, [class*="description"]',
  },
  google: {
    jobCards:      '[class*="job-card"], [class*="result"], div[role="listitem"]',
    title:         'h3[class*="title"], [class*="job-title"]',
    link:          'a[href*="/careers/"], a[href*="jobs"]',
    location:      '[class*="location"], span[class*="location"]',
    department:    '[class*="team"], [class*="category"]',
    nextPage:      '[aria-label*="Next"], button[aria-label="Next"]',
    description:   '[class*="description"], [class*="qualifications"]',
  },
  generic: {
    jobCards:      'a[href*="/job"], a[href*="/jobs"], a[href*="/career"], a[href*="/position"], tr[class*="job"], div[class*="job"], li[class*="job"], [class*="posting"], [class*="listing"], [role="listitem"]',
    title:         'h2, h3, h4, [class*="title"], [class*="position"], [class*="job-title"], [class*="role"]',
    link:          'a[href*="/job"], a[href*="/jobs"], a[href*="/career"], a[href*="/position"]',
    location:      '[class*="location"], [class*="city"], [class*="place"], span[class*="loc"]',
    department:    '[class*="department"], [class*="team"], [class*="category"]',
    nextPage:      'a[aria-label*="Next"], [class*="pagination"] a:last-child, button:contains("Next"), a:contains("Next")',
    description:   '[class*="description"], [class*="content"], main, article',
  },
};

// ─── API-based scraping drivers ──────────────────────────────────────
async function scrapeGreenhouse(company, _filter) {
  const name = company.careers_url?.match(/greenhouse\.io\/([^/]+)/i)?.[1] || company.name?.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const url = `https://boards.greenhouse.io/${name}/embed/v2`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.jobs || []).map(j => ({
    title: j.title,
    url: `https://boards.greenhouse.io/${name}/jobs/${j.id}`,
    location: j.location?.name || '',
    department: j.departments?.map(d => d.name).join(', ') || '',
    publishedAt: j.updated_at || '',
    id: String(j.id),
  }));
}

async function scrapeLever(company, _filter) {
  const name = company.careers_url?.match(/lever\.co\/([^/]+)/i)?.[1] || company.name?.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const url = `https://api.lever.co/v0/postings/${name}?mode=json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) return [];
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map(j => ({
    title: j.text,
    url: j.hostedUrl || `https://jobs.lever.co/${name}/${j.id}`,
    location: j.categories?.location || '',
    department: j.categories?.team || '',
    publishedAt: j.createdAt || '',
    id: j.id,
  }));
}

async function scrapeAshby(company, _filter) {
  const token = company.ashby_board_token || company.careers_url?.match(/ashbyhq\.com\/([^/]+)/i)?.[1];
  if (!token) return [];
  const url = `https://api.ashbyhq.com/posting-api/job-board/${token}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.jobs || []).map(j => ({
    title: j.title,
    url: j.jobUrl || `https://jobs.ashbyhq.com/${token}/${j.id}`,
    location: j.location || '',
    department: j.department || '',
    publishedAt: j.publishedDate || '',
    id: j.id,
  }));
}

const API_SCRAPERS = {
  greenhouse: scrapeGreenhouse,
  lever: scrapeLever,
  ashby: scrapeAshby,
};

/**
 * Scrape a company's career page for all job listings.
 * @param {string|object} companyOrUrl - Company config object or career page URL
 * @param {object} [filter] - Title filter { positive: string[], negative: string[] }
 * @param {object} [options] - { browser?, timeout?, maxJobs? }
 * @returns {Promise<Array<{title, url, location, department, publishedAt, id}>>}
 */
export async function scrapeJobs(companyOrUrl, filter = {}, options = {}) {
  const company = typeof companyOrUrl === 'string' ? { careers_url: companyOrUrl, name: extractDomain(companyOrUrl) } : companyOrUrl;
  const url = company.careers_url || company.api || '';
  if (!url) return [];

  const timeout = options.timeout || DEFAULT_TIMEOUT;

  // Try API-based scraping first (fast, structured)
  const urlMatch = detectFromUrl(url);
  if (urlMatch && API_SCRAPERS[urlMatch.apiType]) {
    try {
      const jobs = await API_SCRAPERS[urlMatch.apiType](company, filter);
      if (jobs.length > 0) return applyFilter(jobs, filter);
    } catch {
      // Fall through to browser-based
    }
  }

  // Browser-based scraping with Playwright
  let browser;
  if (options.browser) {
    browser = options.browser;
  } else {
    browser = await chromium.launch({ headless: true });
  }

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });

    // Detect ATS from page content
    let atsInfo = urlMatch ? { ...urlMatch, confidence: 1.0 } : null;
    let html = '';
    let jobs = [];

    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout });

      // Get page content for ATS detection
      html = await page.content();
      if (!atsInfo || atsInfo.confidence < 0.8) {
        atsInfo = detectFromContent(html, url);
      }

      const strategy = getStrategy(atsInfo.name);
      const selectors = SELECTORS[strategy.parser] || SELECTORS.generic;

      // Try platform-specific extraction first
      jobs = await extractJobs(page, selectors, atsInfo);

      // If no jobs found, try generic extraction
      if (jobs.length === 0) {
        jobs = await genericExtract(page, url);
      }

    } catch (err) {
      // If navigation failed, try the HTML directly
      if (html) {
        jobs = await genericExtractFromHtml(html, url);
      }
    }

    await page.close();
    return applyFilter(jobs, filter);

  } finally {
    if (!options.browser && browser) await browser.close();
  }
}

/**
 * Extract job listings using platform-specific selectors.
 */
async function extractJobs(page, selectors, _atsInfo) {
  return page.evaluate((sel) => {
    const results = [];
    const cards = document.querySelectorAll(sel.jobCards);

    if (cards.length > 0) {
      cards.forEach(card => {
        const titleEl = card.querySelector(sel.title) || card.querySelector('h2, h3, h4, [class*="title"]');
        const linkEl = card.querySelector(sel.link) || (card.tagName === 'A' ? card : card.querySelector('a'));
        const locationEl = card.querySelector(sel.location);
        const deptEl = card.querySelector(sel.department);

        const title = titleEl?.innerText?.trim() || '';
        const url = linkEl?.href || '';
        const location = locationEl?.innerText?.trim() || '';
        const department = deptEl?.innerText?.trim() || '';

        if (title && title.length > 3 && title.length < 200) {
          results.push({ title, url, location, department, publishedAt: '' });
        }
      });
    }

    // Fallback: find all job links on the page
    if (results.length === 0) {
      document.querySelectorAll('a[href*="/job"], a[href*="/jobs/"], a[href*="/career"], a[href*="/position"], a[href*="opening"], a[class*="job"]').forEach(a => {
        const title = a.innerText?.trim() || a.title?.trim() || a.getAttribute('aria-label')?.trim() || '';
        const url = a.href;
        if (title && title.length > 3 && title.length < 150 && !results.some(r => r.url === url)) {
          results.push({ title, url, location: '', department: '', publishedAt: '' });
        }
      });
    }

    return results;
  }, selectors);
}

/**
 * Generic extraction from page using common job listing patterns.
 */
async function genericExtract(page, baseUrl) {
  return page.evaluate((url) => {
    const results = [];

    // Strategy 1: Find all links with job-related keywords
    const jobKeywords = ['job', 'career', 'position', 'opening', 'vacancy', 'opportunity', 'role'];
    document.querySelectorAll('a').forEach(a => {
      const href = a.href || '';
      const text = a.innerText?.trim() || a.title?.trim() || '';
      const isJobLink = jobKeywords.some(k => href.toLowerCase().includes(k) || text.toLowerCase().includes(k));
      if (isJobLink && text.length > 5 && text.length < 150 && !href.includes('#') && !results.some(r => r.url === href)) {
        results.push({ title: text, url: href, location: '', department: '', publishedAt: '' });
      }
    });

    // Strategy 2: Look for structured data (JSON-LD)
    try {
      document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
        const data = JSON.parse(script.textContent || '{}');
        const items = data['@graph'] || [data];
        items.filter(i => i['@type'] === 'JobPosting').forEach(j => {
          if (!results.some(r => r.url === j.url)) {
            results.push({
              title: j.title || j.name || '',
              url: j.url || j.directApply || url,
              location: j.jobLocation?.address?.addressLocality || j.jobLocation?.name || '',
              department: j.employmentType || '',
              publishedAt: j.datePosted || '',
            });
          }
        });
      });
    } catch {}

    // Strategy 3: Extract from list-like structures
    document.querySelectorAll('ul li, ol li, tr, [class*="list"] > div, [class*="grid"] > div').forEach(el => {
      const text = el.innerText?.trim();
      const link = el.querySelector('a');
      if (text && text.length > 5 && text.length < 150 && link?.href) {
        const isJobText = jobKeywords.some(k => text.toLowerCase().includes(k));
        if (isJobText && !results.some(r => r.url === link.href)) {
          results.push({ title: text, url: link.href, location: '', department: '', publishedAt: '' });
        }
      }
    });

    return results;
  }, baseUrl);
}

/**
 * Extract jobs from raw HTML (when page navigation fails).
 */
function genericExtractFromHtml(html, baseUrl) {
  const results = [];
  const jobRegex = /<a[^>]*href=["']([^"']*\/job[^"']*)["'][^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = jobRegex.exec(html)) !== null) {
    const url = match[1].startsWith('http') ? match[1] : new URL(match[1], baseUrl).href;
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    if (title && title.length > 5 && title.length < 150 && !results.some(r => r.url === url)) {
      results.push({ title, url, location: '', department: '', publishedAt: '' });
    }
  }
  return results;
}

function applyFilter(jobs, filter) {
  if (!filter || (!filter.positive && !filter.negative)) return jobs;
  const t = (s) => (s || '').toLowerCase();
  return jobs.filter(j => {
    const title = t(j.title);
    if (filter.positive?.length && !filter.positive.some(p => title.includes(t(p)))) return false;
    if (filter.negative?.length && filter.negative.some(n => title.includes(t(n)))) return false;
    return true;
  });
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace('www.', '').split('.')[0]; } catch { return 'unknown'; }
}

export default { scrapeJobs };
