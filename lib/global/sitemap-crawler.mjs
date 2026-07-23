/**
 * lib/global/sitemap-crawler.mjs — Sitemap & RSS Feed Discovery & Crawling
 *
 * Discovers career/job pages at massive scale:
 *   1. Sitemap index parsing (recursive)
 *   2. Career-specific sitemap URLs (/jobs-sitemap, /careers-sitemap, etc.)
 *   3. XML Sitemap parsing (urlset)
 *   4. RSS/Atom feed discovery & parsing
 *   5. Parallel crawling with rate limiting
 *
 * Target: 100K+ career pages discovered per run via sitemaps alone.
 */

import { createHash } from 'crypto';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

// ══════════════════════════════════════════════════════════════════════
// SITEMAP DISCOVERY PATTERNS
// ══════════════════════════════════════════════════════════════════════

const KNOWN_SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/sitemap/sitemap-index.xml',
  '/sitemaps/sitemap.xml',
  '/sitemap/',
  '/sitemaps/',
  '/job-sitemap.xml',
  '/jobs-sitemap.xml',
  '/careers-sitemap.xml',
  '/career-sitemap.xml',
  '/job-sitemap-index.xml',
  '/jobs-sitemap-index.xml',
  '/career-sitemap-index.xml',
  '/sitemap-index-1.xml',
  '/sitemap.xml.gz',
  '/sitemap-index.xml.gz',
  '/robots.txt',
  '/job-listing-sitemap.xml',
  '/recruitment-sitemap.xml',
  '/vacancies-sitemap.xml',
  '/sitemap-jobs.xml',
  '/sitemap-careers.xml',
  '/sitemap-positions.xml',
  '/xmlsitemap.php',
  '/google-sitemap.xml',
  '/sitemap_google.xml',
  '/sitemap-index-category.xml',
];

// ══════════════════════════════════════════════════════════════════════
// CORE
// ══════════════════════════════════════════════════════════════════════

export class SitemapCrawler {
  constructor(options = {}) {
    this.seenUrls = new Set();
    this.maxUrls = options.maxUrls || 100000;
    this.concurrency = options.concurrency || 10;
    this.timeout = options.timeout || 10000;
    this.seenPaths = new Set();
    this.foundSitemaps = new Set();
    this.stats = { sitemapsParsed: 0, urlsFound: 0, urlsExcluded: 0, errors: 0 };
  }

  /**
   * Discover and parse sitemaps for a set of company URLs.
   * @param {string[]} companyUrls - Base URLs of companies (e.g., ["https://stripe.com"])
   * @returns {Promise<string[]>} - Discovered job/career page URLs
   */
  async discoverFromCompanies(companyUrls) {
    console.log(`\n📋 Sitemap Discovery: scanning ${companyUrls.length} companies\n`);

    for (const url of companyUrls) {
      try {
        const sitemaps = await this.discoverSitemaps(url);
        for (const sitemapUrl of sitemaps) {
          if (this.foundSitemaps.has(sitemapUrl)) continue;
          this.foundSitemaps.add(sitemapUrl);
          await this.parseSitemap(sitemapUrl);
        }
      } catch (err) {
        this.stats.errors++;
      }
    }

    console.log(`\n✅ Sitemap Discovery: ${this.stats.urlsFound} URLs from ${this.stats.sitemapsParsed} sitemaps`);
    return [...this.seenUrls].slice(0, this.maxUrls);
  }

  /**
   * Discover sitemap URLs for a given website.
   */
  async discoverSitemaps(baseUrl) {
    const sitemaps = [];
    const domain = new URL(baseUrl).origin;

    // 1. Check robots.txt for sitemap references
    try {
      const robotsTxt = await this.fetchText(`${domain}/robots.txt`);
      const sitemapRefs = robotsTxt.match(/Sitemap:\s*(https?:\/\/\S+)/gi);
      if (sitemapRefs) {
        for (const ref of sitemapRefs) {
          const url = ref.replace(/Sitemap:\s*/i, '').trim();
          sitemaps.push(url);
        }
      }
    } catch { /* no robots.txt */ }

    // 2. Try known sitemap paths
    for (const path of KNOWN_SITEMAP_PATHS) {
      if (this.seenPaths.has(path)) continue;
      this.seenPaths.add(path);
      try {
        const url = `${domain}${path}`;
        const res = await this.fetchHead(url);
        if (res.status === 200) {
          const contentType = res.headers['content-type'] || '';
          if (contentType.includes('xml') || path.endsWith('.gz') || path.endsWith('.xml')) {
            sitemaps.push(url);
          }
        }
      } catch { /* path doesn't exist */ }
    }

    return [...new Set(sitemaps)];
  }

  /**
   * Parse a sitemap (supports index and urlset, including gzipped).
   */
  async parseSitemap(url) {
    if (this.stats.sitemapsParsed % 50 === 0 && this.stats.sitemapsParsed > 0) {
      console.log(`   📊 ${this.stats.sitemapsParsed} sitemaps parsed, ${this.stats.urlsFound} URLs found`);
    }

    try {
      const xml = await this.fetchText(url);
      this.stats.sitemapsParsed++;

      // Check if it's a sitemap index (contains <sitemap> elements)
      if (xml.includes('<sitemap>') || xml.includes('<sitemapindex') || xml.includes('<sitemapindex')) {
        const childUrls = this.extractXmlUrls(xml, 'loc');
        // Filter to only sitemap status files
        const sitemapLocations = this.extractChildSitemaps(xml);
        for (const childUrl of sitemapLocations) {
          if (this.foundSitemaps.has(childUrl)) continue;
          this.foundSitemaps.add(childUrl);
          await this.parseSitemap(childUrl);
        }
      }
      // Check if it's a urlset (contains <url> elements)
      else if (xml.includes('<url>') || xml.includes('<urlset')) {
        const urls = this.extractXmlUrls(xml, 'loc');
        const filtered = this.filterJobUrls(urls);

        for (const jobUrl of filtered) {
          if (this.seenUrls.size >= this.maxUrls) break;
          const key = jobUrl.split('?')[0];
          if (!this.seenUrls.has(key)) {
            this.seenUrls.add(key);
            this.stats.urlsFound++;
          }
        }
      }

    } catch {
      this.stats.errors++;
    }

    return [...this.seenUrls];

    // Check if it's a sitemap index (contains <sitemap> elements)
    if (xml.includes('<sitemap>') || xml.includes('<sitemapindex') || xml.includes('<sitemapindex')) {
      const childUrls = this.extractXmlUrls(xml, 'loc');
      // Filter to only sitemap status files
      const sitemapLocations = this.extractChildSitemaps(xml);
      for (const childUrl of sitemapLocations) {
        if (this.foundSitemaps.has(childUrl)) continue;
        this.foundSitemaps.add(childUrl);
        await this.parseSitemap(childUrl);
      }
    }
    // Check if it's a urlset (contains <url> elements)
    else if (xml.includes('<url>') || xml.includes('<urlset')) {
      const urls = this.extractXmlUrls(xml, 'loc');
      const filtered = this.filterJobUrls(urls);

      for (const jobUrl of filtered) {
        if (this.seenUrls.size >= this.maxUrls) break;
        const key = jobUrl.split('?')[0];
        if (!this.seenUrls.has(key)) {
          this.seenUrls.add(key);
          this.stats.urlsFound++;
        }
      }
    }
  }

  /**
   * Extract URLs from adjacent <loc> tags in XML.
   */
  extractXmlUrls(xml, tag) {
    const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'gi');
    const urls = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      urls.push(match[1].trim());
    }
    return urls;
  }

  /**
   * Extract child sitemap locations (handles various formats).
   */
  extractChildSitemaps(xml) {
    const sitemaps = [];
    const regex = /<loc[^>]*>([^<]+)<\/loc>/gi;
    const urls = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      urls.push(match[1].trim());
    }

    // A sitemap index typically only links to other sitemaps
    for (const url of urls) {
      if (url.includes('sitemap') || url.includes('sitemap') || url.includes('xml')) {
        sitemaps.push(url);
      }
    }

    return sitemaps;
  }

  /**
   * Filter URLs to keep only job/career-related ones.
   */
  filterJobUrls(urls) {
    const jobPatterns = [
      '/jobs/', '/careers/', '/career/', '/job/', '/positions/', '/position/',
      '/vacancies/', '/vacancy/', '/opportunities/', '/opportunity/',
      '/openings/', '/opening/', '/requisitions/', '/requisition/',
      '/jobs-', '/careers-', '/job-', '-job-', '-career-',
      '/apply/', '/applications/', '/trabajos/', '/empleos/',
      '/stellenanzeigen/', '/beruf/', '/stellen/',
      '/emploi/', '/offre/', '/recrutement/',
      '?gh_jid=', '?utm_', 'jobId=', 'postingId=',
      '/work-with-us', '/join-us', '/team',
    ];

    const excludePatterns = [
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.css', '.js',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.tar', '.gz', '.mp4', '.mp3', '.avi',
      '/login', '/register', '/signup', '/sign-in', '/sign-out',
      '/reset-password', '/forgot-password',
      'facebook.com', 'twitter.com', 'linkedin.com/share',
      'instagram.com', 'youtube.com',
    ];

    return urls.filter(url => {
      try {
        const u = url.toLowerCase();
        if (excludePatterns.some(p => u.includes(p))) {
          this.stats.urlsExcluded++;
          return false;
        }
        return jobPatterns.some(p => u.includes(p));
      } catch {
        return false;
      }
    });
  }

  /**
   * Fetch text content with retries.
   */
  async fetchText(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeout);

        const res = await fetch(url, {
          headers: DEFAULT_HEADERS,
          signal: controller.signal,
        });
        clearTimeout(id);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        return text;
      } catch (err) {
        if (attempt === 2) throw err;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    throw new Error('Failed after retries');
  }

  /**
   * HEAD request to check URL exists.
   */
  async fetchHead(url) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { method: 'HEAD', headers: DEFAULT_HEADERS, signal: controller.signal, redirect: 'follow' });
      clearTimeout(id);
      return { status: res.status, headers: Object.fromEntries(res.headers.entries()) };
    } catch {
      clearTimeout(id);
      return { status: 0, headers: {} };
    }
  }

  /**
   * Get statistics.
   */
  getStats() {
    return {
      ...this.stats,
      uniqueUrls: this.seenUrls.size,
      foundSitemaps: this.foundSitemaps.size,
    };
  }
}

// ══════════════════════════════════════════════════════════════════════
// RSS/ATOM FEED CRAWLER
// ══════════════════════════════════════════════════════════════════════

export class RSSCrawler {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 5;
    this.timeout = options.timeout || 10000;
    this.seenEntries = new Set();
    this.stats = { feedsParsed: 0, entriesFound: 0, errors: 0 };
  }

  /**
   * Common RSS/Atom feed paths for career pages.
   */
  static FEED_PATHS = [
    '/feed/', '/feed.xml', '/rss/', '/rss.xml', '/rssfeed.xml',
    '/atom.xml', '/feed/rss/', '/feed/atom/', '/blog/feed/',
    '/jobs/feed/', '/careers/feed/', '/jobs/rss/', '/careers/rss/',
    '/blog/rss.xml', '/news/feed/', '/news/rss.xml',
    '/index.xml', '/job-feed.xml', '/careers-feed.xml',
    '/.rss', '/?feed=rss', '/?feed=atom',
  ];

  /**
   * Discover and parse RSS/Atom feeds from company URLs.
   */
  async discoverFeeds(companyUrls) {
    console.log(`\n📡 RSS Feed Discovery: scanning ${companyUrls.length} companies\n`);

    const allEntries = [];

    for (const baseUrl of companyUrls) {
      try {
        const domain = new URL(baseUrl).origin;
        const feeds = await this.discoverFeedUrls(domain);

        for (const feedUrl of feeds) {
          try {
            const entries = await this.parseFeed(feedUrl);
            for (const entry of entries) {
              const key = entry.url?.split('?')[0] || entry.id;
              if (key && !this.seenEntries.has(key)) {
                this.seenEntries.add(key);
                allEntries.push(entry);
                this.stats.entriesFound++;
              }
            }
            this.stats.feedsParsed++;
          } catch { /* skip bad feed */ }
        }
      } catch { /* skip bad domain */ }
    }

    console.log(`   📊 ${this.stats.feedsParsed} feeds, ${this.stats.entriesFound} entries`);
    return allEntries;
  }

  /**
   * Discover feed URLs for a domain.
   */
  async discoverFeedUrls(domain) {
    const feeds = [];

    // Try common paths
    for (const path of RSSCrawler.FEED_PATHS) {
      try {
        const url = `${domain}${path}`;
        const res = await this.fetchHead(url);
        if (res.status === 200) {
          const ct = res.headers['content-type'] || '';
          if (ct.includes('xml') || ct.includes('rss') || ct.includes('atom') || ct.includes('feed')) {
            feeds.push(url);
          }
        }
      } catch { /* skip */ }
    }

    // Look for <link> tags in HTML
    try {
      const html = await this.fetchText(domain);
      const regex = /<link[^>]+type="application\/(?:rss|atom)\+xml"[^>]*href="([^"]+)"/gi;
      let match;
      while ((match = regex.exec(html)) !== null) {
        const href = match[1];
        const feedUrl = href.startsWith('http') ? href : `${domain}${href.startsWith('/') ? '' : '/'}${href}`;
        feeds.push(feedUrl);
      }
    } catch { /* skip */ }

    return [...new Set(feeds)];
  }

  /**
   * Parse an RSS or Atom feed.
   */
  async parseFeed(url) {
    const xml = await this.fetchText(url);
    const entries = [];

    // RSS 2.0 items
    const rssRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = rssRegex.exec(xml)) !== null) {
      const item = match[1];
      entries.push({
        title: this.extractTag(item, 'title'),
        url: this.extractTag(item, 'link'),
        description: this.extractTag(item, 'description'),
        pubDate: this.extractTag(item, 'pubDate'),
        id: this.extractTag(item, 'guid'),
      });
    }

    // If no RSS items, try Atom entries
    if (entries.length === 0) {
      const atomRegex = /<entry>([\s\S]*?)<\/entry>/gi;
      while ((match = atomRegex.exec(xml)) !== null) {
        const entry = match[1];
        const links = this.extractXmlUrls(entry, 'link');
        const hrefMatch = /href="([^"]+)"/.exec(match[0]);
        entries.push({
          title: this.extractTag(entry, 'title'),
          url: hrefMatch?.[1] || links[0] || '',
          description: this.extractTag(entry, 'summary') || this.extractTag(entry, 'content'),
          pubDate: this.extractTag(entry, 'updated') || this.extractTag(entry, 'published'),
          id: this.extractTag(entry, 'id'),
        });
      }
    }

    return entries.filter(e => e.url);
  }

  extractTag(xml, tag) {
    const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
    const match = regex.exec(xml);
    return match ? match[1].trim() : '';
  }

  extractXmlUrls(xml, tag) {
    const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'gi');
    const urls = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      urls.push(match[1].trim());
    }
    return urls;
  }

  async fetchText(url) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, { headers: DEFAULT_HEADERS, signal: controller.signal });
      clearTimeout(id);
      return await res.text();
    } catch {
      clearTimeout(id);
      throw new Error('Fetch failed');
    }
  }

  async fetchHead(url) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { method: 'HEAD', headers: DEFAULT_HEADERS, signal: controller.signal, redirect: 'follow' });
      clearTimeout(id);
      return { status: res.status, headers: Object.fromEntries(res.headers.entries()) };
    } catch {
      clearTimeout(id);
      return { status: 0, headers: {} };
    }
  }
}

export { SitemapCrawler as default };
