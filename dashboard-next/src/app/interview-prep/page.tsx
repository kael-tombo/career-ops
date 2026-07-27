'use client';

import { useState, useEffect } from 'react';
import { useDashboard } from '@/components/useDashboard';
import { BookOpen, Search, ArrowLeft, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_URL } from '@/lib/api';

export default function InterviewPrepPage() {
  const { data, loading } = useDashboard();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    if (selected) {
      setContentLoading(true);
      setContent('');
      fetch(`${API_URL}/api/interview-prep/${encodeURIComponent(selected)}`)
        .then(r => r.text())
        .then(t => { setContent(t); setContentLoading(false); })
        .catch(() => { setContent('# Error loading prep'); setContentLoading(false); });
    }
  }, [selected]);

  if (loading || !data) return <div className="text-center py-20 text-[var(--color-text-muted)]">Loading...</div>;

  const preps = data.preps.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatCompany = (name: string) => {
    const parts = name.replace('.md', '').split('-');
    return parts[0].toUpperCase().replace(/_/g, ' ');
  };

  const formatRole = (name: string) => {
    return name.replace('.md', '').split('-').slice(1).join(' ').replace(/_/g, ' ');
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="inline-flex items-center gap-2 text-sm text-[var(--color-primary-light)] hover:underline">
          <ArrowLeft size={16} /> Back to prep list
        </button>
        <h1 className="text-2xl font-bold text-white">{formatCompany(selected)} — {formatRole(selected)}</h1>
        <div className="glass rounded-xl p-6 text-sm leading-relaxed prose prose-invert max-w-none">
          {contentLoading ? (
            <div className="text-center py-8 text-[var(--color-text-muted)]">Loading prep content...</div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          )}
        </div>
      </div>
    );
  }

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
            <div
              key={i}
              onClick={() => setSelected(prep.name)}
              className="glass rounded-xl p-5 hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-green)]/10 flex items-center justify-center shrink-0">
                  <BookOpen size={20} className="text-[var(--color-green)]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">
                    {formatCompany(prep.name)}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    {formatRole(prep.name)}
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
