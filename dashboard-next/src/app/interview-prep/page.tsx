'use client';

import { useState } from 'react';
import { useDashboard } from '@/components/useDashboard';
import { BookOpen, Search } from 'lucide-react';

export default function InterviewPrepPage() {
  const { data, loading } = useDashboard();
  const [search, setSearch] = useState('');

  if (loading || !data) return <div className="text-center py-20 text-[var(--color-text-muted)]">Loading...</div>;

  const preps = data.preps.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Interview Intelligence</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {preps.length} company-specific prep modules
          </p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search preps..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white w-64 focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
      </div>

      {preps.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {preps.map((prep, i) => (
            <div key={i} className="glass rounded-xl p-5 hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-green)]/10 flex items-center justify-center shrink-0">
                  <BookOpen size={20} className="text-[var(--color-green)]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">
                    {prep.name.split('-')[0].toUpperCase()}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    {prep.name.replace('.md', '').split('-').slice(1).join(' ')}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mt-2">
                    {prep.stats?.mtime ? new Date(prep.stats.mtime).toLocaleDateString() : ''}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass rounded-xl p-12 text-center">
          <BookOpen size={40} className="mx-auto mb-4 text-[var(--color-text-muted)]" />
          <p className="text-sm text-[var(--color-text-muted)]">
            No interview prep files yet. Move an application to "Interview" status to generate company intel.
          </p>
        </div>
      )}
    </div>
  );
}
