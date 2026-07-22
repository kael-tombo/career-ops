'use client';

import { ArrowRight, Coffee } from 'lucide-react';
import type { Application, PrepMeta } from '@/lib/types';

export default function RecentActivity({ data, preps }: { data: Application[]; preps: PrepMeta[] }) {
  const recent = [...data]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const topPreps = preps.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Recent Evaluations</h3>
        </div>
        <div className="space-y-2">
          {recent.map((app) => (
            <div key={app.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface)] text-sm">
              <div className="min-w-0">
                <div className="text-white text-xs font-medium truncate">{app.company}</div>
                <div className="text-[10px] text-[var(--color-text-muted)] truncate">{app.role.slice(0, 40)}</div>
              </div>
              <span className={`badge shrink-0 ml-2 ${
                parseFloat(app.score) >= 4 ? 'badge-blue' : parseFloat(app.score) >= 3.5 ? 'badge-lavender' : 'badge-peach'
              }`}>
                {app.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Interview Prep</h3>
          <Coffee size={14} className="text-[var(--color-text-muted)]" />
        </div>
        {topPreps.length > 0 ? (
          <div className="space-y-2">
            {topPreps.map((prep, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface)] text-xs cursor-pointer hover:bg-[var(--color-surface-hover)]">
                <span className="text-white font-medium">{prep.name.split('-')[0].toUpperCase()}</span>
                <ArrowRight size={12} className="text-[var(--color-text-muted)]" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">No interview prep yet</p>
        )}
      </div>
    </div>
  );
}
