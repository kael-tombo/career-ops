'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, PieChart, Target, Filter, Calendar, Download, RefreshCw } from 'lucide-react';
import { fetchApplications } from '@/lib/api';
import type { Application } from '@/lib/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AnalyticsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('all');

  const loadData = async () => {
    setLoading(true);
    const a = await fetchApplications();
    setApps(a);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const safeScore = (s: string | undefined | null): number => {
    const n = parseFloat(s || '');
    return isNaN(n) ? 0 : n;
  };

  const filterByTime = (items: Application[]) => {
    if (timeRange === 'all') return items;
    const cutoff = new Date();
    if (timeRange === '7d') cutoff.setDate(cutoff.getDate() - 7);
    else if (timeRange === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else if (timeRange === '90d') cutoff.setDate(cutoff.getDate() - 90);
    return items.filter(a => new Date(a.date) >= cutoff);
  };

  const filtered = filterByTime(apps);
  const total = filtered.length;

  const statusCounts: Record<string, number> = {};
  filtered.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });

  const scored = filtered.filter(a => safeScore(a.score) > 0);
  const avgScore = scored.length > 0 ? (scored.reduce((s, a) => s + safeScore(a.score), 0) / scored.length) : 0;
  const highFit = scored.filter(a => safeScore(a.score) >= 4).length;
  const midFit = scored.filter(a => safeScore(a.score) >= 3 && safeScore(a.score) < 4).length;
  const lowFit = scored.filter(a => safeScore(a.score) < 3).length;

  const evaluated = filtered.filter(a => a.status === 'Evaluated').length;
  const applied = filtered.filter(a => a.status === 'Applied').length;
  const responded = filtered.filter(a => a.status === 'Responded').length;
  const interviewed = filtered.filter(a => a.status === 'Interview').length;
  const offers = filtered.filter(a => a.status === 'Offer').length;
  const rejected = filtered.filter(a => a.status === 'Rejected').length;
  const discarded = filtered.filter(a => a.status === 'Discarded' || a.status === 'SKIP').length;

  const evalToApply = evaluated > 0 ? Math.round((applied / evaluated) * 100) : 0;
  const applyToResponse = applied > 0 ? Math.round((responded / applied) * 100) : 0;
  const responseToInterview = responded > 0 ? Math.round((interviewed / responded) * 100) : 0;
  const interviewToOffer = interviewed > 0 ? Math.round((offers / interviewed) * 100) : 0;

  const hasPdf = filtered.filter(a => a.pdf === '✅').length;
  const topCompanies = [...filtered.reduce((acc, a) => {
    acc.set(a.company, (acc.get(a.company) || 0) + 1);
    return acc;
  }, new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const recentByMonth: Record<string, number> = {};
  filtered.forEach(a => {
    const m = a.date ? a.date.slice(0, 7) : 'unknown';
    recentByMonth[m] = (recentByMonth[m] || 0) + 1;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            <span className="text-[var(--color-primary-light)]">{total} total entries</span> &middot;
            Avg score <span className="text-[var(--color-green)]">{avgScore.toFixed(1)}/5</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white">
            <option value="all">All Time</option>
            <option value="90d">Last 90 days</option>
            <option value="30d">Last 30 days</option>
            <option value="7d">Last 7 days</option>
          </select>
          <button onClick={loadData} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white transition-colors">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-[var(--color-primary-light)]" /> Conversion Funnel
        </h3>
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Evaluated', value: evaluated, pct: 100, color: 'var(--color-primary-light)' },
            { label: 'Applied', value: applied, pct: evalToApply, color: 'var(--color-green)' },
            { label: 'Responded', value: responded, pct: applyToResponse, color: 'var(--color-lavender)' },
            { label: 'Interview', value: interviewed, pct: responseToInterview, color: 'var(--color-purple)' },
            { label: 'Offer', value: offers, pct: interviewToOffer, color: 'var(--color-amber)' },
          ].map((stage) => (
            <div key={stage.label} className="text-center p-4 rounded-lg bg-[var(--color-surface)]">
              <div className="text-2xl font-bold text-white" style={{ color: stage.color }}>{stage.value}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">{stage.label}</div>
              <div className="text-xs mt-1" style={{ color: stage.color }}>{stage.pct}%</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <div className="flex-1 h-2 rounded-full bg-[var(--color-surface)] overflow-hidden flex">
            <div className="h-full bg-[var(--color-primary-light)]" style={{ width: `${Math.min(100, evaluated > 0 ? (applied / evaluated) * 100 : 0)}%` }} />
            <div className="h-full bg-[var(--color-green)]" style={{ width: `${Math.min(100, applied > 0 ? (responded / applied) * 100 : 0)}%` }} />
            <div className="h-full bg-[var(--color-lavender)]" style={{ width: `${Math.min(100, responded > 0 ? (interviewed / responded) * 100 : 0)}%` }} />
            <div className="h-full bg-[var(--color-purple)]" style={{ width: `${Math.min(100, interviewed > 0 ? (offers / interviewed) * 100 : 0)}%` }} />
            <div className="h-full bg-[var(--color-amber)]" style={{ width: `${Math.min(100, offers > 0 ? 100 : 0)}%` }} />
          </div>
        </div>
      </div>

      {/* Score Distribution + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Distribution */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <PieChart size={16} className="text-[var(--color-primary-light)]" /> Score Distribution
          </h3>
          {scored.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No scored entries</p>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'High Fit (4.0+)', value: highFit, pct: Math.round((highFit / scored.length) * 100), color: 'var(--color-green)' },
                { label: 'Medium (3.0-3.9)', value: midFit, pct: Math.round((midFit / scored.length) * 100), color: 'var(--color-amber)' },
                { label: 'Low (&lt;3.0)', value: lowFit, pct: Math.round((lowFit / scored.length) * 100), color: 'var(--color-red)' },
              ].map((tier) => (
                <div key={tier.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--color-text-muted)]">{tier.label}</span>
                    <span className="text-white">{tier.value} ({tier.pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${tier.pct}%`, backgroundColor: tier.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-[var(--color-green)]" /> Status Breakdown
          </h3>
          <div className="space-y-2">
            {Object.entries(statusCounts)
              .sort(([,a], [,b]) => b - a)
              .map(([status, count]) => {
                const pct = Math.round((count / total) * 100);
                const colors: Record<string, string> = {
                  Evaluated: 'var(--color-primary-light)',
                  Applied: 'var(--color-green)',
                  Responded: 'var(--color-lavender)',
                  Interview: 'var(--color-purple)',
                  Offer: 'var(--color-amber)',
                  Rejected: 'var(--color-red)',
                  Discarded: 'var(--color-text-muted)',
                  SKIP: 'var(--color-text-muted)',
                };
                return (
                  <div key={status} className="flex items-center gap-2 text-sm">
                    <span className="w-20 text-[var(--color-text-muted)] text-xs">{status}</span>
                    <div className="flex-1 h-4 rounded bg-[var(--color-surface)] overflow-hidden relative">
                      <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: colors[status] || 'var(--color-primary-light)' }} />
                    </div>
                    <span className="w-12 text-right text-white text-xs">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Target size={16} className="text-[var(--color-amber)]" /> Key Metrics
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Avg Score', value: avgScore.toFixed(1), suffix: '/5', color: safeScore.length > 0 && avgScore >= 4 ? 'var(--color-green)' : 'var(--color-amber)' },
              { label: 'Eval → Apply', value: `${evalToApply}%`, suffix: '', color: evalToApply >= 50 ? 'var(--color-green)' : 'var(--color-amber)' },
              { label: 'Apply → Response', value: `${applyToResponse}%`, suffix: '', color: applyToResponse >= 30 ? 'var(--color-green)' : applyToResponse >= 10 ? 'var(--color-amber)' : 'var(--color-red)' },
              { label: 'Response → Interview', value: `${responseToInterview}%`, suffix: '', color: responseToInterview >= 50 ? 'var(--color-green)' : 'var(--color-amber)' },
              { label: 'Interview → Offer', value: `${interviewToOffer}%`, suffix: '', color: interviewToOffer >= 30 ? 'var(--color-green)' : 'var(--color-amber)' },
              { label: 'PDF Conversion', value: `${total > 0 ? Math.round((hasPdf / total) * 100) : 0}%`, suffix: '', color: 'var(--color-lavender)' },
              { label: 'Rejection Rate', value: `${applied > 0 ? Math.round((rejected / applied) * 100) : 0}%`, suffix: '', color: 'var(--color-red)' },
            ].map((m) => (
              <div key={m.label} className="flex justify-between items-center p-2 rounded-lg bg-[var(--color-surface)]">
                <span className="text-xs text-[var(--color-text-muted)]">{m.label}</span>
                <span className="text-sm font-semibold" style={{ color: m.color }}>{m.value}{m.suffix}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Trend */}
      {Object.keys(recentByMonth).length > 0 && (
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-[var(--color-lavender)]" /> Monthly Activity
          </h3>
          <div className="flex items-end gap-2 h-32">
            {Object.entries(recentByMonth)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([month, count]) => {
                const max = Math.max(...Object.values(recentByMonth));
                const height = max > 0 ? (count / max) * 100 : 0;
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-[var(--color-text-muted)]">{count}</span>
                    <div className="w-full rounded-t bg-gradient-to-t from-[var(--color-primary)]/40 to-[var(--color-primary)]/20 transition-all" style={{ height: `${height}%` }} />
                    <span className="text-[10px] text-[var(--color-text-muted)]">{month.slice(5, 7)}/{month.slice(2, 4)}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Top Companies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Top Companies</h3>
          {topCompanies.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No companies yet</p>
          ) : (
            <div className="space-y-2">
              {topCompanies.map(([company, count], i) => (
                <div key={company} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface)]">
                  <span className="text-xs text-[var(--color-text-muted)] w-6">{i + 1}.</span>
                  <span className="text-sm text-white flex-1">{company}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{count} jobs</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Status Flow</h3>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Total in tracker', value: total },
              { label: 'Evaluated (pending decision)', value: evaluated, color: 'var(--color-primary-light)' },
              { label: 'Applied', value: applied, color: 'var(--color-green)' },
              { label: 'In interview process', value: interviewed, color: 'var(--color-purple)' },
              { label: 'Offers received', value: offers, color: 'var(--color-amber)' },
              { label: 'Not pursued (SKIP/Discarded)', value: discarded, color: 'var(--color-text-muted)' },
              { label: 'Rejected', value: rejected, color: 'var(--color-red)' },
            ].map((item) => (
              <div key={item.label} className="flex justify-between p-2 rounded-lg bg-[var(--color-surface)]">
                <span className="text-[var(--color-text-muted)]">{item.label}</span>
                <span className="text-white font-medium" style={item.color ? { color: item.color } : {}}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
