'use client';

import { useState, useEffect, useRef } from 'react';
import { Activity, Play, Square, Clock, CheckCircle2, XCircle, AlertTriangle, ExternalLink, ChevronRight, Zap, Globe, FileText, Bot, RefreshCw } from 'lucide-react';
import { API_URL } from '@/lib/api';

type PipelineEvent = {
  event: string;
  data: any;
};

type DaemonStatus = {
  daemon: { running: boolean; status: string; runs: number; totalJobsScanned: number; totalApplied: number; lastRun: string | null; lastError: string | null; startedAt: string | null };
  cv: { name: string; title: string } | null;
  schedule: { type: string; intervalMs: number; intervalMinutes: number; running: boolean } | null;
  queue: { queued: number; active: number; completed: number; dead: number; maxConcurrency: number } | null;
  config: { scanInterval: number; pipelineInterval: number; minScore: number; maxApplyPerRun: number; dryRun: boolean; workers: number };
};

type PipelineRun = {
  newJobs: number;
  evaluated: number;
  applied: number;
  tailored: number;
  failed: number;
  timestamp: string;
};

export default function AutonomousPage() {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<PipelineRun | null>(null);
  const [scheduleInterval, setScheduleInterval] = useState(60);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/autonomous/status`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.daemon?.lastResult) setLastRun(data.daemon.lastResult);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${API_URL}/api/events`);
      es.addEventListener('pipeline:start', (e: MessageEvent) => {
        setEvents(prev => [...prev.slice(-99), { event: 'pipeline:start', data: JSON.parse(e.data) }]);
        setRunning(true);
      });
      es.addEventListener('pipeline:stage', (e: MessageEvent) => {
        setEvents(prev => [...prev.slice(-99), { event: 'pipeline:stage', data: JSON.parse(e.data) }]);
      });
      es.addEventListener('pipeline:progress', (e: MessageEvent) => {
        setEvents(prev => {
          const last = prev[prev.length - 1];
          if (last?.event === 'pipeline:progress') prev[prev.length - 1] = { event: 'pipeline:progress', data: JSON.parse(e.data) };
          else return [...prev.slice(-99), { event: 'pipeline:progress', data: JSON.parse(e.data) }];
          return prev;
        });
      });
      es.addEventListener('pipeline:complete', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setEvents(prev => [...prev.slice(-99), { event: 'pipeline:complete', data }]);
        setLastRun(data);
        setRunning(false);
        fetchStatus();
      });
      es.addEventListener('pipeline:error', (e: MessageEvent) => {
        setEvents(prev => [...prev.slice(-99), { event: 'pipeline:error', data: JSON.parse(e.data) }]);
        setRunning(false);
      });
      es.addEventListener('pulse', () => {});
      es.addEventListener('connected', () => {});
    } catch { /* ignore */ }

    return () => { if (es) es.close(); };
  }, []);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const triggerPipeline = async () => {
    try {
      await fetch(`${API_URL}/api/autonomous/pipeline`, { method: 'POST' });
    } catch { /* ignore */ }
  };

  const triggerScan = async () => {
    try {
      await fetch(`${API_URL}/api/autonomous/scan`, { method: 'POST' });
    } catch { /* ignore */ }
  };

  const setSchedule = async () => {
    try {
      await fetch(`${API_URL}/api/autonomous/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMs: scheduleInterval * 60 * 1000, type: 'pipeline' }),
      });
    } catch { /* ignore */ }
  };

  const daemon = status?.daemon || { running: false, status: 'unknown', runs: 0, totalJobsScanned: 0, totalApplied: 0, lastRun: null, lastError: null, startedAt: null };
  const cfg = status?.config || { scanInterval: 180, pipelineInterval: 3600, minScore: 3.5, maxApplyPerRun: 10, dryRun: true, workers: 3 };
  const q = status?.queue;

  const formatTime = (iso: string | null) => {
    if (!iso) return 'N/A';
    const d = new Date(iso);
    return d.toLocaleTimeString();
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'running': return 'text-[var(--color-green)]';
      case 'idle': return 'text-[var(--color-primary-light)]';
      case 'error': return 'text-[var(--color-red)]';
      default: return 'text-[var(--color-text-muted)]';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Autonomous AI Team</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            24/7 pipeline: <span className="text-[var(--color-primary-light)]">scan</span> &middot;{' '}
            <span className="text-[var(--color-green)]">evaluate</span> &middot;{' '}
            <span className="text-[var(--color-amber)]">tailor</span> &middot;{' '}
            <span className="text-[var(--color-purple)]">apply</span> &middot;{' '}
            <span className="text-[var(--color-lavender)]">report</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={triggerScan} disabled={running} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-primary)] transition-colors flex items-center gap-1.5">
            <Globe size={12} /> Scan
          </button>
          <button onClick={triggerPipeline} disabled={running} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-primary)]/20 text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/30 transition-colors flex items-center gap-1.5 font-semibold">
            {running ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
            {running ? 'Running...' : 'Run Pipeline'}
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Daemon</span>
            <Activity size={16} className={statusColor(daemon.status)} />
          </div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${daemon.running ? 'bg-[var(--color-green)]' : 'bg-[var(--color-text-muted)]'}`} />
            {daemon.running ? 'Running' : 'Stopped'}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            Uptime: {daemon.startedAt ? formatDuration(Math.floor((Date.now() - new Date(daemon.startedAt).getTime()) / 1000)) : 'N/A'}
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Pipeline Runs</span>
            <Zap size={16} className="text-[var(--color-primary-light)]" />
          </div>
          <div className="text-lg font-bold text-white">{daemon.runs}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            Last: {formatTime(daemon.lastRun)}
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Jobs Scanned</span>
            <Globe size={16} className="text-[var(--color-green)]" />
          </div>
          <div className="text-lg font-bold text-white">{daemon.totalJobsScanned || 0}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            Across all runs
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Applications</span>
            <FileText size={16} className="text-[var(--color-purple)]" />
          </div>
          <div className="text-lg font-bold text-white">{daemon.totalApplied || 0}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            {cfg.dryRun ? '⚠️ Dry run mode' : 'Live mode'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Bot size={16} className="text-[var(--color-primary-light)]" /> Configuration
          </h3>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Min Score', value: `${cfg.minScore}/5` },
              { label: 'Max Apply/Run', value: String(cfg.maxApplyPerRun) },
              { label: 'Workers', value: String(cfg.workers) },
              { label: 'Pipeline Interval', value: `${Math.round(cfg.pipelineInterval / 60)}min` },
              { label: 'Scan Interval', value: `${Math.round(cfg.scanInterval / 60)}min` },
              { label: 'Mode', value: cfg.dryRun ? '🔍 Review (dry-run)' : '🚀 Auto-submit' },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-[var(--color-text-muted)]">{item.label}</span>
                <span className="text-white font-medium">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <label className="text-xs text-[var(--color-text-muted)] block mb-2">Schedule (minutes)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={scheduleInterval}
                onChange={e => setScheduleInterval(parseInt(e.target.value) || 60)}
                min={5}
                max={1440}
                className="flex-1 px-2 py-1 text-xs rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-white"
              />
              <button onClick={setSchedule} className="px-3 py-1 text-xs rounded bg-[var(--color-primary)]/20 text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/30 transition-colors">
                Set
              </button>
            </div>
            {status?.schedule?.running && (
              <p className="text-xs text-[var(--color-green)] mt-2">Schedule active: every {status.schedule.intervalMinutes}min</p>
            )}
          </div>
        </div>

        {/* Queue Status */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity size={16} className="text-[var(--color-green)]" /> Queue Status
          </h3>
          {q ? (
            <div className="space-y-3">
              {[
                { label: 'Queued', value: q.queued, color: 'var(--color-primary-light)' },
                { label: 'Active', value: q.active, color: 'var(--color-green)' },
                { label: 'Completed', value: q.completed, color: 'var(--color-lavender)' },
                { label: 'Failed', value: q.dead, color: 'var(--color-red)' },
                { label: 'Max Concurrency', value: q.maxConcurrency, color: 'var(--color-text-muted)' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-text-muted)]">{item.label}</span>
                  <span className="text-white font-semibold" style={{ color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">Queue not available</p>
          )}

          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <span>CV:</span>
              {status?.cv ? (
                <span className="text-[var(--color-green)] flex items-center gap-1"><CheckCircle2 size={10} /> {status.cv.name}</span>
              ) : (
                <span className="text-[var(--color-red)] flex items-center gap-1"><XCircle size={10} /> Missing</span>
              )}
            </div>
          </div>
        </div>

        {/* Last Run Results */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[var(--color-amber)]" /> Last Run
          </h3>
          {lastRun ? (
            <div className="space-y-3">
              {[
                { label: 'New Jobs', value: lastRun.newJobs ?? 0, color: 'var(--color-primary-light)' },
                { label: 'Evaluated', value: lastRun.evaluated ?? 0, color: 'var(--color-blue)' },
                { label: 'Tailored', value: lastRun.tailored ?? 0, color: 'var(--color-amber)' },
                { label: 'Applied', value: lastRun.applied ?? 0, color: 'var(--color-green)' },
                { label: 'Failed', value: lastRun.failed ?? 0, color: lastRun.failed > 0 ? 'var(--color-red)' : 'var(--color-text-muted)' },
                { label: 'Time', value: formatTime(lastRun.timestamp), color: 'var(--color-text-muted)' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-text-muted)]">{item.label}</span>
                  <span className="text-white font-semibold" style={{ color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bot size={32} className="text-[var(--color-text-muted)] mb-2" />
              <p className="text-sm text-[var(--color-text-muted)]">No runs yet</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Click &quot;Run Pipeline&quot; to start</p>
            </div>
          )}
        </div>
      </div>

      {/* Live Event Feed */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Activity size={16} className={running ? 'text-[var(--color-green)]' : 'text-[var(--color-text-muted)]'} />
          Live Activity Feed
          {running && <span className="w-2 h-2 rounded-full bg-[var(--color-green)] animate-pulse ml-1" />}
        </h3>
        <div className="h-64 overflow-y-auto space-y-1 text-xs font-mono">
          {events.length === 0 ? (
            <p className="text-[var(--color-text-muted)] italic">No activity yet. Run the pipeline to see live events.</p>
          ) : (
            events.map((evt, i) => (
              <div key={i} className="flex items-start gap-2 p-1.5 rounded hover:bg-[var(--color-surface)]">
                <span className="text-[var(--color-text-muted)] shrink-0 w-16">{formatTime(evt.data?.timestamp) || '--:--:--'}</span>
                <EventBadge event={evt.event} />
                <EventData event={evt} />
              </div>
            ))
          )}
          <div ref={eventsEndRef} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Zap, label: 'Run Full Pipeline', action: triggerPipeline, color: 'var(--color-primary-light)' },
            { icon: Globe, label: 'Scan Only', action: triggerScan, color: 'var(--color-green)' },
            { icon: FileText, label: 'View Reports', href: '/reports', color: 'var(--color-amber)' },
            { icon: ExternalLink, label: 'Daemon Status', action: () => window.open(`${API_URL}/api/autonomous/status`), color: 'var(--color-purple)' },
          ].map((item) => {
            const Icon = item.icon;
            if (item.href) {
              return (
                <a key={item.label} href={item.href} className="flex items-center gap-2 px-3 py-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-all text-sm text-[var(--color-text-muted)] hover:text-white">
                  <Icon size={16} style={{ color: item.color }} />
                  {item.label}
                  <ChevronRight size={14} className="ml-auto" />
                </a>
              );
            }
            return (
              <button key={item.label} onClick={item.action} disabled={running} className="flex items-center gap-2 px-3 py-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-all text-sm text-[var(--color-text-muted)] hover:text-white disabled:opacity-50 text-left">
                <Icon size={16} style={{ color: item.color }} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventBadge({ event }: { event: string }) {
  const colors: Record<string, string> = {
    'pipeline:start': 'bg-[var(--color-primary)]/20 text-[var(--color-primary-light)]',
    'pipeline:stage': 'bg-[var(--color-blue)]/20 text-[var(--color-blue)]',
    'pipeline:progress': 'bg-[var(--color-lavender)]/20 text-[var(--color-lavender)]',
    'pipeline:complete': 'bg-[var(--color-green)]/20 text-[var(--color-green)]',
    'pipeline:error': 'bg-[var(--color-red)]/20 text-[var(--color-red)]',
    'scan:complete': 'bg-[var(--color-green)]/20 text-[var(--color-green)]',
    'apply:complete': 'bg-[var(--color-purple)]/20 text-[var(--color-purple)]',
    'pulse': 'bg-[var(--color-surface)] text-[var(--color-text-muted)]',
  };
  const label = event.replace('pipeline:', '').replace(':', ' ');
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase whitespace-nowrap ${colors[event] || 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'}`}>
      {label}
    </span>
  );
}

function EventData({ event }: { event: PipelineEvent }) {
  const d = event.data;
  switch (event.event) {
    case 'pipeline:start':
      return <span className="text-[var(--color-text)]">Pipeline started</span>;
    case 'pipeline:stage': {
      const stageNames: Record<string, string> = { scan: 'Scanning', evaluate: 'Evaluating', apply: 'Applying' };
      return <span className="text-[var(--color-text)]">{stageNames[d.stage] || d.stage}: {d.status === 'started' ? '▶️' : '✅'}</span>;
    }
    case 'pipeline:progress':
      return <span className="text-[var(--color-text-muted)]">{d.current}/{d.total}{d.company ? ` — ${d.company}` : ''}{d.url ? ' — ' + d.url.slice(0, 60) + '...' : ''}</span>;
    case 'pipeline:complete':
      return <span className="text-[var(--color-green)]">{d.applied || 0} applied, {d.evaluated || 0} evaluated, {d.newJobs || 0} new jobs</span>;
    case 'pipeline:error':
      return <span className="text-[var(--color-red)]">{d.error}</span>;
    default:
      return <span className="text-[var(--color-text-muted)]">{JSON.stringify(d).slice(0, 120)}</span>;
  }
}
