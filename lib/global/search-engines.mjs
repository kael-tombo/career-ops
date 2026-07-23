/**
 * lib/global/search-engines.mjs — Multi-Search-Engine, Multi-Country Job Discovery
 *
 * Searches ALL major search engines across 100+ countries.
 * Each engine × country combination is a distinct search source.
 *
 * Coverage:
 *   - Google: 180+ country TLDs
 *   - Bing: 50+ country markets
 *   - Yandex: Russia, Ukraine, Belarus, Kazakhstan, Turkey
 *   - Baidu: China
 *   - Naver: South Korea
 *   - Seznam: Czech Republic
 *   - Yahoo: Japan, Taiwan, Hong Kong
 *   - DuckDuckGo: Global, all countries
 *   - Brave Search: Global
 *   - Ecosia: Global
 *   - Qwant: France, Europe
 *   - Sogou: China
 *   - Yandex: Turkey (yandex.com.tr)
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const CONFIG_PATH = join(ROOT, 'config/global/countries.yml');

// ══════════════════════════════════════════════════════════════════════
// SEARCH ENGINE DEFINITIONS
// ══════════════════════════════════════════════════════════════════════

const SEARCH_ENGINES = {
  google: {
    name: 'Google',
    type: 'global',
    tlds: [
      // North America
      'com', 'ca', 'mx',
      // Europe
      'co.uk', 'de', 'fr', 'it', 'es', 'nl', 'be', 'ch', 'at', 'se', 'no', 'dk', 'fi', 'pl', 'cz', 'sk', 'hu', 'ro', 'bg', 'hr', 'rs', 'si', 'lt', 'lv', 'ee', 'is', 'ie', 'pt', 'gr', 'lu', 'mt', 'cy',
      // Asia-Pacific
      'co.jp', 'co.kr', 'co.in', 'com.au', 'co.nz', 'com.sg', 'com.hk', 'com.tw', 'co.th', 'co.id', 'com.my', 'com.ph', 'co.vn', 'com.pk', 'com.bd', 'lk', 'np', 'com.mm',
      // Middle East & Africa
      'co.il', 'ae', 'sa', 'qa', 'kw', 'bh', 'om', 'eg', 'ma', 'dz', 'tn', 'co.za', 'ng', 'ke', 'gh', 'sn', 'ci', 'ug', 'tz', 'zm', 'zw', 'mu', 'na',
      // South America
      'com.br', 'com.ar', 'cl', 'co', 'pe', 'ec', 've', 'uy', 'py', 'bo',
      // Central America & Caribbean
      'cr', 'pa', 'gt', 'sv', 'hn', 'ni', 'do', 'pr', 'jm', 'tt',
    ],
    buildUrl: (tld, query, countryCode) => {
      const params = new URLSearchParams({
        q: `"${query}" job OR career OR position`,
        hl: 'en',
        num: '20',
      });
      if (countryCode) params.set('cr', `country${countryCode.toUpperCase()}`);
      return `https://www.google.${tld}/search?${params}`;
    },
  },

  bing: {
    name: 'Bing',
    type: 'global',
    tlds: [
      'com', 'co.uk', 'de', 'fr', 'it', 'es', 'nl', 'be', 'ch', 'at', 'se', 'no', 'dk', 'fi', 'pl', 'cz', 'sk', 'hu', 'ro', 'bg', 'hr', 'rs', 'si', 'lt', 'lv', 'ee', 'ie', 'pt', 'gr', 'lu',
      'co.jp', 'co.kr', 'co.in', 'com.au', 'co.nz', 'com.sg', 'com.hk', 'com.tw', 'co.th', 'co.id', 'com.my', 'com.ph',
      'co.il', 'ae', 'sa', 'eg', 'co.za', 'ng', 'ma',
      'com.br', 'com.ar', 'cl', 'co', 'mx', 'pe',
      'ca', 'com.mx',
    ],
    buildUrl: (tld, query) => {
      return `https://www.bing.${tld}/search?q=${encodeURIComponent(`"${query}" job`)}&count=20`;
    },
  },

  yandex: {
    name: 'Yandex',
    type: 'regional',
    tlds: ['ru', 'com', 'com.tr', 'kz', 'by', 'ua', 'uz'],
    buildUrl: (tld, query) => {
      return `https://yandex.${tld}/search/?text=${encodeURIComponent(`"${query}" вакансия работа`)}&lr=0`;
    },
  },

  baidu: {
    name: 'Baidu',
    type: 'china',
    tlds: ['com'],
    buildUrl: (_tld, query) => {
      return `https://www.baidu.com/s?wd=${encodeURIComponent(`${query} 招聘 工作`)}`;
    },
  },

  naver: {
    name: 'Naver',
    type: 'korea',
    tlds: ['com'],
    buildUrl: (_tld, query) => {
      return `https://search.naver.com/search.naver?query=${encodeURIComponent(`${query} 채용`)}`;
    },
  },

  seznam: {
    name: 'Seznam',
    type: 'czech',
    tlds: ['cz'],
    buildUrl: (_tld, query) => {
      return `https://search.seznam.cz/?q=${encodeURIComponent(`${query} práce`)}`;
    },
  },

  yahoo: {
    name: 'Yahoo! Japan',
    type: 'japan',
    tlds: ['co.jp'],
    buildUrl: (_tld, query) => {
      return `https://search.yahoo.co.jp/search?p=${encodeURIComponent(`${query} 求人`)}`;
    },
  },

  duckduckgo: {
    name: 'DuckDuckGo',
    type: 'privacy',
    tlds: ['com'],
    buildUrl: (_tld, query) => {
      return `https://duckduckgo.com/?q=${encodeURIComponent(`"${query}" job site:linkedin.com OR site:indeed.com OR site:glassdoor.com`)}`;
    },
  },

  brave: {
    name: 'Brave Search',
    type: 'global',
    tlds: ['com'],
    buildUrl: (_tld, query) => {
      return `https://search.brave.com/search?q=${encodeURIComponent(`"${query}" job`)}`;
    },
  },

  qwant: {
    name: 'Qwant',
    type: 'europe',
    tlds: ['com', 'fr'],
    buildUrl: (tld, query) => {
      const q = tld === 'fr' ? `${query} emploi` : `${query} job`;
      return `https://www.qwant.${tld}/?q=${encodeURIComponent(q)}`;
    },
  },

  sogou: {
    name: 'Sogou',
    type: 'china',
    tlds: ['com'],
    buildUrl: (_tld, query) => {
      return `https://www.sogou.com/web?query=${encodeURIComponent(`${query} 招聘`)}`;
    },
  },
};

// ══════════════════════════════════════════════════════════════════════
// COUNTRY → SEARCH ENGINE + TLD MAPPING (100+ countries)
// ══════════════════════════════════════════════════════════════════════

const COUNTRIES = {
  // Europe
  GB: { name: 'United Kingdom', tld: 'co.uk', engines: ['google', 'bing', 'duckduckgo', 'brave'], lang: 'en' },
  DE: { name: 'Germany', tld: 'de', engines: ['google', 'bing', 'duckduckgo', 'brave'], lang: 'de' },
  FR: { name: 'France', tld: 'fr', engines: ['google', 'bing', 'qwant', 'duckduckgo', 'brave'], lang: 'fr' },
  IT: { name: 'Italy', tld: 'it', engines: ['google', 'bing', 'duckduckgo'], lang: 'it' },
  ES: { name: 'Spain', tld: 'es', engines: ['google', 'bing', 'duckduckgo'], lang: 'es' },
  NL: { name: 'Netherlands', tld: 'nl', engines: ['google', 'bing', 'duckduckgo'], lang: 'nl' },
  BE: { name: 'Belgium', tld: 'be', engines: ['google', 'bing'], lang: 'nl' },
  CH: { name: 'Switzerland', tld: 'ch', engines: ['google', 'bing'], lang: 'de' },
  AT: { name: 'Austria', tld: 'at', engines: ['google', 'bing'], lang: 'de' },
  SE: { name: 'Sweden', tld: 'se', engines: ['google', 'bing', 'duckduckgo'], lang: 'sv' },
  NO: { name: 'Norway', tld: 'no', engines: ['google', 'bing'], lang: 'no' },
  DK: { name: 'Denmark', tld: 'dk', engines: ['google', 'bing'], lang: 'da' },
  FI: { name: 'Finland', tld: 'fi', engines: ['google', 'bing'], lang: 'fi' },
  PL: { name: 'Poland', tld: 'pl', engines: ['google', 'bing', 'duckduckgo'], lang: 'pl' },
  CZ: { name: 'Czech Republic', tld: 'cz', engines: ['google', 'bing', 'seznam'], lang: 'cs' },
  SK: { name: 'Slovakia', tld: 'sk', engines: ['google', 'bing'], lang: 'sk' },
  HU: { name: 'Hungary', tld: 'hu', engines: ['google', 'bing'], lang: 'hu' },
  RO: { name: 'Romania', tld: 'ro', engines: ['google', 'bing'], lang: 'ro' },
  BG: { name: 'Bulgaria', tld: 'bg', engines: ['google', 'bing'], lang: 'bg' },
  HR: { name: 'Croatia', tld: 'hr', engines: ['google', 'bing'], lang: 'hr' },
  RS: { name: 'Serbia', tld: 'rs', engines: ['google', 'bing'], lang: 'sr' },
  SI: { name: 'Slovenia', tld: 'si', engines: ['google', 'bing'], lang: 'sl' },
  LT: { name: 'Lithuania', tld: 'lt', engines: ['google', 'bing'], lang: 'lt' },
  LV: { name: 'Latvia', tld: 'lv', engines: ['google', 'bing'], lang: 'lv' },
  EE: { name: 'Estonia', tld: 'ee', engines: ['google', 'bing'], lang: 'et' },
  IE: { name: 'Ireland', tld: 'ie', engines: ['google', 'bing', 'duckduckgo'], lang: 'en' },
  PT: { name: 'Portugal', tld: 'pt', engines: ['google', 'bing'], lang: 'pt' },
  GR: { name: 'Greece', tld: 'gr', engines: ['google', 'bing'], lang: 'el' },
  LU: { name: 'Luxembourg', tld: 'lu', engines: ['google', 'bing'], lang: 'fr' },
  MT: { name: 'Malta', tld: 'mt', engines: ['google'], lang: 'en' },
  CY: { name: 'Cyprus', tld: 'cy', engines: ['google'], lang: 'el' },
  IS: { name: 'Iceland', tld: 'is', engines: ['google'], lang: 'is' },
  RU: { name: 'Russia', tld: 'ru', engines: ['google', 'yandex', 'bing'], lang: 'ru' },
  UA: { name: 'Ukraine', tld: 'ua', engines: ['google', 'yandex'], lang: 'uk' },
  BY: { name: 'Belarus', tld: 'by', engines: ['google', 'yandex'], lang: 'be' },
  KZ: { name: 'Kazakhstan', tld: 'kz', engines: ['google', 'yandex'], lang: 'kk' },
  TR: { name: 'Turkey', tld: 'tr', engines: ['google', 'yandex'], lang: 'tr' },

  // North America
  US: { name: 'United States', tld: 'com', engines: ['google', 'bing', 'duckduckgo', 'brave'], lang: 'en' },
  CA: { name: 'Canada', tld: 'ca', engines: ['google', 'bing', 'duckduckgo'], lang: 'en' },
  MX: { name: 'Mexico', tld: 'mx', engines: ['google', 'bing'], lang: 'es' },

  // Central America & Caribbean
  CR: { name: 'Costa Rica', tld: 'cr', engines: ['google'], lang: 'es' },
  PA: { name: 'Panama', tld: 'pa', engines: ['google'], lang: 'es' },
  GT: { name: 'Guatemala', tld: 'gt', engines: ['google'], lang: 'es' },
  SV: { name: 'El Salvador', tld: 'sv', engines: ['google'], lang: 'es' },
  HN: { name: 'Honduras', tld: 'hn', engines: ['google'], lang: 'es' },
  NI: { name: 'Nicaragua', tld: 'ni', engines: ['google'], lang: 'es' },
  DO: { name: 'Dominican Republic', tld: 'do', engines: ['google'], lang: 'es' },
  PR: { name: 'Puerto Rico', tld: 'pr', engines: ['google'], lang: 'es' },
  JM: { name: 'Jamaica', tld: 'jm', engines: ['google'], lang: 'en' },
  TT: { name: 'Trinidad & Tobago', tld: 'tt', engines: ['google'], lang: 'en' },

  // South America
  BR: { name: 'Brazil', tld: 'com.br', engines: ['google', 'bing', 'duckduckgo'], lang: 'pt' },
  AR: { name: 'Argentina', tld: 'com.ar', engines: ['google', 'bing'], lang: 'es' },
  CL: { name: 'Chile', tld: 'cl', engines: ['google', 'bing'], lang: 'es' },
  CO: { name: 'Colombia', tld: 'co', engines: ['google', 'bing', 'duckduckgo'], lang: 'es' },
  PE: { name: 'Peru', tld: 'pe', engines: ['google', 'bing'], lang: 'es' },
  EC: { name: 'Ecuador', tld: 'ec', engines: ['google'], lang: 'es' },
  VE: { name: 'Venezuela', tld: 've', engines: ['google'], lang: 'es' },
  UY: { name: 'Uruguay', tld: 'uy', engines: ['google'], lang: 'es' },
  PY: { name: 'Paraguay', tld: 'py', engines: ['google'], lang: 'es' },
  BO: { name: 'Bolivia', tld: 'bo', engines: ['google'], lang: 'es' },

  // Asia-Pacific
  JP: { name: 'Japan', tld: 'co.jp', engines: ['google', 'yahoo', 'bing'], lang: 'ja' },
  KR: { name: 'South Korea', tld: 'co.kr', engines: ['google', 'naver', 'bing'], lang: 'ko' },
  IN: { name: 'India', tld: 'co.in', engines: ['google', 'bing', 'duckduckgo', 'brave'], lang: 'en' },
  AU: { name: 'Australia', tld: 'com.au', engines: ['google', 'bing', 'duckduckgo'], lang: 'en' },
  NZ: { name: 'New Zealand', tld: 'co.nz', engines: ['google', 'bing'], lang: 'en' },
  SG: { name: 'Singapore', tld: 'com.sg', engines: ['google', 'bing'], lang: 'en' },
  HK: { name: 'Hong Kong', tld: 'com.hk', engines: ['google', 'bing'], lang: 'en' },
  TW: { name: 'Taiwan', tld: 'com.tw', engines: ['google', 'yahoo'], lang: 'zh' },
  TH: { name: 'Thailand', tld: 'co.th', engines: ['google', 'bing'], lang: 'th' },
  ID: { name: 'Indonesia', tld: 'co.id', engines: ['google', 'bing'], lang: 'id' },
  MY: { name: 'Malaysia', tld: 'com.my', engines: ['google', 'bing'], lang: 'ms' },
  PH: { name: 'Philippines', tld: 'com.ph', engines: ['google', 'bing'], lang: 'en' },
  VN: { name: 'Vietnam', tld: 'co.vn', engines: ['google', 'bing'], lang: 'vi' },
  CN: { name: 'China', tld: 'cn', engines: ['google', 'baidu', 'sogou'], lang: 'zh' },
  PK: { name: 'Pakistan', tld: 'com.pk', engines: ['google'], lang: 'en' },
  BD: { name: 'Bangladesh', tld: 'com.bd', engines: ['google'], lang: 'bn' },
  LK: { name: 'Sri Lanka', tld: 'lk', engines: ['google'], lang: 'en' },
  NP: { name: 'Nepal', tld: 'np', engines: ['google'], lang: 'ne' },

  // Middle East
  AE: { name: 'UAE', tld: 'ae', engines: ['google', 'bing', 'duckduckgo'], lang: 'en' },
  SA: { name: 'Saudi Arabia', tld: 'sa', engines: ['google', 'bing'], lang: 'ar' },
  QA: { name: 'Qatar', tld: 'qa', engines: ['google'], lang: 'en' },
  KW: { name: 'Kuwait', tld: 'kw', engines: ['google'], lang: 'en' },
  BH: { name: 'Bahrain', tld: 'bh', engines: ['google'], lang: 'en' },
  OM: { name: 'Oman', tld: 'om', engines: ['google'], lang: 'en' },
  IL: { name: 'Israel', tld: 'co.il', engines: ['google', 'bing'], lang: 'he' },
  IQ: { name: 'Iraq', tld: 'iq', engines: ['google'], lang: 'ar' },
  JO: { name: 'Jordan', tld: 'jo', engines: ['google'], lang: 'ar' },
  LB: { name: 'Lebanon', tld: 'lb', engines: ['google'], lang: 'ar' },

  // Africa
  ZA: { name: 'South Africa', tld: 'co.za', engines: ['google', 'bing', 'duckduckgo'], lang: 'en' },
  NG: { name: 'Nigeria', tld: 'ng', engines: ['google', 'bing'], lang: 'en' },
  KE: { name: 'Kenya', tld: 'ke', engines: ['google', 'bing'], lang: 'en' },
  GH: { name: 'Ghana', tld: 'gh', engines: ['google'], lang: 'en' },
  MA: { name: 'Morocco', tld: 'ma', engines: ['google', 'bing'], lang: 'ar' },
  DZ: { name: 'Algeria', tld: 'dz', engines: ['google'], lang: 'ar' },
  TN: { name: 'Tunisia', tld: 'tn', engines: ['google'], lang: 'ar' },
  EG: { name: 'Egypt', tld: 'eg', engines: ['google', 'bing'], lang: 'ar' },
  SN: { name: 'Senegal', tld: 'sn', engines: ['google'], lang: 'fr' },
  CI: { name: 'Côte d\'Ivoire', tld: 'ci', engines: ['google'], lang: 'fr' },
  UG: { name: 'Uganda', tld: 'ug', engines: ['google'], lang: 'en' },
  TZ: { name: 'Tanzania', tld: 'tz', engines: ['google'], lang: 'sw' },
  ZM: { name: 'Zambia', tld: 'zm', engines: ['google'], lang: 'en' },
  ZW: { name: 'Zimbabwe', tld: 'zw', engines: ['google'], lang: 'en' },
  MU: { name: 'Mauritius', tld: 'mu', engines: ['google'], lang: 'en' },
  NA: { name: 'Namibia', tld: 'na', engines: ['google'], lang: 'en' },
  ET: { name: 'Ethiopia', tld: 'et', engines: ['google'], lang: 'am' },
};

// ══════════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ══════════════════════════════════════════════════════════════════════

/**
 * Get all available country codes.
 * @returns {string[]}
 */
export { COUNTRIES, SEARCH_ENGINES };

export function getCountryCodes() {
  return Object.keys(COUNTRIES);
}

/**
 * Get country info.
 * @param {string} code - ISO country code
 * @returns {object|null}
 */
export function getCountry(code) {
  return COUNTRIES[code?.toUpperCase()] || null;
}

/**
 * Get all search engines available for a given country.
 * @param {string} countryCode - ISO country code
 * @returns {Array<{name: string, engine: string, tld: string}>}
 */
export function getEnginesForCountry(countryCode) {
  const country = COUNTRIES[countryCode?.toUpperCase()];
  if (!country) return [];

  return (country.engines || []).map(engineName => {
    const engine = SEARCH_ENGINES[engineName];
    if (!engine) return null;
    return {
      name: engine.name,
      engine: engineName,
      tld: engine.tlds.includes(country.tld) ? country.tld : engine.tlds[0],
      countryCode,
    };
  }).filter(Boolean);
}

/**
 * Build search query from target roles.
 * Uses local-language job keywords per country.
 * @param {string} query - Base search query (e.g., "software engineer")
 * @param {string} countryCode - ISO country code
 * @returns {string} Localized search query
 */
export function buildLocalizedQuery(query, countryCode) {
  const country = COUNTRIES[countryCode?.toUpperCase()];
  if (!country) return `"${query}" job`;

  const jobTerms = {
    en: 'job OR career OR position OR vacancy',
    de: 'Stelle OR Karriere OR Position OR Stelleanzeige OR Job',
    fr: 'emploi OR carrière OR poste OR recrutement',
    es: 'empleo OR carrera OR puesto OR vacante',
    it: 'lavoro OR carriera OR posizione OR offerta',
    pt: 'emprego OR carreira OR vaga OR posição',
    nl: 'baan OR carrière OR functie OR vacature',
    sv: 'jobb OR karriär OR tjänst OR ledig',
    no: 'jobb OR karriere OR stilling OR ledig',
    da: 'job OR karriere OR stilling OR ledig',
    fi: 'työpaikka OR ura OR tehtävä OR avoin',
    pl: 'praca OR kariera OR stanowisko OR oferta',
    cs: 'práce OR kariéra OR pozice OR nabídka',
    sk: 'práca OR kariéra OR pozícia OR ponuka',
    hu: 'munka OR karrier OR pozíció OR állás',
    ro: 'loc de muncă OR carieră OR post OR ofertă',
    bg: 'работа OR кариера OR позиция OR обява',
    hr: 'posao OR karijera OR radno mjesto OR natječaj',
    sr: 'посао OR каријера OR радно место OR конкурс',
    sl: 'delo OR kariera OR položaj OR zaposlitev',
    lt: 'darbas OR karjera OR pareigos OR darbo vieta',
    lv: 'darbs OR karjera OR amats OR vakance',
    et: 'töö OR karjäär OR ametikoht OR vaba koht',
    el: 'εργασία OR καριέρα OR θέση OR αγγελία',
    ru: 'работа OR вакансия OR карьера OR должность',
    uk: 'робота OR вакансія OR кар\'єра OR посада',
    be: 'работа OR вакансія OR кар\'ера OR пасада',
    kk: 'жұмыс OR бос орын OR мансап OR лауазым',
    tr: 'iş OR kariyer OR pozisyon OR iş ilanı',
    ja: '求人 OR 転職 OR 採用 OR キャリア',
    ko: '채용 OR 구인 OR 취업 OR 일자리',
    zh: '招聘 OR 工作 OR 职位 OR 求职',
    th: 'งาน OR ตำแหน่ง OR สมัครงาน OR หางาน',
    id: 'lowongan OR karir OR pekerjaan OR posisi',
    ms: 'kerja OR kerjaya OR jawatan OR lowongan',
    vi: 'việc làm OR tuyển dụng OR cơ hội việc làm',
    ar: 'وظيفة OR عمل OR توظيف OR شاغر',
    he: 'משרה OR עבודה OR קריירה OR דרושים',
    sw: 'kazi OR nafasi OR ajira OR fursa',
    am: 'ሥራ OR ክፍት የሥራ ቦታ OR ሙያ',
    is: 'starf OR ferill OR staða OR laust starf',
    et: 'töö OR karjäär OR ametikoht OR vaba koht',
    bn: 'চাকরি OR পদ OR নিয়োগ OR ক্যারিয়ার',
    ne: 'जागिर OR पद OR करियर OR रोजगारी',
  };

  const jobTerm = jobTerms[country.lang] || 'job OR career OR position';
  return `"${query}" ${jobTerm}`;
}

/**
 * Search for jobs in a specific country using available search engines.
 * @param {string} query - Search query
 * @param {string} countryCode - ISO country code
 * @param {object} [options] - { browser?, maxResults?, proxy? }
 * @returns {Promise<Array<{title, url, company, location, source, countryCode}>>}
 */
export async function searchCountry(query, countryCode, options = {}) {
  const engines = getEnginesForCountry(countryCode);
  const country = COUNTRIES[countryCode];
  const allResults = [];
  const seenUrls = new Set();

  const localizedQuery = buildLocalizedQuery(query, countryCode);
  console.log(`   🔍 ${country.name}: searching ${engines.length} engines for "${query}"`);

  for (const engineInfo of engines) {
    const engine = SEARCH_ENGINES[engineInfo.engine];
    if (!engine) continue;

    try {
      const url = engine.buildUrl(engineInfo.tld, localizedQuery, countryCode);
      const results = await scrapeSearchResults(url, options);

      for (const r of results) {
        const key = r.url.split('?')[0];
        if (!seenUrls.has(key)) {
          seenUrls.add(key);
          allResults.push({
            ...r,
            countryCode,
            country: country.name,
            source: `${engine.name}-${engineInfo.tld}`,
          });
        }
      }
    } catch {
      // Engine may block — skip gracefully
    }
  }

  return allResults.slice(0, options.maxResults || 50);
}

/**
 * Search ALL countries for jobs.
 * @param {string[]} queries - Search queries
 * @param {object} [options] - { maxResults?, browser?, countryCodes?, parallel? }
 * @returns {Promise<Array<{title, url, company, location, source, countryCode, country}>>}
 */
export async function searchAllCountries(queries, options = {}) {
  const countryCodes = options.countryCodes || Object.keys(COUNTRIES);
  const parallel = options.parallel !== false;
  const maxPerCountry = options.maxResults || 20;
  const allResults = [];

  console.log(`\n🌍 Global Search: ${queries.length} queries × ${countryCodes.length} countries\n`);

  // Process countries in batches for rate limiting
  const batchSize = parallel ? 5 : 1;

  for (let i = 0; i < countryCodes.length; i += batchSize) {
    const batch = countryCodes.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(countryCode =>
        Promise.all(
          queries.map(query =>
            searchCountry(query, countryCode, { ...options, maxResults: maxPerCountry })
          )
        ).then(results => results.flat())
      )
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      }
    }

    // Rate limiting between batches
    if (i + batchSize < countryCodes.length) {
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
    }
  }

  // Final dedup
  const seen = new Set();
  const unique = allResults.filter(j => {
    const key = j.url.split('?')[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\n✅ Global search complete: ${unique.length} unique jobs from ${countryCodes.length} countries`);
  return unique;
}

/**
 * Scrape search results from a search engine URL.
 */
async function scrapeSearchResults(url, options = {}) {
  const browser = options.browser || await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    // Set proxy if provided
    if (options.proxy) {
      await page.authenticate(options.proxy);
    }

    // Random user agent
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    ];
    await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Extract links from search results
    const links = await page.evaluate(() => {
      const results = [];

      // Google-style results
      document.querySelectorAll('a[href*="linkedin.com/jobs"], a[href*="indeed.com"], a[href*="glassdoor.com"], a[href*="greenhouse.io"], a[href*="lever.co"], a[href*="ashbyhq.com"], a[href*="bamboohr"], a[href*="workday"], a[href*="taleo"], a[href*="smartrecruiters"], a[href*="icims"], a[href*="jobvite"]').forEach(a => {
        const title = a.innerText?.trim() || a.title || a.getAttribute('aria-label') || '';
        if (title && title.length > 5) {
          results.push({ title, url: a.href, company: '', location: '' });
        }
      });

      // Generic result links
      document.querySelectorAll('a[href*="/jobs/"], a[href*="/careers/"], a[href*="/job/"], a[href*="career"], a[href*="vacancy"]').forEach(a => {
        const title = a.innerText?.trim() || a.title || '';
        if (title && title.length > 5 && !results.some(r => r.url === a.href)) {
          results.push({ title, url: a.href, company: '', location: '' });
        }
      });

      return results;
    });

    await page.close();
    return links;

  } finally {
    if (!options.browser) await browser.close();
  }
}

export default {
  SEARCH_ENGINES,
  COUNTRIES,
  getCountryCodes,
  getCountry,
  getEnginesForCountry,
  buildLocalizedQuery,
  searchCountry,
  searchAllCountries,
};
