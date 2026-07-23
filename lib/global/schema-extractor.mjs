/**
 * lib/global/schema-extractor.mjs — Schema.org JobPosting Extractor
 *
 * Extracts structured job postings from ANY web page by:
 *   1. Parsing JSON-LD script tags (LinkedIn, Indeed, Google for Jobs)
 *   2. Parsing microdata (Schema.org HTML attributes)
 *   3. Parsing RDFa
 *   4. Secondary: Open Graph + meta tags + page title/domain heuristics
 *
 * Handles: JobPosting, Organization, Place, MonetaryAmount, QuantitativeValue
 * Skips: non-job pages, duplicate detection, minimal confidence scoring
 */

export class SchemaExtractor {
  /**
   * Extract job postings from page HTML content.
   * @param {string} html - Full page HTML
   * @param {string} url - The page URL (for fallback extraction)
   * @returns {Array<{title, company, location, description, url, datePosted, validThrough, employmentType, salary, remote, skills, confidence}>}
   */
  static extract(html, url) {
    const results = [];

    // Phase 1: JSON-LD (most common, highest quality)
    try {
      const jsonld = SchemaExtractor.parseJSONLD(html);
      for (const item of jsonld) {
        const parsed = SchemaExtractor.normalizeJobPosting(item, url);
        if (parsed) results.push(parsed);
      }
    } catch { /* silent */ }

    // Phase 2: Microdata
    try {
      const microdata = SchemaExtractor.parseMicrodata(html);
      for (const item of microdata) {
        const parsed = SchemaExtractor.normalizeJobPosting(item, url);
        if (parsed) results.push(parsed);
      }
    } catch { /* silent */ }

    // Phase 3: Meta/heuristic fallback
    if (results.length === 0) {
      const fallback = SchemaExtractor.heuristicExtract(html, url);
      if (fallback) results.push(fallback);
    }

    return results;
  }

  /**
   * Parse JSON-LD script tags from HTML.
   */
  static parseJSONLD(html) {
    const items = [];
    const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1].trim());
        const normalized = Array.isArray(data) ? data : [data];
        for (const item of normalized) {
          if (item['@type'] === 'JobPosting' || item['@type']?.includes?.('JobPosting')) {
            items.push(item);
          }
          // Check @graph array
          if (item['@graph']) {
            for (const g of item['@graph']) {
              if (g['@type'] === 'JobPosting' || g['@type']?.includes?.('JobPosting')) {
                items.push(g);
              }
            }
          }
          // Check itemListElement
          if (item['@type'] === 'ItemList' && item.itemListElement) {
            for (const el of item.itemListElement) {
              const job = typeof el === 'object' ? (el.item || el) : null;
              if (job && (job['@type'] === 'JobPosting' || job['@type']?.includes?.('JobPosting'))) {
                items.push(job);
              }
            }
          }
        }
      } catch { /* skip invalid JSON */ }
    }
    return items;
  }

  /**
   * Parse microdata from HTML (itemscope, itemtype, itemprop).
   * Simplified — converts to a flat JSON structure.
   */
  static parseMicrodata(html) {
    const items = [];

    // Find JobPosting microdata blocks
    const blockRegex = /<[^>]+itemscope[^>]*itemtype="https?:\/\/schema\.org\/JobPosting"[^>]*>([\s\S]*?)<\/[^>]+>/gi;
    let match;

    while ((match = blockRegex.exec(html)) !== null) {
      const block = match[1];
      const job = { '@type': 'JobPosting' };

      // Extract itemprop values
      const propRegex = /itemprop="([^"]+)"[^>]*>(?:<[^>]*>)*([^<]+)/gi;
      let pm;
      while ((pm = propRegex.exec(block)) !== null) {
        job[pm[1]] = pm[2].trim();
      }

      items.push(job);
    }

    return items;
  }

  /**
   * Normalize a parsed JobPosting to a consistent format.
   * @param {object} raw - Raw JSON-LD/microdata job posting
   * @param {string} pageUrl - Page URL
   * @returns {object|null}
   */
  static normalizeJobPosting(raw, pageUrl) {
    try {
      const title = SchemaExtractor.getText(raw, 'title');
      if (!title || title.length < 3) return null;

      // Extract company name
      let company = SchemaExtractor.getText(raw, 'hiringOrganization');
      if (!company && raw.hiringOrganization) {
        company = raw.hiringOrganization.name ||
          raw.hiringOrganization['@type']?.includes?.('Organization') ? '' : '';
      }

      // Extract location
      let location = '';
      const loc = raw.jobLocation;
      if (loc) {
        if (typeof loc === 'string') {
          location = loc;
        } else if (Array.isArray(loc)) {
          location = loc.map(l => SchemaExtractor.formatLocation(l)).join(', ');
        } else {
          location = SchemaExtractor.formatLocation(loc);
        }
      }

      // Extract salary
      let salary = null;
      const baseSalary = raw.baseSalary || raw.salary;
      if (baseSalary) {
        salary = SchemaExtractor.formatSalary(baseSalary);
      }

      // Extract description (strip HTML)
      let description = SchemaExtractor.getText(raw, 'description') ||
        SchemaExtractor.getText(raw, 'responsibilities');
      if (description) {
        description = description.replace(/<[^>]*>/g, '').trim();
      }

      // Remote
      let remote = null;
      if (raw.jobLocationType) {
        remote = raw.jobLocationType.includes('Remote') ||
          raw.jobLocationType.includes('TELECOMMUTE');
      }

      // Skills
      let skills = [];
      if (raw.skills) {
        skills = typeof raw.skills === 'string'
          ? raw.skills.split(',').map(s => s.trim())
          : (Array.isArray(raw.skills) ? raw.skills : []);
      }

      const confidence = SchemaExtractor.calculateConfidence(raw);

      return {
        title,
        company: company || SchemaExtractor.guessCompany(pageUrl),
        location: location || '',
        description: description?.substring(0, 2000) || '',
        url: raw.url || pageUrl,
        datePosted: raw.datePosted || null,
        validThrough: raw.validThrough || null,
        employmentType: raw.employmentType || null,
        salary,
        remote,
        skills,
        confidence,
        industry: raw.industry || null,
        workHours: raw.workHours || null,
        educationRequirements: raw.educationRequirements || null,
        experienceRequirements: raw.experienceRequirements || null,
        qualifications: raw.qualifications || null,
        benefits: raw.benefits || null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get text value from various Schema.org field formats.
   */
  static getText(obj, field) {
    const val = obj[field];
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (val.name) return val.name;
    if (val['@value']) return val['@value'];
    if (val.description) return val.description;
    return null;
  }

  /**
   * Format a Place/PostalAddress into a readable location string.
   */
  static formatLocation(loc) {
    if (!loc) return '';
    if (typeof loc === 'string') return loc;

    const parts = [];
    if (loc.address) {
      const addr = loc.address;
      if (typeof addr === 'string') return addr;
      parts.push(addr.addressLocality || addr.addressRegion || addr.addressCountry || '');
      if (addr.addressRegion && addr.addressLocality) {
        // already included
      } else if (addr.addressRegion) {
        parts.push(addr.addressRegion);
      }
      if (addr.addressCountry) {
        if (typeof addr.addressCountry === 'object') {
          parts.push(addr.addressCountry.name || addr.addressCountry.alternateName || '');
        } else {
          parts.push(addr.addressCountry);
        }
      }
    }
    if (loc.name) parts.push(loc.name);
    return parts.filter(Boolean).join(', ');
  }

  /**
   * Format salary information.
   */
  static formatSalary(salary) {
    try {
      let currency = salary.currency || 'USD';
      let minValue, maxValue, unitText;

      if (salary.value) {
        const v = salary.value;
        if (typeof v === 'object') {
          minValue = v.minValue || v.minValue || null;
          maxValue = v.maxValue || v.maxValue || null;
          unitText = v.unitText || salary.unitText || null;
        } else if (typeof v === 'string') {
          const parsed = parseFloat(v.replace(/[^0-9.]/g, ''));
          minValue = maxValue = isNaN(parsed) ? null : parsed;
        } else if (typeof v === 'number') {
          minValue = maxValue = v;
        }
      }

      if (!minValue && !maxValue) return null;

      if (!unitText) {
        unitText = salary.unitText || salary['@type'] === 'MonetaryAmount' ? 'YEAR' : null;
      }

      return {
        currency,
        minValue,
        maxValue,
        unitText: unitText?.toUpperCase() || 'YEAR',
        text: salary.text || null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Calculate confidence score based on available fields.
   */
  static calculateConfidence(raw) {
    let score = 0;
    const fields = ['title', 'description', 'hiringOrganization', 'datePosted',
      'employmentType', 'baseSalary', 'jobLocation', 'skills', 'validThrough',
      'industry', 'qualifications', 'benefits'];

    for (const f of fields) {
      if (raw[f]) score += 1;
    }

    // Bonus for structured location
    if (raw.jobLocation && typeof raw.jobLocation === 'object') {
      if (raw.jobLocation.address) score += 1;
    }

    // Bonus for salary detail
    if (raw.baseSalary?.value) score += 1;

    return Math.min(score / fields.length, 1.0);
  }

  /**
   * Guess company name from URL domain.
   */
  static guessCompany(url) {
    try {
      const hostname = new URL(url).hostname
        .replace('www.', '')
        .replace('careers.', '')
        .replace('jobs.', '')
        .replace('boards.', '')
        .replace('app.', '');
      const parts = hostname.split('.');
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    } catch {
      return '';
    }
  }

  /**
   * Fallback extraction using meta tags, Open Graph, and page heuristics.
   */
  static heuristicExtract(html, url) {
    const title = SchemaExtractor.extractMeta(html, 'og:title') ||
      SchemaExtractor.extractMeta(html, 'twitter:title') ||
      SchemaExtractor.extractTag(html, 'title');

    if (!title || title.length < 3) return null;

    const ogType = SchemaExtractor.extractMeta(html, 'og:type');
    if (ogType && !ogType.includes('job') && !ogType.includes('article')) {
      return null;
    }

    const description = SchemaExtractor.extractMeta(html, 'og:description') ||
      SchemaExtractor.extractMeta(html, 'description');

    return {
      title: title.trim(),
      company: SchemaExtractor.extractMeta(html, 'og:site_name') ||
        SchemaExtractor.guessCompany(url),
      location: SchemaExtractor.extractMeta(html, 'job:location') || '',
      description: description?.replace(/<[^>]*>/g, '').substring(0, 2000) || '',
      url,
      datePosted: SchemaExtractor.extractMeta(html, 'article:published_time') || null,
      validThrough: null,
      employmentType: null,
      salary: null,
      remote: title.toLowerCase().includes('remote'),
      skills: [],
      confidence: 0.2,
    };
  }

  /**
   * Extract meta tag content by property or name.
   */
  static extractMeta(html, property) {
    const regex = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]+content=["']([^"']*)["']`,
      'i'
    );
    const match = regex.exec(html);
    if (match) return match[1];

    // Reversed order (content before property)
    const regex2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
      'i'
    );
    const match2 = regex2.exec(html);
    return match2 ? match2[1] : null;
  }

  /**
   * Extract <title> tag content.
   */
  static extractTag(html, tag) {
    const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i');
    const match = regex.exec(html);
    return match ? match[1].trim() : null;
  }

  /**
   * Count unique pages with Schema.org JobPosting markup in a set of URLs.
   * Useful for coverage reporting.
   */
  static countJobPages(htmls) {
    let count = 0;
    for (const html of htmls) {
      try {
        const jsonld = SchemaExtractor.parseJSONLD(html);
        if (jsonld.length > 0) { count++; continue; }
        const microdata = SchemaExtractor.parseMicrodata(html);
        if (microdata.length > 0) { count++; continue; }
        const ogType = SchemaExtractor.extractMeta(html, 'og:type');
        if (ogType?.includes('job') || ogType?.includes('article')) { count++; }
      } catch { /* skip */ }
    }
    return count;
  }
}

export default SchemaExtractor;
