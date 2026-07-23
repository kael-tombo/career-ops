/**
 * lib/autonomous/anti-detect.mjs — Anti-Detection Layer
 *
 * Protects autonomous agents from being blocked by:
 *  - User-agent rotation
 *  - Request rate limiting (per-domain)
 *  - Random human-like delays
 *  - Proxy rotation (optional)
 *  - Domain cooldown tracking
 */

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 Safari/604.1',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.2; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
];

const PROXY_POOL = [];

const domainCooldowns = new Map();
const domainRequestCounts = new Map();
let currentUAIndex = 0;
let currentProxyIndex = 0;

export const ANTI_DETECT_DEFAULTS = {
  minDelay: 2000,
  maxDelay: 6000,
  requestsPerMinute: 10,
  domainCooldownMs: 60000,
  respectRobotsTxt: true,
};

export function setProxyPool(proxies) {
  PROXY_POOL.length = 0;
  PROXY_POOL.push(...proxies);
}

export function addProxy(url) {
  PROXY_POOL.push(url);
}

export function getRandomUA() {
  currentUAIndex = (currentUAIndex + 1) % UA_POOL.length;
  return UA_POOL[currentUAIndex];
}

export function getNextProxy() {
  if (PROXY_POOL.length === 0) return null;
  currentProxyIndex = (currentProxyIndex + 1) % PROXY_POOL.length;
  return PROXY_POOL[currentProxyIndex];
}

export function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return url;
  }
}

function isDomainOnCooldown(domain) {
  const until = domainCooldowns.get(domain);
  if (!until) return false;
  if (Date.now() >= until) {
    domainCooldowns.delete(domain);
    return false;
  }
  return true;
}

function incrementDomainCount(domain) {
  const now = Date.now();
  const window = 60000;
  const entry = domainRequestCounts.get(domain) || [];
  const recent = entry.filter(t => now - t < window);
  recent.push(now);
  domainRequestCounts.set(domain, recent);
  return recent.length;
}

export function getDomainRPM(domain) {
  const now = Date.now();
  const entry = domainRequestCounts.get(domain) || [];
  return entry.filter(t => now - t < 60000).length;
}

export async function rateLimit(url, options = {}) {
  const domain = extractDomain(url);
  const maxRPM = options.requestsPerMinute || ANTI_DETECT_DEFAULTS.requestsPerMinute;
  const cooldownMs = options.domainCooldownMs || ANTI_DETECT_DEFAULTS.domainCooldownMs;
  const minDelay = options.minDelay || ANTI_DETECT_DEFAULTS.minDelay;
  const maxDelay = options.maxDelay || ANTI_DETECT_DEFAULTS.maxDelay;

  if (isDomainOnCooldown(domain)) {
    const until = domainCooldowns.get(domain);
    const wait = until - Date.now() + 100;
    console.log(`   🛑 Domain ${domain} on cooldown — waiting ${Math.round(wait / 1000)}s`);
    await sleep(wait);
  }

  const rpm = getDomainRPM(domain);
  if (rpm >= maxRPM) {
    const cooldownUntil = Date.now() + cooldownMs;
    domainCooldowns.set(domain, cooldownUntil);
    console.log(`   🛑 RPM limit hit for ${domain} (${rpm}/${maxRPM}) — cooling ${Math.round(cooldownMs / 1000)}s`);
    await sleep(cooldownMs);
  }

  const delay = minDelay + Math.random() * (maxDelay - minDelay);
  await sleep(delay);

  incrementDomainCount(domain);
}

export function getPlaywrightLaunchOptions() {
  const proxy = getNextProxy();
  const opts = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  };
  if (proxy) {
    opts.proxy = { server: proxy };
  }
  return opts;
}

export async function humanDelay(min = 500, max = 2000) {
  await sleep(min + Math.random() * (max - min));
}

export async function simulateHumanBehavior(page) {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });
  await humanDelay(300, 800);
  const height = 300 + Math.floor(Math.random() * 600);
  await page.mouse.move(100 + Math.random() * 200, height);
  await humanDelay(200, 600);
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 0.3));
  await humanDelay(400, 1000);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export default { setProxyPool, addProxy, getRandomUA, getNextProxy, rateLimit, getPlaywrightLaunchOptions, humanDelay, simulateHumanBehavior, getDomainRPM, extractDomain };
