const PRIVATE_RANGES = [
  { prefix: '10.', len: 2 }, { prefix: '127.', len: 3 },
  { prefix: '169.254.', len: 8 }, { prefix: '172.16.', len: 6 },
  { prefix: '192.168.', len: 8 },
];

export function isBlockedIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  if (ip === '::1' || ip === '0.0.0.0') return true;
  for (const r of PRIVATE_RANGES) {
    if (ip.startsWith(r.prefix)) return true;
  }
  return false;
}

export function validateAllowedHosts(hosts) {
  if (!Array.isArray(hosts)) return false;
  const metadataPatterns = ['metadata.', '.internal', '.local'];
  return hosts.every(h => {
    if (typeof h !== 'string' || h.length === 0) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return false;
    if (metadataPatterns.some(p => h.endsWith(p) || h === p.replace(/^\./, ''))) return false;
    return true;
  });
}
