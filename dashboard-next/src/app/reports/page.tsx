'use client';

import { useState, useEffect } from 'react';
import { useDashboard } from '@/components/useDashboard';
import { fetchReportContent } from '@/lib/api';
import { FileText, ArrowLeft, Search, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ReportsPage() {
  const { data, loading } = useDashboard();
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (selected) fetchReportContent(selected).then(setContent);
  }, [selected]);

  if (loading || !data) return <div className="text-center py-20 text-[var(--color-text-muted)]">Loading reports...</div>;

  const reports = data.reports.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  ).reverse();

  if (selected) {
    const pdfFilename = selected.replace(/\.md$/, '.pdf');
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(null)} className="inline-flex items-center gap-2 text-sm text-[var(--color-primary-light)] hover:underline">
            <ArrowLeft size={16} /> Back to reports
          </button>
          <a
            href={`http://localhost:3001/api/pdf/${encodeURIComponent(pdfFilename)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/10 text-sm text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/20 transition-all"
          >
            <Download size={14} /> Download PDF
          </a>
        </div>
        <h1 className="text-2xl font-bold text-white">{selected}</h1>
        <div className="glass rounded-xl p-6 text-sm leading-relaxed prose prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  const groupByPrefix = (name: string) => {
    const match = name.match(/^(\d+)/);
    return match ? match[1] : 'Other';
  };

  const grouped: Record<string, typeof reports> = {};
  reports.forEach(r => {
    const key = groupByPrefix(r.name);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports Archive</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{reports.length} evaluation reports</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Filter reports..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white w-64 focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
      </div>

      {Object.entries(grouped).sort(([a], [b]) => parseInt(b) - parseInt(a)).map(([prefix, reps]) => (
        <div key={prefix}>
          <h3 className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-3 font-semibold">
            Report #{prefix}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {reps.map(r => (
              <button
                key={r.name}
                onClick={() => setSelected(r.name)}
                className="glass rounded-xl p-4 text-left hover:bg-[var(--color-surface-hover)] transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-[var(--color-primary-light)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{r.name}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                      {r.name.match(/\d{4}-\d{2}-\d{2}/)?.[0] || 'Unknown date'}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
