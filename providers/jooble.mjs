// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Jooble provider — keyword-driven search across Jooble's global job index.
// Uses Jooble's public REST API: https://jooble.org/api/about
//
// Wire in via a `job_boards:` entry with `provider: jooble` in portals.yml.
// Required entry fields:
//   - scan_query: the keywords to search (e.g. "java backend")
//   - api_key_jooble, or set JOOBLE_API_KEY env var
// Optional entry fields:
//   - scan_location: location filter string (default: "" — all locations)

/**
 * Resolve Jooble API key from entry or environment variable.
 * @param {{ api_key_jooble?: string } & Record<string, any>} [entry]
 * @returns {string}
 */
export function resolveApiKey(entry) {
  return entry?.api_key_jooble || process.env.JOOBLE_API_KEY || '';
}

/**
 * Parse Jooble's free-text salary field into a structured salary object.
 * Handles formats like "50,000 - 70,000 USD", "17,600 UAH", or "Negotiable".
 * Exported for unit testing.
 *
 * @param {string|null|undefined} salaryStr - Raw salary string from Jooble API
 * @returns {{ min: number, max: number, currency: string } | null}
 */
export function parseJoobleSalary(salaryStr) {
  if (!salaryStr || typeof salaryStr !== 'string') return null;
  const trimmed = salaryStr.trim();
  if (!trimmed) return null;

  // Extract currency code (2-4 uppercase letters, e.g. USD, UAH, EUR, GBP)
  const currencyMatch = trimmed.match(/\b([A-Z]{2,4})\b/);
  const currency = currencyMatch ? currencyMatch[1] : '';

  // Strip commas and extract all numeric values
  const cleaned = trimmed.replace(/,/g, '');
  const numberMatches = cleaned.match(/\d+(\.\d+)?/g);
  if (!numberMatches || numberMatches.length === 0) return null;

  const vals = numberMatches.map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  if (vals.length === 0) return null;

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  return { min, max, currency };
}

/**
 * Normalize a single Jooble job into the standard Job shape.
 * Exported for unit testing.
 *
 * @param {any} j - Raw Jooble job object from the jobs array
 * @param {string} [fallbackCompany] - Fallback company name
 * @returns {{ title: string, url: string, company: string, location: string, salary: { min: number, max: number, currency: string } | null, postedAt?: number } | null}
 */
export function normalizeJoobleJob(j, fallbackCompany) {
  if (!j || typeof j !== 'object') return null;

  const title = typeof j.title === 'string' ? j.title.trim() : '';
  if (!title) return null;

  let url = typeof j.link === 'string' ? j.link.trim() : '';
  if (url && !/^https?:\/\//i.test(url)) url = '';
  if (!url) return null;

  const company =
    typeof j.company === 'string' && j.company.trim()
      ? j.company.trim()
      : fallbackCompany || 'Jooble';

  const location = typeof j.location === 'string' ? j.location.trim() : '';

  const salary = parseJoobleSalary(j.salary);

  // Parse updated timestamp — strip microsecond precision for Date.parse
  /** @type {number|undefined} */
  let postedAt;
  if (typeof j.updated === 'string' && j.updated) {
    const cleaned = j.updated.replace(/\.(\d{3})\d+/, '.$1');
    const parsed = Date.parse(cleaned);
    if (!Number.isNaN(parsed)) postedAt = parsed;
  }

  return { title, url, company, location, salary, postedAt };
}

/** @type {Provider} */
export default {
  id: 'jooble',

  detect(entry) {
    // Activate for explicit provider match or keyword-search entries
    if (entry.provider === 'jooble') return { url: 'https://jooble.org/api' };
    if (entry.scan_query && !entry.careers_url) return { url: 'https://jooble.org/api' };
    return null;
  },

  async fetch(entry, ctx) {
    const apiKey = resolveApiKey(entry);
    if (!apiKey) {
      throw new Error(
        'jooble: missing API key — set api_key_jooble on the entry, or JOOBLE_API_KEY environment variable',
      );
    }

    const keywords = entry.scan_query || entry.name || '';
    if (!keywords) {
      throw new Error('jooble: no search query — set scan_query on the portal entry');
    }

    const url = `https://jooble.org/api/${encodeURIComponent(apiKey)}`;
    const body = JSON.stringify({
      keywords,
      location: entry.scan_location || '',
      page: 1,
    });

    let json;
    try {
      json = await ctx.fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        redirect: 'error',
      });
    } catch (err) {
      throw new Error(`jooble: API request failed — ${err.message}`);
    }

    if (!json || !Array.isArray(json.jobs)) {
      throw new Error(
        `jooble: unexpected API response — expected { jobs: [...] }, got: [${json ? Object.keys(json).join(', ') : 'null'}]`,
      );
    }

    const fallbackCompany = entry.name || 'Jooble';
    return json.jobs
      .map((j) => normalizeJoobleJob(j, fallbackCompany))
      .filter(Boolean);
  },
};
