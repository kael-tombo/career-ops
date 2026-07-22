'use client';

import { useDashboard } from '@/components/useDashboard';
import StatCard from '@/components/StatCard';
import OverviewCharts from '@/components/OverviewCharts';
import RecentActivity from '@/components/RecentActivity';

export default function OverviewPage() {
  const { data, loading } = useDashboard();

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  const safeScore = (s: string | undefined | null): number => {
    const n = parseFloat(s || '');
    return isNaN(n) ? 0 : n;
  };

  const apps = data.applications;
  const total = apps.length;
  const applied = apps.filter(a => (a.status || '').includes('Applied')).length;
  const interviewed = apps.filter(a => (a.status || '').includes('Interview')).length;
  const offers = apps.filter(a => (a.status || '').includes('Offer')).length;
  const evaluated = apps.filter(a => (a.status || '').includes('Evaluated')).length;
  const elite = apps.filter(a => safeScore(a.score) >= 4).length;
  const avgScore = total > 0 ? (apps.reduce((s, a) => s + safeScore(a.score), 0) / total).toFixed(1) : '0.0';
  const conversionRate = evaluated > 0 ? Math.round((applied / evaluated) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Elite Market Intel</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Strategic overview of your active search &middot;{' '}
          <span className="text-[var(--color-green)]">{total} opportunities tracked</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Elite Matches" value={elite} subtitle="Score 4.0+" icon="rocket" />
        <StatCard title="Applications Sent" value={applied} subtitle={`${conversionRate}% conversion from eval`} icon="trending" />
        <StatCard title="Active Interviews" value={interviewed} subtitle={offers > 0 ? `${offers} offer${offers > 1 ? 's' : ''} received` : 'No offers yet'} icon="activity" />
        <StatCard title="Avg Score" value={avgScore} subtitle={`Across ${total} evaluations`} icon="file" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-xl p-6">
          <OverviewCharts data={apps} />
        </div>
        <div className="glass rounded-xl p-6">
          <RecentActivity data={apps} preps={data.preps} />
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Quick Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { label: 'Evaluated', value: evaluated, color: 'var(--color-blue)' },
            { label: 'Applied', value: applied, color: 'var(--color-green)' },
            { label: 'Interviewing', value: interviewed, color: 'var(--color-lavender)' },
            { label: 'SKIP / Discarded', value: apps.filter(a => a.status.includes('SKIP') || a.status.includes('Discarded')).length, color: 'var(--color-text-muted)' },
          ].map((s) => (
            <div key={s.label} className="text-center p-3 rounded-lg bg-[var(--color-surface)]">
              <div className="text-2xl font-bold text-white" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
