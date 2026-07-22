const ASHBY_API_BASE = 'https://api.ashbyhq.com/posting-api/job-board';

/**
 * Scan an Ashby-powered job board via its structured JSON API.
 *
 * @param {object} company - Company config from portals.yml
 * @param {object} filter - Title filter {positive: string[], negative: string[]}
 * @returns {Promise<Array<{title, url, location, department, publishedAt}>>}
 */
export async function scan(company, filter) {
    const boardToken = extractBoardToken(company);
    if (!boardToken) {
        console.log(`   ⚠️  ${company.name}: could not extract Ashby board token`);
        return [];
    }

    const apiUrl = `${ASHBY_API_BASE}/${boardToken}`;
    console.log(`   ⚡ ${company.name}...`);

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
                title: j.title || '',
                url: j.url || `https://jobs.ashbyhq.com/${boardToken}/${j.id}`,
                location: j.location || '',
                department: j.departmentName || j.department || '',
                publishedAt: j.publishedAt || '',
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
 */
function extractBoardToken(company) {
    if (company.careers_url) {
        const match = company.careers_url.match(/ashbyhq\.com\/([^/?#]+)/);
        if (match) return match[1];
    }
    return null;
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

export const platform = 'ashby';
