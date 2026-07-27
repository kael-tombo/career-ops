'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Target,
  Zap,
  AlertTriangle,
  Calendar,
  Clock,
  Loader2,
  RefreshCw,
  Brain,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useDashboard } from '@/components/useDashboard';
import { API_URL } from '@/lib/api';

export default function AIForecastPage() {
  const { data, loading, refresh } = useDashboard();
  const [forecast, setForecast] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadForecast = async () => {
    setForecastLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/ai/pipeline-forecast/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) setForecast(json.data);
    } catch {}
    setForecastLoading(false);
  };

  useEffect(() => { loadForecast(); }, []);

  if (loading || !data) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center"><div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" /><p className="text-sm text-[var(--color-text-muted)]">Loading forecast...</p></div>
    </div>
  );

  const apps = data.applications || [];
  const applied = apps.filter((a: any) => a.status === 'Applied').length;
  const interview = apps.filter((a: any) => a.status === 'Interview').length;
  const offers = apps.filter((a: any) => a.status === 'Offer').length;
  const rejected = apps.filter((a: any) => a.status === 'Rejected').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Pipeline Forecast</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Predictive analytics for your job search pipeline</p>
        </div>
        <button onClick={loadForecast} disabled={forecastLoading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/20 transition-all disabled:opacity-50">
          {forecastLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh Forecast
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Applied', value: applied, icon: Target, color: 'var(--color-primary)' },
          { label: 'Interviews', value: interview, icon: Calendar, color: 'var(--color-accent)' },
          { label: 'Offers', value: offers, icon: TrendingUp, color: 'var(--color-green)' },
          { label: 'Rejected', value: rejected, icon: AlertTriangle, color: 'var(--color-red)' },
          { label: 'Conversion', value: applied > 0 ? `${Math.round(interview / applied * 100)}%` : '0%', icon: BarChart3, color: 'var(--color-amber, #f0c040)' },
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

      {/* AI Forecast Card */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain size={18} className="text-[var(--color-primary)]" />
          <h2 className="text-lg font-semibold text-white">AI Forecast</h2>
        </div>

        {forecastLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
          </div>
        ) : forecast ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-[var(--color-surface)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Next Interview</p>
                <p className="text-lg font-semibold text-[var(--color-accent)]">{forecast.forecast?.nextInterviewBy || 'Insufficient data'}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">~{forecast.forecast?.applicationsNeededForNextInterview || '?'} more applications needed</p>
              </div>
              <div className="p-4 rounded-lg bg-[var(--color-surface)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Next Offer</p>
                <p className="text-lg font-semibold text-[var(--color-green)]">{forecast.forecast?.nextOfferBy || 'Insufficient data'}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">~{forecast.forecast?.applicationsNeededForNextOffer || '?'} more applications needed</p>
              </div>
              <div className="p-4 rounded-lg bg-[var(--color-surface)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Conversion Rate</p>
                <p className="text-lg font-semibold text-white">{forecast.interviewRate || 'N/A'}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Apps → Interview</p>
              </div>
            </div>

            {forecast.bottlenecks?.length > 0 && (
              <div className="p-4 rounded-lg bg-[var(--color-red)]/10 border border-[var(--color-red)]/20">
                <h3 className="text-sm font-semibold text-[var(--color-red)] mb-2">Bottlenecks</h3>
                <ul className="space-y-1">
                  {forecast.bottlenecks.map((b: string, i: number) => (
                    <li key={i} className="text-sm text-[var(--color-text)] flex items-start gap-2">
                      <span className="text-[var(--color-red)] mt-0.5">•</span> {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {forecast.recommendations?.length > 0 && (
              <div className="p-4 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
                <h3 className="text-sm font-semibold text-[var(--color-primary-light)] mb-2">Recommendations</h3>
                <ul className="space-y-1">
                  {forecast.recommendations.map((r: string, i: number) => (
                    <li key={i} className="text-sm text-[var(--color-text)] flex items-start gap-2">
                      <Zap size={14} className="text-[var(--color-primary)] mt-0.5 shrink-0" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <span className={`inline-block w-2 h-2 rounded-full ${forecast.confidence === 'high' ? 'bg-[var(--color-green)]' : forecast.confidence === 'medium' ? 'bg-[var(--color-amber, #f0c040)]' : 'bg-[var(--color-red)]'}`} />
              Confidence: {forecast.confidence || 'low'}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
            Apply to more jobs to generate a forecast. Data improves as your pipeline grows.
          </p>
        )}
      </div>

      {/* Weekly Target */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Weekly Target</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[var(--color-text-muted)]">This week</span>
              <span className="text-white font-medium">{applied} / {forecast?.weeklyTarget || 10}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--color-primary)] transition-all" style={{ width: `${Math.min(100, (applied / (forecast?.weeklyTarget || 10)) * 100)}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
