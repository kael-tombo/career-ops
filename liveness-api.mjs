export async function checkLivenessApi(url) {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const text = await resp.text();
    const lower = text.toLowerCase();
    const hasJobContent = lower.includes('apply') || lower.includes('job') || lower.includes('position') || lower.includes('career');
    const hasExpired = lower.includes('no longer') || lower.includes('expired') || lower.includes('filled') || lower.includes('closed');
    if (!hasJobContent) return { alive: false, reason: 'no_job_content' };
    if (hasExpired) return { alive: false, reason: 'expired' };
    return { alive: true };
  } catch (err) {
    return { alive: false, reason: err.message };
  }
}
