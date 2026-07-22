'use client';

import { useState } from 'react';
import { useDashboard } from '@/components/useDashboard';
import { Zap, ExternalLink, Search } from 'lucide-react';

export default function PipelinePage() {
  const { data, loading } = useDashboard();
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  if (loading || !data) return <div className="text-center py-20 text-[var(--color-text-muted)]">Loading pipeline...</div>;

  const items = data.pipeline.items || [];
  const withTag = items.map(i => ({
    ...i,
    tag: i.tag || (i.role?.match(/\[([A-Z-]+)\]/)?.[1] ?? null),
    cleanTitle: (i.role || '').replace(/\s*\[[A-Z-]+\]/, '').trim(),
  }));

  const regions = [...new Set(withTag.map(i => i.tag).filter(Boolean))] as string[];

  const filtered = withTag.filter(i => {
    const matchSearch = !search || i.company.toLowerCase().includes(search.toLowerCase()) || (i.cleanTitle || '').toLowerCase().includes(search.toLowerCase());
    const matchRegion = regionFilter === 'all' || i.tag === regionFilter;
    return matchSearch && matchRegion;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Priority Discovery</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{items.length} pending opportunities</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search pipeline..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white w-full focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        {regions.length > 0 && (
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            className="status-select text-sm"
          >
            <option value="all">All Regions</option>
            {regions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Company</th>
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Role</th>
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Region</th>
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Link</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((item, i) => (
                <tr key={i} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                  <td className="p-4 font-medium text-white">{item.company}</td>
                  <td className="p-4 text-[var(--color-text)] max-w-md truncate">{item.cleanTitle}</td>
                  <td className="p-4">
                    {item.tag ? (
                      <span className={`badge ${
                        item.tag === 'EUROPE' ? 'badge-blue' :
                        item.tag === 'MIDDLE-EAST' ? 'badge-peach' :
                        item.tag === 'ASIA' ? 'badge-lavender' :
                        item.tag === 'GLOBAL' ? 'badge-green' : 'badge-blue'
                      }`}>{item.tag}</span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary-light)] hover:underline inline-flex items-center gap-1">
                      <ExternalLink size={14} /> Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[var(--color-text-muted)]">No pipeline entries match.</div>
        )}
        {filtered.length > 50 && (
          <div className="text-center py-4 text-xs text-[var(--color-text-muted)]">
            Showing 50 of {filtered.length} entries
          </div>
        )}
      </div>
    </div>
  );
}
