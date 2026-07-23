/**
 * lib/fetch-jd.mjs — Fetch job description from a URL
 *
 * Tries fetch first, falls back to Playwright if available.
 * Returns the text content of the page, stripped of navigation/footer elements.
 */

export async function tryFetch(url, timeout = 15000) {
  // Try simple HTTP fetch first
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CareerOPS/3.0)' },
    });
    if (res.ok) {
      const html = await res.text();
      return extractText(html);
    }
  } catch {
    // Fall through to Playwright
  }

  // Try Playwright
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      await page.waitForTimeout(2000);
      const text = await page.evaluate(() => {
        const main = document.querySelector('main') || document.querySelector('article') || document.querySelector('.job-description') || document.body;
        const clone = main.cloneNode(true);
        clone.querySelectorAll('nav, footer, header, script, style, .navbar, .footer').forEach(el => el.remove());
        return clone.innerText;
      });
      return text;
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

function extractText(html) {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '';
  const body = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${title}\n\n${body}`.slice(0, 50000);
}
