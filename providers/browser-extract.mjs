// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Browser-extract provider — a fallback for custom career pages (JetBrains,
// Workday-branded portals, etc.) that no ATS-specific API provider can handle.
//
// Strategy (two-phase):
//   1. Try a plain HTTP GET first — some JS-heavy sites still server-render
//      their job listings as static HTML.
//   2. If phase 1 yields nothing, use Playwright (headless Chromium) to
//      render the page, wait for dynamic content, and scrape the DOM.
//
// The provider is OPT-IN only — it matches entries with
//   `browserExtract: true` or `scan_method: 'browser-extract'`.
// Normal ATS-detected entries (Greenhouse, Lever, Ashby, Workday, etc.)
// are never routed here.

const FETCH_TIMEOUT_MS = 15_000;
const PLAYWRIGHT_TIMEOUT_MS = 20_000;
const PLAYWRIGHT_NAV_TIMEOUT_MS = 15_000;

// Anchor selectors tried in order — covering the most common JS career-site
// patterns. The first non-empty result wins.
const JOB_LINK_SELECTORS = [
  // Generic job-board link patterns
  'a[href*="/jobs/"]',
  'a[href*="/careers/"]',
  'a[href*="/position/"]',
  'a[href*="/opportunities/"]',
  // Common class-based patterns
  '.posting-title a',
  '.job-title a',
  '.job-link',
  '.opening a',
  // ATS-specific class patterns (Workday, Lever, etc.)
  '[data-automation-id*="jobTitle"] a',
  '.css-19uc56f a',
];

// Stopwords for filtering nav/footer links masquerading as job titles.
const TITLE_STOPWORDS = new Set([
  'careers', 'jobs', 'open positions', 'view all', 'search jobs',
  'job alert', 'create alert', 'browse open', 'apply now', 'learn more',
  'read more', 'sign up', 'register', 'log in', 'sign in',
  'job search', 'find jobs', 'all jobs', 'all open', 'current openings',
  'faq', 'contact', 'privacy', 'terms', 'cookie', 'your application',
  'create profile', 'upload resume', 'join our talent', 'join talent',
  'job category', 'department', 'location', 'all departments',
  'all locations', 'filter', 'sort by', 'page',
]);

// Common job-board domains where the HTML is regular enough for automated
// extraction — listed for logging/tracking, not filtering.
const KNOWN_CUSTOM_BOARDS = [
  'jetbrains.com',
  'canva.com',
  'figma.com',
  'linear.app',
  'vercel.com',
  'stripe.com',
  'shopify.com',
  'datadog.com',
  'elastic.co',
  'hashicorp.com',
  'cloudflare.com',
  'reddit.com',
  'pinterest.com',
  'dropbox.com',
  'spotify.com',
];

/**
 * Check if a string looks like a job title (not a nav label).
 * @param {string} text
 * @returns {boolean}
 */
function isJobTitle(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return false;
  const lower = trimmed.toLowerCase();
  if (TITLE_STOPWORDS.has(lower)) return false;
  // Must contain at least one letter
  if (!/[a-zA-Z]/u.test(lower)) return false;
  return true;
}

/**
 * Extract job links from raw HTML using anchor tag pattern matching.
 * Returns deduplicated {title, url} pairs.
 * @param {string} html
 * @param {string} baseUrl
 * @returns {Array<{title: string, url: string}>}
 */
function extractFromHtml(html, baseUrl) {
  const results = [];
  const seen = new Set();

  // Match <a ...>text</a> — simple but effective for server-rendered listings
  const anchorRe = /<a\s[^>]*href\s*=\s*"([^"]*)"[^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(html)) !== null) {
    const rawUrl = match[1].trim();
    const title = match[2].trim();
    if (!rawUrl || !title) continue;
    if (!rawUrl.startsWith('http') && !rawUrl.startsWith('/')) continue;

    // Resolve relative URLs
    let resolved;
    try {
      resolved = new URL(rawUrl, baseUrl).href;
    } catch {
      continue;
    }

    // Only keep links that look like job postings
    const path = new URL(resolved).pathname.toLowerCase();
    if (!path.includes('/job') && !path.includes('/career') && !path.includes('/position') && !path.includes('/opening')) {
      continue;
    }

    if (!isJobTitle(title)) continue;
    const key = resolved.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ title, url: resolved });
  }

  return results;
}

/**
 * Extract job listings from a Playwright page by trying multiple CSS selectors.
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{title: string, url: string}>>}
 */
async function extractFromPage(page) {
  const seen = new Set();
  const results = [];

  for (const selector of JOB_LINK_SELECTORS) {
    const anchors = await page.$$(selector);
    if (anchors.length === 0) continue;

    for (const a of anchors) {
      const href = await a.getAttribute('href').catch(() => null);
      if (!href) continue;
      const title = (await a.textContent().catch(() => '') || '').trim();
      if (!title || !isJobTitle(title)) continue;

      // Resolve relative URLs
      let resolved;
      try {
        resolved = new URL(href, page.url()).href;
      } catch {
        continue;
      }

      const key = resolved.split('?')[0];
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ title, url: resolved });
    }

    // If this selector produced results, don't try further selectors
    // (the most specific match is likely the best one)
    if (results.length > 0) break;
  }

  // Fallback: try all links on the page and filter to job-looking URLs
  if (results.length === 0) {
    const allAnchors = await page.$$('a');
    for (const a of allAnchors) {
      const href = await a.getAttribute('href').catch(() => null);
      if (!href) continue;
      let resolved;
      try {
        resolved = new URL(href, page.url()).href;
      } catch {
        continue;
      }
      const path = new URL(resolved).pathname.toLowerCase();
      if (!path.includes('/job') && !path.includes('/career') && !path.includes('/position')) continue;

      const title = (await a.textContent().catch(() => '') || '').trim();
      if (!title || !isJobTitle(title)) continue;

      const key = resolved.split('?')[0];
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ title, url: resolved });
    }
  }

  return results;
}

/**
 * Try to launch Playwright (headless Chromium) and extract job listings.
 * Returns null if Playwright is not installed or cannot launch.
 * @param {string} url
 * @returns {Promise<Array<{title: string, url: string}>|null>}
 */
async function tryPlaywrightExtract(url) {
  let chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    return null;
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      timeout: PLAYWRIGHT_TIMEOUT_MS,
    });
  } catch {
    return null;
  }

  let page;
  try {
    page = await browser.newPage();
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: PLAYWRIGHT_NAV_TIMEOUT_MS,
    });

    // Wait a bit for JS-rendered content to settle
    await page.waitForTimeout(3000);

    // Try waiting for common job-listing indicators
    try {
      await page.waitForSelector('a[href*="/jobs/"]', { timeout: 5000 });
    } catch {
      // Not all career pages use /jobs/ — proceed with extraction anyway
    }

    return await extractFromPage(page);
  } catch {
    return [];
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

/** @type {Provider} */
export default {
  id: 'browser-extract',

  /**
   * detect() — only matches entries explicitly configured for browser extraction.
   * This is a FALLBACK provider, not an auto-detect one. Entries must set
   * `browserExtract: true` or `scan_method: 'browser-extract'` in portals.yml.
   *
   * @param {import('./_types.js').PortalEntry} entry
   * @returns {{ url: string } | null}
   */
  detect(entry) {
    const isExplicit = entry.browserExtract === true || entry.scan_method === 'browser-extract';
    if (!isExplicit) return null;

    const url = entry.api || entry.careers_url || '';
    if (!url) return null;

    // Validate it's a fetchable URL
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    } catch {
      return null;
    }

    return { url };
  },

  /**
   * fetch() — two-phase extraction:
   *   1. Plain HTTP GET + regex parsing (fast, zero dependency)
   *   2. Playwright headless browser (for JS-rendered content)
   *
   * @param {{ name?: string, api?: string, careers_url?: string, browserExtract?: boolean, scan_method?: string }} entry
   * @param {{ fetchText: (url: string, opts?: object) => Promise<string> }} ctx
   * @returns {Promise<Array<{title: string, url: string, company: string, location: string}>>}
   */
  async fetch(entry, ctx) {
    const targetUrl = entry.api || entry.careers_url || '';
    const company = entry.name || '';

    // Phase 1: try plain HTTP fetch
    let jobs = [];
    try {
      const html = await ctx.fetchText(targetUrl, { timeoutMs: FETCH_TIMEOUT_MS });
      const extracted = extractFromHtml(html, targetUrl);
      if (extracted.length > 0) {
        jobs.push(...extracted);
      }
    } catch {
      // Plain fetch failed — fall through to Phase 2
    }

    // Phase 2: try Playwright if Phase 1 found nothing
    if (jobs.length === 0) {
      const pwJobs = await tryPlaywrightExtract(targetUrl);
      if (pwJobs && pwJobs.length > 0) {
        jobs.push(...pwJobs);
      }
    }

    return jobs.map((j) => ({
      title: j.title,
      url: j.url,
      company,
      location: '',
    }));
  },
};
