// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Adzuna provider — keyword-driven search across Adzuna's global job index.
// Uses Adzuna's public API: https://developer.adzuna.com/
//
// Wire in via a `job_boards:` entry with `provider: adzuna` in portals.yml.
// Required entry fields:
//   - scan_query: the keywords to search (e.g. "java backend")
//   - api_key_adzuna_id + api_key_adzuna_key, or set ADZUNA_APP_ID / ADZUNA_APP_KEY env vars
// Optional entry fields:
//   - scan_country: two-letter country code (default: gb)
//     Supported: gb, us, au, de, fr, nl, in, br, za, pl, ru, sg, ae

const ADZUNA_BASE = 'https://api.adzuna.com/v1/api/jobs';
const RESULTS_PER_PAGE = 50;

/** Supported country codes */
const ADZUNA_COUNTRIES = new Set([
  'gb', 'us', 'au', 'de', 'fr', 'nl', 'in', 'br', 'za', 'pl', 'ru', 'sg', 'ae',
]);

/**
 * Resolve Adzuna API credentials from entry or environment variables.
 * @param {{ api_key_adzuna_id?: string, api_key_adzuna_key?: string } & Record<string, any>} [entry]
 * @returns {{ appId: string, appKey: string }}
 */
export function resolveCredentials(entry) {
  const appId = entry?.api_key_adzuna_id || process.env.ADZUNA_APP_ID || '';
  const appKey = entry?.api_key_adzuna_key || process.env.ADZUNA_APP_KEY || '';
  return { appId, appKey };
}

/**
 * Normalize a single Adzuna job into the standard Job shape.
 * Exported for unit testing.
 *
 * @param {any} j - Raw Adzuna job object from API results array
 * @param {string} [fallbackCompany] - Fallback company name
 * @returns {{ title: string, url: string, company: string, location: string, salary: { min: number, max: number, currency: string } | null, postedAt?: number } | null}
 */
export function normalizeAdzunaJob(j, fallbackCompany) {
  if (!j || typeof j !== 'object') return null;

  const title = typeof j.title === 'string' ? j.title.trim() : '';
  if (!title) return null;

  let url = typeof j.redirect_url === 'string' ? j.redirect_url.trim() : '';
  if (url && !/^https?:\/\//i.test(url)) url = '';
  if (!url) return null;

  const company =
    j.company && typeof j.company.display_name === 'string' && j.company.display_name.trim()
      ? j.company.display_name.trim()
      : fallbackCompany || 'Adzuna';

  const location =
    j.location && typeof j.location.display_name === 'string'
      ? j.location.display_name.trim()
      : '';

  // Parse salary from salary_min / salary_max
  let salary = null;
  const minRaw = j.salary_min;
  const maxRaw = j.salary_max;
  let minVal = null;
  let maxVal = null;

  if (minRaw != null) {
    const n = Number(minRaw);
    if (Number.isFinite(n) && n >= 0) minVal = n;
  }
  if (maxRaw != null) {
    const n = Number(maxRaw);
    if (Number.isFinite(n) && n >= 0) maxVal = n;
  }

  if (minVal != null || maxVal != null) {
    const resolvedMin = /** @type {number} */ (minVal ?? maxVal);
    const resolvedMax = /** @type {number} */ (maxVal ?? minVal);
    const currency =
      typeof j.salary_currency === 'string' && j.salary_currency.trim()
        ? j.salary_currency.trim().toUpperCase()
        : '';
    salary = {
      min: Math.min(resolvedMin, resolvedMax),
      max: Math.max(resolvedMin, resolvedMax),
      currency,
    };
  }

  // Parse created date (ISO 8601 string) to epoch ms
  /** @type {number|undefined} */
  let postedAt;
  if (typeof j.created === 'string' && j.created) {
    const parsed = Date.parse(j.created);
    if (!Number.isNaN(parsed)) postedAt = parsed;
  }

  return { title, url, company, location, salary, postedAt };
}

/** @type {Provider} */
export default {
  id: 'adzuna',

  detect(entry) {
    // Activate for explicit provider match or keyword-search entries
    if (entry.provider === 'adzuna') return { url: ADZUNA_BASE };
    if (entry.scan_query && !entry.careers_url) return { url: ADZUNA_BASE };
    return null;
  },

  async fetch(entry, ctx) {
    const { appId, appKey } = resolveCredentials(entry);
    if (!appId || !appKey) {
      throw new Error(
        'adzuna: missing credentials — set api_key_adzuna_id + api_key_adzuna_key on entry, ' +
        'or ADZUNA_APP_ID + ADZUNA_APP_KEY environment variables',
      );
    }

    const keywords = entry.scan_query || entry.name || '';
    if (!keywords) {
      throw new Error('adzuna: no search query — set scan_query on the portal entry');
    }

    const country = entry.scan_country || 'gb';
    if (!ADZUNA_COUNTRIES.has(country)) {
      throw new Error(
        `adzuna: unsupported country code "${country}" — must be one of: ${[...ADZUNA_COUNTRIES].join(', ')}`,
      );
    }

    const url =
      `${ADZUNA_BASE}/${country}/search/1` +
      `?app_id=${encodeURIComponent(appId)}` +
      `&app_key=${encodeURIComponent(appKey)}` +
      `&results_per_page=${RESULTS_PER_PAGE}` +
      `&what=${encodeURIComponent(keywords)}` +
      `&content-type=application/json`;

    let json;
    try {
      json = await ctx.fetchJson(url, { redirect: 'error' });
    } catch (err) {
      throw new Error(`adzuna: API request failed — ${err.message}`);
    }

    if (!json || !Array.isArray(json.results)) {
      throw new Error(
        `adzuna: unexpected API response — expected { results: [...] }, got: [${json ? Object.keys(json).join(', ') : 'null'}]`,
      );
    }

    const fallbackCompany = entry.name || 'Adzuna';
    return json.results
      .map((j) => normalizeAdzunaJob(j, fallbackCompany))
      .filter(Boolean);
  },
};
