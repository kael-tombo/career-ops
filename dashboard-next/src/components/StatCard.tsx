'use client';

import { Rocket, Activity, FileText, TrendingUp } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: 'rocket' | 'activity' | 'file' | 'trending';
  trend?: number;
}

const icons = {
  rocket: Rocket,
  activity: Activity,
  file: FileText,
  trending: TrendingUp,
};

export default function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  const Icon = icon ? icons[icon] : null;

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{title}</div>
          <div className="stat-num text-white">{value}</div>
          {subtitle && <div className="stat-desc">{subtitle}</div>}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
            <Icon size={20} className="text-[var(--color-primary-light)]" />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <TrendingUp size={14} className={trend >= 0 ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'} />
          <span className={trend >= 0 ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
          <span className="text-[var(--color-text-muted)]">vs last month</span>
        </div>
      )}
    </div>
  );
}
