import type { Application, PipelineItem, ReportMeta, Profile, PrepMeta, Diagnostics, DashboardData, JobStatus, ScanHistoryEntry } from './types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function safeJson<T>(res: Response, fallback: T): Promise<T> {
  try { return await res.json(); } catch { return fallback; }
}

async function safeText(res: Response, fallback: string): Promise<string> {
  try { return await res.text(); } catch { return fallback; }
}

export async function submitScan(region?: string): Promise<{ jobId: string }> {
  try {
    const res = await fetch(`${API}/api/scan${region ? `?region=${encodeURIComponent(region)}` : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return { jobId: '' };
    return safeJson(res, { jobId: '' });
  } catch { return { jobId: '' }; }
}

export async function submitTailor(id: string): Promise<{ jobId: string }> {
  try {
    const res = await fetch(`${API}/api/tailor/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return { jobId: '' };
    return safeJson(res, { jobId: '' });
  } catch { return { jobId: '' }; }
}

export async function submitPrep(id: string): Promise<{ jobId: string }> {
  try {
    const res = await fetch(`${API}/api/prep-form/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return { jobId: '' };
    return safeJson(res, { jobId: '' });
  } catch { return { jobId: '' }; }
}

export async function getJobs(): Promise<JobStatus[]> {
  try {
    const res = await fetch(`${API}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return safeJson(res, []);
  } catch { return []; }
}

export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  try {
    const res = await fetch(`${API}/api/jobs/${encodeURIComponent(jobId)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return safeJson(res, null);
  } catch { return null; }
}

export async function fetchScanHistory(): Promise<ScanHistoryEntry[]> {
  try {
    const res = await fetch(`${API}/api/scan-history`, { cache: 'no-store' });
    if (!res.ok) return [];
    return safeJson(res, []);
  } catch { return []; }
}

export function subscribeToEvents(callbacks: {
  onJobUpdate?: (job: JobStatus) => void;
  onScanResults?: (data: { count: number; platform: string; company: string }) => void;
}): () => void {
  let es: EventSource | null = null;
  try {
    es = new EventSource(`${API}/api/events`);
    es.addEventListener('job:queued', (e: MessageEvent) => callbacks.onJobUpdate?.(JSON.parse(e.data)));
    es.addEventListener('job:running', (e: MessageEvent) => callbacks.onJobUpdate?.(JSON.parse(e.data)));
    es.addEventListener('job:completed', (e: MessageEvent) => callbacks.onJobUpdate?.(JSON.parse(e.data)));
    es.addEventListener('job:failed', (e: MessageEvent) => callbacks.onJobUpdate?.(JSON.parse(e.data)));
    es.addEventListener('scan:results', (e: MessageEvent) => callbacks.onScanResults?.(JSON.parse(e.data)));
  } catch {
    // EventSource not available
  }
  return () => { if (es) es.close(); };
}

export async function fetchApplications(): Promise<Application[]> {
  try {
    const res = await fetch(`${API}/api/applications`, { cache: 'no-store' });
    if (!res.ok) return [];
    return safeJson(res, []);
  } catch { return []; }
}

export async function fetchPipeline(): Promise<{ content: string; items: PipelineItem[] }> {
  try {
    const res = await fetch(`${API}/api/pipeline`, { cache: 'no-store' });
    if (!res.ok) return { content: '', items: [] };
    return safeJson(res, { content: '', items: [] });
  } catch { return { content: '', items: [] }; }
}

export async function fetchReports(): Promise<ReportMeta[]> {
  try {
    const res = await fetch(`${API}/api/reports`, { cache: 'no-store' });
    if (!res.ok) return [];
    return safeJson(res, []);
  } catch { return []; }
}

export async function fetchProfile(): Promise<Profile | null> {
  try {
    const res = await fetch(`${API}/api/profile`, { cache: 'no-store' });
    if (!res.ok) return null;
    return safeJson(res, null);
  } catch { return null; }
}

export async function fetchPreps(): Promise<PrepMeta[]> {
  try {
    const res = await fetch(`${API}/api/interview-prep`, { cache: 'no-store' });
    if (!res.ok) return [];
    return safeJson(res, []);
  } catch { return []; }
}

export async function fetchStoryBank(): Promise<string> {
  try {
    const res = await fetch(`${API}/api/story-bank`, { cache: 'no-store' });
    if (!res.ok) return '# No stories found';
    return safeText(res, '# No stories found');
  } catch { return '# No stories found'; }
}

export async function fetchDiagnostics(): Promise<Diagnostics | null> {
  try {
    const res = await fetch(`${API}/api/diagnostics`, { cache: 'no-store' });
    if (!res.ok) return null;
    return safeJson(res, null);
  } catch { return null; }
}

export async function fetchReportContent(filename: string): Promise<string> {
  try {
    const res = await fetch(`${API}/api/reports/${encodeURIComponent(filename)}`, { cache: 'no-store' });
    if (!res.ok) return '# Report not found';
    return safeText(res, '# Error loading report');
  } catch { return '# Error loading report'; }
}

export async function updateStatus(id: string, status: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/applications/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch { return false; }
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const results = await Promise.allSettled([
    fetchApplications(),
    fetchPipeline(),
    fetchReports(),
    fetchProfile(),
    fetchPreps(),
    fetchStoryBank(),
    fetchDiagnostics(),
  ]);
  return {
    applications: results[0].status === 'fulfilled' ? results[0].value : [],
    pipeline: results[1].status === 'fulfilled' ? results[1].value : { content: '', items: [] },
    reports: results[2].status === 'fulfilled' ? results[2].value : [],
    profile: results[3].status === 'fulfilled' ? results[3].value : null,
    preps: results[4].status === 'fulfilled' ? results[4].value : [],
    storyBank: results[5].status === 'fulfilled' ? results[5].value : '# No stories found',
    diagnostics: results[6].status === 'fulfilled' ? results[6].value : null,
  };
}
