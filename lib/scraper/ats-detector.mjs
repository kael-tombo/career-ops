/**
 * lib/scraper/ats-detector.mjs — Universal ATS Platform Detector
 *
 * Detects which ATS (Applicant Tracking System) a job URL belongs to
 * by URL patterns, page content fingerprints, and HTML meta signatures.
 *
 * Supported: 30+ ATS platforms + generic fallback
 */

const ATS_SIGNATURES = [
  // ── URL-based detection (fast, no page load needed) ──────────────
  { name: 'greenhouse',  url: /greenhouse\.io/i,              strategy: 'api',    apiType: 'greenhouse' },
  { name: 'lever',       url: /lever\.co/i,                   strategy: 'api',    apiType: 'lever' },
  { name: 'ashby',       url: /ashbyhq\.com/i,                strategy: 'api',    apiType: 'ashby' },
  { name: 'workday',     url: /myworkdayjobs|wd5\.myworkday|workday\.com/i, strategy: 'browser', apiType: 'workday' },
  { name: 'workday',     url: /\.myworkdayjobs\.com/i,        strategy: 'browser', apiType: 'workday' },
  { name: 'taleo',       url: /taleo\.net|oracle\.com\/talento|oraclecloud\.com/i, strategy: 'browser', apiType: 'taleo' },
  { name: 'smartrecruiters', url: /smartrecruiters\.com/i,    strategy: 'browser', apiType: 'smartrecruiters' },
  { name: 'jobvite',     url: /jobvite\.com/i,               strategy: 'browser', apiType: 'jobvite' },
  { name: 'icims',       url: /icims\.com/i,                  strategy: 'browser', apiType: 'icims' },
  { name: 'successfactors', url: /successfactors|sap\.com\/careers/i, strategy: 'browser', apiType: 'successfactors' },
  { name: 'bamboohr',    url: /bamboohr\.com/i,               strategy: 'browser', apiType: 'bamboohr' },
  { name: 'jazzhr',      url: /jazzhr\.com/i,                 strategy: 'browser', apiType: 'jazzhr' },
  { name: 'paylocity',   url: /paylocity\.com/i,              strategy: 'browser', apiType: 'paylocity' },
  { name: 'ukg',         url: /ukg\.com|kronos\.net/i,        strategy: 'browser', apiType: 'ukg' },
  { name: 'adp',         url: /adp\.com\/careers/i,           strategy: 'browser', apiType: 'adp' },
  { name: 'comeet',      url: /comeet\.com/i,                 strategy: 'browser', apiType: 'comeet' },
  { name: 'recruitee',   url: /recruitee\.com/i,              strategy: 'browser', apiType: 'recruitee' },
  { name: 'breezy',      url: /breezy\.hr/i,                 strategy: 'browser', apiType: 'breezy' },
  { name: 'teamtailor',  url: /teamtailor\.com/i,             strategy: 'browser', apiType: 'teamtailor' },
  { name: 'pinpoint',    url: /pinpointhq\.com/i,             strategy: 'browser', apiType: 'pinpoint' },
  { name: 'applied',     url: /beapplied\.com/i,              strategy: 'browser', apiType: 'applied' },
  { name: 'linkedin',    url: /linkedin\.com\/jobs/i,         strategy: 'browser', apiType: 'linkedin' },
  { name: 'indeed',      url: /indeed\.com/i,                 strategy: 'browser', apiType: 'indeed' },
  { name: 'glassdoor',   url: /glassdoor\.com/i,              strategy: 'browser', apiType: 'glassdoor' },
  { name: 'ziprecruiter', url: /ziprecruiter\.com/i,          strategy: 'browser', apiType: 'ziprecruiter' },
  { name: 'monster',     url: /monster\.com/i,                strategy: 'browser', apiType: 'monster' },
  { name: 'simplyhired', url: /simplyhired\.com/i,            strategy: 'browser', apiType: 'simplyhired' },
  { name: 'careerbuilder', url: /careerbuilder\.com/i,        strategy: 'browser', apiType: 'careerbuilder' },
  { name: 'wellfound',   url: /wellfound\.com|angel\.co/i,    strategy: 'browser', apiType: 'wellfound' },
  { name: 'otta',        url: /otta\.com/i,                   strategy: 'browser', apiType: 'otta' },
  { name: 'getro',       url: /getro\.com/i,                  strategy: 'browser', apiType: 'getro' },
  { name: 'google',      url: /google\.com\/careers/i,        strategy: 'browser', apiType: 'google' },
];

// ── HTML/content-based fingerprints (need page fetch) ──────────────
const CONTENT_FINGERPRINTS = [
  { name: 'greenhouse',   check: (text) => text.includes('grnh.se') || /GREENHOUSE_TOKEN/i.test(text) || text.includes(' data-company-id=') && text.includes('grnhs-') },
  { name: 'lever',        check: (text) => text.includes('lever-job-id') || text.includes('lever-form') || /lever\.co\/auth/i.test(text) },
  { name: 'ashby',        check: (text) => text.includes('ashbyhq') || text.includes('ashby-form') || text.includes('ashby_job_posting') },
  { name: 'workday',      check: (text) => text.includes('workday') && (text.includes('jobPosting') || text.includes('wdContext')) },
  { name: 'taleo',        check: (text) => text.includes('taleo') && (text.includes('requisition') || text.includes('jobDetail')) },
  { name: 'smartrecruiters', check: (text) => text.includes('smartrecruiters') || text.includes('js-postings') },
  { name: 'jobvite',      check: (text) => text.includes('jobvite') || text.includes('jv-') || text.includes('jobId=') },
  { name: 'icims',        check: (text) => text.includes('icims') || text.includes('icims_') },
  { name: 'successfactors', check: (text) => text.includes('successfactors') || text.includes('bsp-external') },
  { name: 'bamboohr',     check: (text) => text.includes('bambooHR') || text.includes('bamboo') },
  { name: 'google',       check: (text) => text.includes('google careers') && text.includes('apply-button') },
];

// ── Generic job page patterns (no specific ATS detected) ──────────
const GENERIC_PATTERNS = [
  { pattern: /careers?|jobs?|positions?|vacancies?|opportunities?|join-?us|work-?with-?us/i, type: 'careers-page' },
  { pattern: /\/job\//i, type: 'job-page' },
  { pattern: /\/jobs\//i, type: 'job-page' },
  { pattern: /position/i, type: 'job-page' },
  { pattern: /requisition/i, type: 'job-page' },
  { pattern: /opening/i, type: 'job-page' },
];

/**
 * Detect ATS platform from a URL (fast, no page load).
 * @param {string} url
 * @returns {{ name: string, strategy: string, apiType: string } | null}
 */
export function detectFromUrl(url) {
  for (const sig of ATS_SIGNATURES) {
    if (sig.url.test(url)) return sig;
  }
  return null;
}

/**
 * Detect ATS from page HTML content.
 * @param {string} html - Page HTML content
 * @param {string} url - Original URL (for pattern matching)
 * @returns {{ name: string, strategy: string, apiType: string, confidence: number }}
 */
export function detectFromContent(html, url) {
  // First try URL (fast path)
  const urlMatch = detectFromUrl(url);
  if (urlMatch) return { ...urlMatch, confidence: 1.0 };

  // Try content fingerprints
  const text = html.toLowerCase();
  for (const fp of CONTENT_FINGERPRINTS) {
    if (fp.check(text)) {
      const sig = ATS_SIGNATURES.find(s => s.name === fp.name);
      return { name: fp.name, strategy: sig?.strategy || 'browser', apiType: sig?.apiType || fp.name, confidence: 0.8 };
    }
  }

  // Check generic job page patterns
  for (const gp of GENERIC_PATTERNS) {
    if (gp.pattern.test(url) || gp.pattern.test(text.slice(0, 500))) {
      return { name: 'generic', strategy: 'browser', apiType: gp.type, confidence: 0.4 };
    }
  }

  return { name: 'unknown', strategy: 'browser', apiType: 'unknown', confidence: 0.1 };
}

/**
 * Get scraping strategy recommendation based on ATS type.
 * @param {string} atsName
 * @returns {object} Strategy config
 */
export function getStrategy(atsName) {
  const strategies = {
    // API-based (fastest, structured data)
    greenhouse:     { driver: 'api',     endpoint: 'jobs',           parser: 'greenhouse', priority: 1 },
    lever:          { driver: 'api',     endpoint: 'postings',       parser: 'lever',      priority: 1 },
    ashby:          { driver: 'api',     endpoint: 'job-board',      parser: 'ashby',      priority: 1 },

    // Browser-based with known structure
    workday:        { driver: 'browser', selectors: 'workday',       parser: 'workday',    priority: 2 },
    smartrecruiters: { driver: 'browser', selectors: 'smartrecruiters', parser: 'generic',  priority: 2 },
    linkedin:       { driver: 'browser', selectors: 'linkedin',      parser: 'linkedin',   priority: 3 },
    indeed:         { driver: 'browser', selectors: 'indeed',        parser: 'indeed',     priority: 3 },
    google:         { driver: 'browser', selectors: 'google',        parser: 'generic',    priority: 2 },

    // Generic fallback
    generic:        { driver: 'browser', selectors: 'generic',       parser: 'generic',    priority: 5 },
    unknown:        { driver: 'browser', selectors: 'generic',       parser: 'generic',    priority: 9 },
  };

  return strategies[atsName] || strategies.unknown;
}

/**
 * List all supported ATS platforms.
 * @returns {string[]}
 */
export function listSupported() {
  return [...new Set(ATS_SIGNATURES.map(s => s.name))];
}

export default {
  detectFromUrl,
  detectFromContent,
  getStrategy,
  listSupported,
};
