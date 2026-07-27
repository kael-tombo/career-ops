'use client';

import { useState, useEffect } from 'react';
import { BarChart3, AlertTriangle, TrendingDown, Lightbulb, Loader2, RefreshCw, ChevronDown, ChevronUp, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useDashboard } from '@/components/useDashboard';

export default function AIRejectionsPage() {
  const { data, loading, refresh } = useDashboard();
  const [patterns, setPatterns] = useState<any>(null);
  const [patternsLoading, setPatternsLoading] = useState(false);

  const analyze = async () => {
    setPatternsLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const rejections = await (await fetch(`${base}/api/ai/rejection-analyzer/getRejectionData`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' })).json();
      const res = await fetch(`${base}/api/ai/rejection-analyzer/analyzeRejectionPatterns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejections: rejections.success ? rejections.data : [] }),
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) setPatterns(json.data);
    } catch {}
    setPatternsLoading(false);
  };

  useEffect(() => { if (data) analyze(); }, [data]);

  if (loading || !data) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center"><div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" /><p className="text-sm text-[var(--color-text-muted)]">Loading...</p></div>
    </div>
  );

  const apps = data.applications || [];
  const rejected = apps.filter((a: any) => a.status === 'Rejected').length;
  const applied = apps.filter((a: any) => a.status === 'Applied').length;
  const interview = apps.filter((a: any) => a.status === 'Interview').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Rejection Analyzer</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Find patterns in rejections and improve your approach</p>
        </div>
        <button onClick={analyze} disabled={patternsLoading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/20 transition-all disabled:opacity-50">
          {patternsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Analyze
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Applications', value: apps.length, icon: BarChart3, color: 'var(--color-primary)' },
          { label: 'Applied', value: applied, icon: ThumbsUp, color: 'var(--color-accent)' },
          { label: 'Rejected', value: rejected, icon: ThumbsDown, color: 'var(--color-red)' },
          { label: 'Rejection Rate', value: applied > 0 ? `${Math.round(rejected / applied * 100)}%` : '0%', icon: TrendingDown, color: 'var(--color-amber, #f0c040)' },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--color-text-muted)]">{stat.label}</span>
              <stat.icon size={16} style={{ color: stat.color }} />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* AI Analysis */}
      {patternsLoading ? (
        <div className="glass rounded-xl p-12 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
        </div>
      ) : patterns ? (
        <>
          {/* Overall Health */}
          <div className={`glass rounded-xl p-6 border-l-4 ${patterns.overallHealth === 'good' ? 'border-[var(--color-green)]' : patterns.overallHealth === 'needsWork' ? 'border-[var(--color-amber, #f0c040)]' : 'border-[var(--color-red)]'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Pipeline Health</h2>
              <span className={`badge ${patterns.overallHealth === 'good' ? 'badge-green' : patterns.overallHealth === 'needsWork' ? 'badge-lavender' : 'badge-red'}`}>{patterns.overallHealth}</span>
            </div>

            {patterns.stageDropoff && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                {Object.entries(patterns.stageDropoff).map(([stage, count]) => (
                  <div key={stage} className="p-3 rounded-lg bg-[var(--color-surface)] text-center">
                    <p className="text-xs text-[var(--color-text-muted)] capitalize">{stage}</p>
                    <p className="text-xl font-bold text-white">{count as number}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Reasons */}
          {patterns.topReasons?.length > 0 && (
            <div className="glass rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-[var(--color-red)]" /> Top Rejection Reasons</h2>
              <div className="space-y-3">
                {patterns.topReasons.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-surface)]">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-red)]/20 flex items-center justify-center text-xs font-bold text-[var(--color-red)] shrink-0">{r.occurrences}</div>
                    <div>
                      <p className="text-sm text-white">{r.reason}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">{r.advice}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvements */}
          {patterns.improvements?.length > 0 && (
            <div className="glass rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Lightbulb size={16} className="text-[var(--color-amber, #f0c040)]" /> Recommended Improvements</h2>
              <div className="space-y-3">
                {patterns.improvements.map((imp: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
                    <p className="text-sm font-medium text-[var(--color-primary-light)]">{imp.area}</p>
                    <p className="text-sm text-[var(--color-text)] mt-1">{imp.action}</p>
                    {imp.expectedImpact && <p className="text-xs text-[var(--color-green)] mt-1">Expected impact: {imp.expectedImpact}</p>}
                  </div>
                ))}
              </div>
              {patterns.recommendedFocus && (
                <div className="mt-4 p-4 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
                  <p className="text-sm font-semibold text-[var(--color-accent)]">🎯 Single Most Important Focus</p>
                  <p className="text-sm text-[var(--color-text)] mt-1">{patterns.recommendedFocus}</p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="glass rounded-xl p-12 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">Apply to more jobs to get rejection pattern analysis.</p>
        </div>
      )}
    </div>
  );
}
