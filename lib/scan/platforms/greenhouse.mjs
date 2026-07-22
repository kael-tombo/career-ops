const GREENHOUSE_API_BASE = 'https://boards-api.greenhouse.io/v1/boards';

/**
 * Scan a Greenhouse-powered job board via its structured JSON API.
 *
 * @param {object} company - Company config from portals.yml
 * @param {object} filter - Title filter {positive: string[], negative: string[]}
 * @returns {Promise<Array<{title, url, location, department, publishedAt}>>}
 */
export async function scan(company, filter) {
    const boardToken = extractBoardToken(company);
    if (!boardToken) {
        console.log(`   ⚠️  ${company.name}: could not extract Greenhouse board token`);
        return [];
    }

    const apiUrl = `${GREENHOUSE_API_BASE}/${boardToken}/jobs`;
    console.log(`   📡 ${company.name}...`);

    try {
        const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) {
            console.log(`      ⚠️  HTTP ${resp.status} — skipping`);
            return [];
        }
        const data = await resp.json();
        const jobs = data.jobs || [];

        return jobs
            .filter(j => applyTitleFilter(j.title, filter))
            .map(j => ({
                title: j.title,
                url: j.absolute_url,
                location: (j.location && j.location.name) || '',
                department: (j.departments && j.departments[0] && j.departments[0].name) || '',
                publishedAt: j.updated_at || '',
            }));
    } catch (err) {
        if (err.name === 'TimeoutError') {
            console.log(`      ⏱️  Timeout — skipping`);
        } else {
            console.log(`      ❌ Error: ${err.message.substring(0, 60)}`);
        }
        return [];
    }
}

/**
 * Extract the board token from a company config.
 * Prefers the `api` field, falls back to parsing the `careers_url`.
 */
function extractBoardToken(company) {
    if (company.api) {
        const match = company.api.match(/\/boards\/([^/]+)/);
        if (match) return match[1];
    }
    if (company.careers_url) {
        const match = company.careers_url.match(/greenhouse\.io\/([^/?#]+)/);
        if (match) return match[1];
    }
    return null;
}

/**
 * Check whether a job title matches the configured title filter.
 */
function applyTitleFilter(title, filter) {
    if (!filter) return true;
    const t = title.toLowerCase();
    const hasPositive = filter.positive && filter.positive.length > 0;
    const hasNegative = filter.negative && filter.negative.length > 0;
    if (hasPositive && !filter.positive.some(p => t.includes(p.toLowerCase()))) return false;
    if (hasNegative && filter.negative.some(n => t.includes(n.toLowerCase()))) return false;
    return true;
}

export const platform = 'greenhouse';
