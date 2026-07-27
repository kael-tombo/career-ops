/**
 * lib/global/global-orchestrator.mjs — Global Job Discovery Orchestrator
 *
 * THE MASTER CONTROLLER. Orchestrates ALL discovery sources across ALL countries:
 *
 * Source Layers:
 *   Layer 1 — Search Engines: Google (180+ TLDs), Bing, Yandex, Baidu, Naver,
 *              Seznam, Yahoo Japan, DuckDuckGo, Brave, Qwant, Sogou
 *   Layer 2 — Country Job Boards: 500+ boards across 100+ countries
 *   Layer 3 — Sitemap Discovery: Millions of career pages via XML sitemaps
 *   Layer 4 — RSS Feeds: Real-time job feeds from company career pages
 *   Layer 5 — Schema.org/JSON-LD: Structured job data from ANY page
 *   Layer 6 — Direct ATS APIs: Greenhouse, Lever, Ashby, Workday (existing drivers)
 *
 * Results are deduplicated, scored, country-tagged, and pushed to the pipeline.
 */

import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import yaml from 'js-yaml';
import { chromium } from 'playwright';

import { searchAllCountries, searchCountry, getCountry, getCountryCodes, COUNTRIES, SEARCH_ENGINES } from './search-engines.mjs';
import { SchemaExtractor } from './schema-extractor.mjs';
import { SitemapCrawler, RSSCrawler } from './sitemap-crawler.mjs';
import { ProxyRotator } from './proxy-rotator.mjs';

const ROOT = process.cwd();
const PIPELINE_FILE = join(ROOT, 'data/pipeline.md'); // Append-only job list

// ══════════════════════════════════════════════════════════════════════
// ORCHESTRATOR
// ══════════════════════════════════════════════════════════════════════

export class GlobalOrchestrator {
  constructor(options = {}) {
    this.queries = options.queries || []; // Search queries (job titles)
    this.maxPerSource = options.maxPerSource || 50;
    this.maxTotal = options.maxTotal || 10000;
    this.concurrency = options.concurrency || 5;
    this.countryCodes = options.countryCodes || getCountryCodes();
    this.proxyRotator = new ProxyRotator({
      maxRequestsPerMinute: options.rpm || 60,
      configPath: options.proxyConfig,
    });
    this.browser = null;
    this.allResults = [];
    this.seenUrls = new Set();
    this.stats = {
      sourcesChecked: 0,
      urlsFound: 0,
      urlsDeduped: 0,
      urlsRejected: 0,
      countriesCovered: 0,
      jobsExtracted: 0,
      startTime: 0,
      endTime: 0,
      sourceBreakdown: {},
    };
  }

  /**
   * Run a full global discovery sweep across ALL sources.
   * @returns {Promise<{jobs: Array, stats: object}>}
   */
  async runFullSweep() {
    this.stats.startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🌍 GLOBAL JOB DISCOVERY SWEEP`);
    console.log(`   Queries: ${this.queries.length} | Countries: ${this.countryCodes.length}`);
    console.log(`   Max total: ${this.maxTotal} | Concurrency: ${this.concurrency}`);
    console.log(`${'='.repeat(60)}\n`);

    // ─── Layer 1: Search Engines (all countries) ───
    if (this.allResults.length < this.maxTotal) {
      console.log(`\n📡 Layer 1: Search Engines (${this.countryCodes.length} countries)\n`);
      try {
        const engineResults = await searchAllCountries(this.queries, {
          maxResults: Math.ceil(this.maxPerSource / 3),
          countryCodes: this.countryCodes,
          parallel: this.concurrency > 1,
        });
        await this._addResults(engineResults, 'search-engines');
      } catch (err) {
        console.error(`   ❌ Search engine layer error: ${err.message}`);
      }
    }

    // ─── Layer 2: Country Job Boards ───
    if (this.allResults.length < this.maxTotal) {
      console.log(`\n🏢 Layer 2: Country Job Boards\n`);
      try {
        const boardResults = await this._searchCountryBoards();
        await this._addResults(boardResults, 'country-boards');
      } catch (err) {
        console.error(`   ❌ Country boards layer error: ${err.message}`);
      }
    }

    // ─── Layer 3: Sitemap Discovery ───
    if (this.allResults.length < this.maxTotal) {
      console.log(`\n🗺️  Layer 3: Sitemap Discovery\n`);
      try {
        const sitemapResults = await this._discoverViaSitemaps();
        await this._addResults(sitemapResults, 'sitemaps');
      } catch (err) {
        console.error(`   ❌ Sitemap layer error: ${err.message}`);
      }
    }

    // ─── Layer 4: RSS Feeds ───
    if (this.allResults.length < this.maxTotal) {
      console.log(`\n📡 Layer 4: RSS Feeds\n`);
      try {
        const feedResults = await this._discoverViaRSS();
        await this._addResults(feedResults, 'rss-feeds');
      } catch (err) {
        console.error(`   ❌ RSS feed layer error: ${err.message}`);
      }
    }

    // ─── Dedup & Score ───
    const finalJobs = this._dedupAndScore();

    this.stats.endTime = Date.now();
    this.stats.jobsExtracted = finalJobs.length;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ GLOBAL SWEEP COMPLETE`);
    console.log(`   ${finalJobs.length} unique jobs across ${this.stats.countriesCovered} countries`);
    console.log(`   Time: ${((this.stats.endTime - this.stats.startTime) / 1000 / 60).toFixed(1)} minutes`);
    console.log(`   Source breakdown:`, this.stats.sourceBreakdown);
    console.log(`${'='.repeat(60)}\n`);

    return { jobs: finalJobs, stats: this.stats };
  }

  /**
   * Search country-specific job boards for each country.
   */
  async _searchCountryBoards() {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }

    const boards = this._loadBoards();
    const results = [];

    // Build board URLs by country
    const urlQueue = [];
    for (const countryCode of this.countryCodes) {
      const country = COUNTRIES[countryCode];
      if (!country) continue;
      const countryBoards = boards[countryCode];
      if (!countryBoards?.boards) continue;

      for (const board of countryBoards.boards) {
        for (const query of this.queries) {
          const searchUrl = this._buildBoardSearchUrl(board, query, countryCode);
          if (searchUrl) {
            urlQueue.push({ url: searchUrl, board, countryCode, country: country.name });
          }
        }
      }
    }

    console.log(`   ${urlQueue.length} board+query combinations to check`);

    // Process in parallel with concurrency limit
    const batchSize = this.concurrency;
    for (let i = 0; i < urlQueue.length && results.length < this.maxPerSource * 50; i += batchSize) {
      const batch = urlQueue.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          try {
            const proxy = this.proxyRotator.getNextProxy(item.countryCode);
            await this.proxyRotator.respectRateLimit();

            const page = await this.browser.newPage();
            if (proxy.url) {
              await page.authenticate(proxy.auth);
            }

            // Apply fingerprint
            const fp = proxy.fingerprint;
            if (fp.userAgent) await page.setUserAgent(fp.userAgent);
            if (fp.viewport) await page.setViewportSize(fp.viewport);

            await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(1000 + Math.random() * 2000);

            const html = await page.content();

            // Extract jobs via Schema.org
            const extracted = SchemaExtractor.extract(html, page.url());

            // Also extract job links from page
            const links = await page.evaluate(() => {
              const anchors = Array.from(document.querySelectorAll('a[href*="/job"], a[href*="/jobs/"], a[href*="/vacancy"], a[href*="/position"]'));
              return anchors.map(a => ({ title: a.innerText?.trim() || '', url: a.href }));
            });

            await page.close();

            const pageResults = [...extracted.map(j => ({
              title: j.title,
              url: j.url,
              company: j.company || item.board.name,
              location: j.location || item.country,
              country: item.country,
              countryCode: item.countryCode,
              source: `board:${item.board.name}`,
              confidence: j.confidence,
            })), ...links.filter(l => l.title).map(l => ({
              title: l.title,
              url: l.url,
              company: item.board.name,
              location: item.country,
              country: item.country,
              countryCode: item.countryCode,
              source: `board:${item.board.name}`,
              confidence: 0.5,
            }))];

            return pageResults;
          } catch {
            return [];
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          results.push(...result.value);
        }
      }

      // Progress
      if ((i / batchSize) % 10 === 0 && i > 0) {
        console.log(`   Progress: ${Math.min(i + batchSize, urlQueue.length)}/${urlQueue.length} boards (${results.length} results so far)`);
      }
    }

    return results;
  }

  /**
   * Build a search URL for a specific job board.
   */
  _buildBoardSearchUrl(board, query, countryCode) {
    try {
      const baseUrl = board.url.replace(/\/$/, '');

      // Attempt to construct a search URL based on common patterns
      const searchPaths = [
        `/search?q=${encodeURIComponent(query)}`,
        `/search/${encodeURIComponent(query)}`,
        `/jobs?q=${encodeURIComponent(query)}`,
        `/jobs/search?keywords=${encodeURIComponent(query)}`,
        `/${encodeURIComponent(query)}`,
        `/results?query=${encodeURIComponent(query)}`,
      ];

      // For known boards, use specific patterns
      const domain = new URL(baseUrl).hostname.toLowerCase();

      if (domain.includes('linkedin')) {
        return `${baseUrl}/search?keywords=${encodeURIComponent(query)}&location=${countryCode}`;
      }
      if (domain.includes('indeed')) {
        return `${baseUrl}/jobs?q=${encodeURIComponent(query)}`;
      }
      if (domain.includes('glassdoor')) {
        return `${baseUrl}/Job/jobs.htm?sc.keyword=${encodeURIComponent(query)}`;
      }
      if (domain.includes('naukri') || domain.includes('jobstreet') || domain.includes('seek')) {
        return `${baseUrl}/${encodeURIComponent(query)}-jobs`;
      }

      // Generic fallback: try the search paths
      return `${baseUrl}${searchPaths[0]}`;
    } catch {
      return board.url;
    }
  }

  /**
   * Discover jobs via sitemap crawling.
   */
  async _discoverViaSitemaps() {
    // First, get company URLs from the country boards + existing portals
    const boards = this._loadBoards();
    const companyUrls = [];

    for (const countryCode of Object.keys(boards)) {
      const country = boards[countryCode];
      if (country.boards) {
        for (const board of country.boards) {
          try {
            const domain = new URL(board.url).origin;
            companyUrls.push(domain);
          } catch { /* skip */ }
        }
      }
    }

    // Remove duplicates and limit
    const uniqueDomains = [...new Set(companyUrls)].slice(0, 1000);

    const crawler = new SitemapCrawler({
      maxUrls: this.maxTotal * 2,
      concurrency: this.concurrency,
    });

    const sitemapUrls = await crawler.discoverFromCompanies(uniqueDomains);

    // Fetch each URL and extract via Schema.org
    const results = [];
    const batchSize = this.concurrency;

    for (let i = 0; i < sitemapUrls.length && results.length < this.maxTotal; i += batchSize) {
      const batch = sitemapUrls.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (url) => {
          try {
            await this.proxyRotator.respectRateLimit();
            const res = await fetch(url, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) return null;
            const html = await res.text();
            const extracted = SchemaExtractor.extract(html, url);
            if (extracted.length === 0) return null;
            return extracted.map(j => ({
              title: j.title,
              url: j.url || url,
              company: j.company || SchemaExtractor.guessCompany(url),
              location: j.location || '',
              country: '',
              countryCode: '',
              source: `sitemap:${new URL(url).hostname}`,
              salary: j.salary,
              remote: j.remote,
              confidence: j.confidence,
            }));
          } catch {
            return null;
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(...result.value);
        }
      }

      if (i % 500 === 0 && i > 0) {
        console.log(`   Sitemap URLs processed: ${Math.min(i + batchSize, sitemapUrls.length)}/${sitemapUrls.length}`);
      }
    }

    return results;
  }

  /**
   * Discover jobs via RSS/Atom feeds.
   */
  async _discoverViaRSS() {
    const boards = this._loadBoards();
    const companyUrls = [];

    for (const countryCode of Object.keys(boards)) {
      const country = boards[countryCode];
      if (country.boards) {
        for (const board of country.boards) {
          try {
            companyUrls.push(new URL(board.url).origin);
          } catch { /* skip */ }
        }
      }
    }

    const uniqueDomains = [...new Set(companyUrls)].slice(0, 500);
    const crawler = new RSSCrawler({ concurrency: this.concurrency });
    const entries = await crawler.discoverFeeds(uniqueDomains);

    return entries.filter(e => e.title && e.title.length > 5).map(e => ({
      title: e.title,
      url: e.url,
      company: SchemaExtractor.guessCompany(e.url),
      location: '',
      country: '',
      countryCode: '',
      source: `rss:${new URL(e.url).hostname}`,
      salary: null,
      remote: e.title?.toLowerCase().includes('remote'),
      confidence: 0.6,
    }));
  }

  /**
   * Add results to the master list with dedup.
   */
  async _addResults(results, sourceName) {
    let added = 0;
    for (const r of results) {
      if (this.allResults.length >= this.maxTotal) break;

      const key = r.url.split('?')[0];
      if (!this.seenUrls.has(key)) {
        this.seenUrls.add(key);
        this.allResults.push(r);
        added++;
      } else {
        this.stats.urlsDeduped++;
      }
    }

    this.stats.sourceBreakdown[sourceName] = (this.stats.sourceBreakdown[sourceName] || 0) + added;
    console.log(`   ✅ ${sourceName}: ${added} new jobs (total so far: ${this.allResults.length})`);
  }

  /**
   * Final dedup + scoring + country mapping.
   */
  _dedupAndScore() {
    const seen = new Map();
    const finalJobs = [];

    for (const job of this.allResults) {
      const key = job.url.split('?')[0].replace(/\/$/, '');

      if (seen.has(key)) {
        const existing = seen.get(key);
        // Keep the one with higher confidence or more info
        if ((job.confidence || 0) > (existing.confidence || 0)) {
          seen.set(key, {
            ...existing,
            ...job,
            // Don't overwrite known company with unknown
            company: existing.company || job.company,
          });
        }
        continue;
      }

      // Try to determine country from location if not set
      if (!job.countryCode && job.location) {
        const matchedCountry = this._detectCountryFromLocation(job.location);
        if (matchedCountry) {
          job.countryCode = matchedCountry.code;
          job.country = matchedCountry.name;
        }
      }

      // Score the job
      const score = this._scoreJob(job);
      seen.set(key, { ...job, score, source: job.source || 'unknown' });
      this.stats.urlsFound++;
    }

    // Track countries covered
    const countriesCovered = new Set();
    for (const job of seen.values()) {
      if (job.countryCode) countriesCovered.add(job.countryCode);
      finalJobs.push(job);
    }
    this.stats.countriesCovered = countriesCovered.size;

    // Sort by confidence (high quality first)
    return finalJobs.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Score a job for quality and relevance.
   */
  _scoreJob(job) {
    let score = 0;

    // Title quality
    if (job.title && job.title.length > 10) score += 15;
    if (job.title && job.title.length > 30) score += 5;

    // Has company name
    if (job.company && job.company.length > 1) score += 20;
    else score -= 10;

    // Has location
    if (job.location && job.location.length > 2) score += 15;

    // Has country
    if (job.country) score += 10;

    // Has salary info
    if (job.salary) score += 20;
    if (job.salary?.minValue) score += 10;

    // Has description
    if (job.description && job.description.length > 50) score += 15;

    // Schema.org confidence
    if (job.confidence) score += Math.round(job.confidence * 20);

    // Source quality
    const highQualitySources = ['greenhouse', 'lever', 'ashby', 'workday', 'linkedin', 'indeed'];
    if (highQualitySources.some(s => (job.source || '').includes(s))) score += 10;

    // Remote bonus
    if (job.remote) score += 5;

    return Math.min(score, 100);
  }

  /**
   * Detect country from a location string using keyword matching.
   */
  _detectCountryFromLocation(location) {
    const loc = location.toLowerCase();

    // Check country names and common city/region names
    for (const [code, info] of Object.entries(COUNTRIES)) {
      if (loc.includes(info.name.toLowerCase()) || loc.includes(code.toLowerCase())) {
        return { code, name: info.name };
      }
    }

    // Common city detection
    const cityCountryMap = {
      'london': 'GB', 'manchester': 'GB', 'birmingham': 'GB', 'edinburgh': 'GB',
      'paris': 'FR', 'lyon': 'FR', 'marseille': 'FR', 'toulouse': 'FR',
      'berlin': 'DE', 'munich': 'DE', 'hamburg': 'DE', 'frankfurt': 'DE', 'cologne': 'DE',
      'madrid': 'ES', 'barcelona': 'ES', 'valencia': 'ES', 'sevilla': 'ES',
      'rome': 'IT', 'milan': 'IT', 'turin': 'IT', 'florence': 'IT',
      'amsterdam': 'NL', 'rotterdam': 'NL', 'the hague': 'NL',
      'brussels': 'BE', 'antwerp': 'BE',
      'zurich': 'CH', 'geneva': 'CH', 'basel': 'CH',
      'vienna': 'AT', 'salzburg': 'AT',
      'stockholm': 'SE', 'gothenburg': 'SE', 'malmo': 'SE',
      'oslo': 'NO', 'bergen': 'NO',
      'copenhagen': 'DK', 'aarhus': 'DK',
      'helsinki': 'FI', 'espoo': 'FI',
      'warsaw': 'PL', 'krakow': 'PL', 'wroclaw': 'PL',
      'prague': 'CZ', 'brno': 'CZ',
      'budapest': 'HU', 'debrecen': 'HU',
      'bucharest': 'RO', 'cluj': 'RO', 'timisoara': 'RO',
      'dublin': 'IE', 'cork': 'IE',
      'lisbon': 'PT', 'porto': 'PT',
      'athens': 'GR', 'thessaloniki': 'GR',
      'istanbul': 'TR', 'ankara': 'TR', 'izmir': 'TR',
      'moscow': 'RU', 'st petersburg': 'RU', 'novosibirsk': 'RU',
      'kyiv': 'UA', 'lviv': 'UA', 'odessa': 'UA',
      'tokyo': 'JP', 'osaka': 'JP', 'yokohama': 'JP', 'nagoya': 'JP',
      'seoul': 'KR', 'busan': 'KR', 'incheon': 'KR',
      'beijing': 'CN', 'shanghai': 'CN', 'shenzhen': 'CN', 'guangzhou': 'CN',
      'mumbai': 'IN', 'delhi': 'IN', 'bangalore': 'IN', 'hyderabad': 'IN', 'pune': 'IN',
      'sydney': 'AU', 'melbourne': 'AU', 'brisbane': 'AU', 'perth': 'AU',
      'auckland': 'NZ', 'wellington': 'NZ', 'christchurch': 'NZ',
      'singapore': 'SG',
      'hong kong': 'HK',
      'taipei': 'TW', 'kaohsiung': 'TW',
      'bangkok': 'TH', 'phuket': 'TH', 'chiang mai': 'TH',
      'jakarta': 'ID', 'surabaya': 'ID', 'bandung': 'ID',
      'kuala lumpur': 'MY', 'penang': 'MY',
      'manila': 'PH', 'quezon city': 'PH', 'cebu': 'PH',
      'hanoi': 'VN', 'ho chi minh': 'VN', 'da nang': 'VN',
      'dubai': 'AE', 'abu dhabi': 'AE', 'sharjah': 'AE',
      'riyadh': 'SA', 'jeddah': 'SA', 'mecca': 'SA', 'medina': 'SA',
      'doha': 'QA',
      'kuwait city': 'KW',
      'manama': 'BH',
      'muscat': 'OM',
      'tel aviv': 'IL', 'jerusalem': 'IL', 'haifa': 'IL',
      'cairo': 'EG', 'alexandria': 'EG', 'giza': 'EG',
      'casablanca': 'MA', 'rabat': 'MA', 'marrakech': 'MA',
      'algiers': 'DZ', 'oran': 'DZ',
      'tunis': 'TN',
      'lagos': 'NG', 'abuja': 'NG',
      'nairobi': 'KE', 'mombasa': 'KE',
      'cape town': 'ZA', 'johannesburg': 'ZA', 'durban': 'ZA',
      'accra': 'GH',
      'dakar': 'SN',
      'addis ababa': 'ET',
      'são paulo': 'BR', 'rio de janeiro': 'BR', 'brasilia': 'BR', 'salvador': 'BR',
      'buenos aires': 'AR', 'cordoba': 'AR', 'rosario': 'AR',
      'santiago': 'CL', 'valparaiso': 'CL',
      'bogota': 'CO', 'medellin': 'CO', 'cali': 'CO',
      'lima': 'PE', 'cusco': 'PE',
      'quito': 'EC', 'guayaquil': 'EC',
      'caracas': 'VE', 'maracaibo': 'VE',
      'montevideo': 'UY',
      'asuncion': 'PY',
      'la paz': 'BO', 'santa cruz': 'BO',
      'toronto': 'CA', 'vancouver': 'CA', 'montreal': 'CA', 'calgary': 'CA',
      'new york': 'US', 'san francisco': 'US', 'los angeles': 'US', 'chicago': 'US',
      'mexico city': 'MX', 'guadalajara': 'MX', 'monterrey': 'MX',
    };

    for (const [city, code] of Object.entries(cityCountryMap)) {
      if (loc.includes(city)) {
        const info = COUNTRIES[code];
        if (info) return { code, name: info.name };
      }
    }

    return null;
  }

  /**
   * Load country boards from YAML config.
   */
  _loadBoards() {
    const configPath = join(ROOT, 'config/global/country-boards.yml');
    if (!existsSync(configPath)) return {};
    try {
      const raw = readFileSync(configPath, 'utf-8');
      return yaml.load(raw) || {};
    } catch (err) {
      console.warn(`   ⚠ Could not parse country-boards.yml: ${err.message}`);
      return {};
    }
  }

  /**
   * Get a summary of what this orchestrator can do.
   */
  getCapabilities() {
    const boards = this._loadBoards();
    const boardCount = Object.values(boards).reduce((sum, c) => sum + (c.boards?.length || 0), 0);
    const countryCount = Object.keys(boards).length;

    return {
      searchEngines: 11,
      searchEngineTLDs: Object.values(SEARCH_ENGINES || {}).reduce((sum, e) => sum + (e.tlds?.length || 0), 0),
      countries: countryCount,
      jobBoards: boardCount,
      proxyFingerprints: this.proxyRotator.fingerprints.length,
      maxRPM: this.proxyRotator.maxRequestsPerMinute,
      sitemapCrawlLimit: 100000,
    };
  }

  /**
   * Cleanup browser resources.
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export default GlobalOrchestrator;
