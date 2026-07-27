import { createHash } from 'crypto';

export const FINGERPRINT_MIN_TEXT = 100;

export function fingerprintText(text) {
  if (!text || typeof text !== 'string') return '';
  const cleaned = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length < FINGERPRINT_MIN_TEXT) return '';
  const normalized = cleaned.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

export function normalizeJdText(text) {
  if (!text) return '';
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function tokenize(text) {
  return text.toLowerCase().split(/\s+/).filter(t => t.length > 2);
}

export function similarity(a, b) {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  const intersection = ta.filter(t => setB.has(t)).length;
  return intersection / Math.max(ta.length, tb.length);
}

export function findCrossListings(newOffers, historyRows, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const windowDays = 90;
  const results = [];
  for (const offer of newOffers) {
    if (!offer.fingerprint) continue;
    for (const row of historyRows) {
      if (!row.fingerprint) continue;
      if (row.company === offer.company) continue;
      const daysSince = (new Date(today) - new Date(row.dateStr)) / 86400000;
      if (daysSince > windowDays) continue;
      if (row.fingerprint !== offer.fingerprint) continue;
      const score = similarity(`${row.title} ${row.company}`, `${offer.title} ${offer.company}`);
      if (score >= 0.7) results.push({ row, score, offer: { url: offer.url, company: offer.company, title: offer.title } });
    }
  }
  return results;
}
