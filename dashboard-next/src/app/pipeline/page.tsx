'use client';

import { useState } from 'react';
import { useDashboard } from '@/components/useDashboard';
import { Zap, ExternalLink, Search, Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { submitEvaluate, addToPipeline } from '@/lib/api';

export default function PipelinePage() {
  const { data, loading, refresh } = useDashboard();
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [evaluating, setEvaluating] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newRole, setNewRole] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [showAll, setShowAll] = useState(false);

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

  const displayItems = showAll ? filtered : filtered.slice(0, 50);

  const badgeColor = (tag: string | null) => {
    switch (tag) {
      case 'EUROPE': return 'badge-blue';
      case 'MIDDLE-EAST': return 'badge-peach';
      case 'ASIA': return 'badge-lavender';
      case 'AFRICA': return 'badge-amber';
      case 'AMERICAS': return 'badge-cyan';
      case 'GLOBAL': return 'badge-green';
      default: return 'badge-blue';
    }
  };

  const handleEvaluate = async (url: string | undefined) => {
    if (!url) return;
    setEvaluating(prev => ({ ...prev, [url]: true }));
    await submitEvaluate(url);
    setTimeout(() => {
      setEvaluating(prev => ({ ...prev, [url]: false }));
    }, 3000);
  };

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    const ok = await addToPipeline(newUrl.trim(), newCompany.trim() || undefined, newRole.trim() || undefined);
    setAdding(false);
    if (ok) {
      setAdded(true);
      setNewUrl('');
      setNewCompany('');
      setNewRole('');
      setTimeout(() => { setAdded(false); setShowAddForm(false); }, 2000);
      refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Priority Discovery</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{items.length} pending opportunities</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/20 transition-all"
        >
          <Plus size={16} /> Add URL
        </button>
      </div>

      {showAddForm && (
        <div className="glass rounded-xl p-5 space-y-3">
          <input
            type="url"
            placeholder="Job posting URL *"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-[var(--color-primary)]"
          />
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Company name"
              value={newCompany}
              onChange={e => setNewCompany(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-[var(--color-primary)]"
            />
            <input
              type="text"
              placeholder="Job title / role"
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              disabled={adding || !newUrl.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {adding ? <><Loader2 size={14} className="animate-spin" /> Adding...</> :
               added ? <><CheckCircle2 size={14} /> Added!</> : 'Add to Pipeline'}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search by company or role..."
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
        <div className="flex gap-1 text-xs text-[var(--color-text-muted)]">
          {regions.map(r => (
            <span key={r} className={`px-2 py-0.5 rounded-full ${badgeColor(r)}`}>{r}</span>
          ))}
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Company</th>
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Role</th>
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Region</th>
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, i) => (
                <tr key={i} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
                  <td className="p-4 font-medium text-white">{item.company}</td>
                  <td className="p-4 text-[var(--color-text)] max-w-md truncate">{item.cleanTitle}</td>
                  <td className="p-4">
                    {item.tag ? (
                      <span className={`badge ${badgeColor(item.tag)}`}>{item.tag}</span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary-light)] hover:underline inline-flex items-center gap-1 text-xs">
                        <ExternalLink size={14} /> Open
                      </a>
                      <button
                        onClick={() => handleEvaluate(item.url)}
                        disabled={!item.url || evaluating[item.url || '']}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 disabled:opacity-50 transition-all"
                      >
                        {evaluating[item.url || ''] ? <><Loader2 size={12} className="animate-spin" /> Evaluating...</> : <><Zap size={12} /> Evaluate</>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            No pipeline entries match. {!search && regionFilter === 'all' && 'Add a URL above to get started.'}
          </div>
        )}
        {filtered.length > 50 && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full text-center py-3 text-xs text-[var(--color-primary-light)] hover:underline"
          >
            Showing 50 of {filtered.length} entries — Show all
          </button>
        )}
      </div>
    </div>
  );
}
