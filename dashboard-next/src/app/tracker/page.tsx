'use client';

import { useState } from 'react';
import { useDashboard } from '@/components/useDashboard';
import { updateStatus, submitTailor, submitPrep, addToPipeline } from '@/lib/api';
import { Shield, ChevronDown, Search, Scissors, FileInput, Loader2, ExternalLink, Plus, X } from 'lucide-react';

const CANONICAL_STATUSES = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP'];

export default function TrackerPage() {
  const { data, loading, refresh } = useDashboard();
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [actionJobs, setActionJobs] = useState<Record<string, { tailoring?: boolean; prepping?: boolean }>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newCo, setNewCo] = useState('');
  const [newRole, setNewRole] = useState('');
  const [adding, setAdding] = useState(false);

  if (loading || !data) return <div className="text-center py-20 text-[var(--color-text-muted)]">Loading tracker...</div>;

  const filtered = data.applications.filter(a =>
    a.company.toLowerCase().includes(search.toLowerCase()) ||
    a.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleStatus = async (id: string, status: string) => {
    setUpdating(id);
    const ok = await updateStatus(id, status);
    setUpdating(null);
    if (!ok) alert(`Failed to update status for ${id}`);
    refresh();
  };

  const handleTailor = async (id: string) => {
    setActionJobs(prev => ({ ...prev, [id]: { ...prev[id], tailoring: true } }));
    await submitTailor(id);
    setTimeout(() => {
      setActionJobs(prev => ({ ...prev, [id]: { ...prev[id], tailoring: false } }));
    }, 3000);
  };

  const handlePrep = async (id: string) => {
    setActionJobs(prev => ({ ...prev, [id]: { ...prev[id], prepping: true } }));
    await submitPrep(id);
    setTimeout(() => {
      setActionJobs(prev => ({ ...prev, [id]: { ...prev[id], prepping: false } }));
    }, 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Application Command</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Managing {data.applications.length} curated opportunities
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary)]/10 text-sm text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/20 transition-all"
          >
            {showAdd ? <X size={16} /> : <Plus size={16} />}
            {showAdd ? 'Cancel' : 'Add Application'}
          </button>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] w-64"
            />
          </div>
        </div>
      </div>

      {showAdd && (
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
              value={newCo}
              onChange={e => setNewCo(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-[var(--color-primary)]"
            />
            <input
              type="text"
              placeholder="Job title"
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={async () => {
                if (!newUrl.trim()) return;
                setAdding(true);
                const ok = await addToPipeline(newUrl.trim(), newCo.trim() || undefined, newRole.trim() || undefined);
                setAdding(false);
                if (ok) {
                  setNewUrl(''); setNewCo(''); setNewRole('');
                  setShowAdd(false);
                  refresh();
                }
              }}
              disabled={adding || !newUrl.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {adding ? <><Loader2 size={14} className="animate-spin" /> Adding...</> : 'Add to Pipeline'}
            </button>
          </div>
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Company</th>
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Role</th>
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Score</th>
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Status</th>
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Actions</th>
                <th className="text-center p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">PDF</th>
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Date</th>
                <th className="text-left p-4 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => {
                const jobs = actionJobs[app.id] || {};
                return (
                  <tr key={app.id} className={`border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] ${updating === app.id ? 'opacity-50' : ''}`}>
                    <td className="p-4 font-medium text-white">{app.company}</td>
                    <td className="p-4 text-[var(--color-text)] max-w-xs truncate">{app.role}</td>
                    <td className="p-4">
                      <span className={`badge ${
                        parseFloat(app.score) >= 4 ? 'badge-blue' :
                        parseFloat(app.score) >= 3.5 ? 'badge-lavender' :
                        parseFloat(app.score) >= 3 ? 'badge-peach' : 'badge-red'
                      }`}>
                        {app.score}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="relative inline-block">
                        <select
                          value={app.status.trim()}
                          onChange={e => handleStatus(app.id, e.target.value)}
                          disabled={updating === app.id}
                          className="status-select pr-6 appearance-none"
                        >
                          {CANONICAL_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                            app.url
                              ? 'bg-[var(--color-green)]/10 text-[var(--color-green)] hover:bg-[var(--color-green)]/20'
                              : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] pointer-events-none opacity-50'
                          }`}
                          title={app.url ? "Open application page" : "No URL available"}
                        >
                          <ExternalLink size={12} />
                          Apply
                        </a>
                        <button
                          onClick={() => handleTailor(app.id)}
                          disabled={jobs.tailoring}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--color-surface)] text-xs text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/10 disabled:opacity-50 transition-all"
                          title="Generate tailored CV & cover letter"
                        >
                          {jobs.tailoring ? <Loader2 size={12} className="animate-spin" /> : <Scissors size={12} />}
                          Tailor
                        </button>
                        <button
                          onClick={() => handlePrep(app.id)}
                          disabled={jobs.prepping}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--color-surface)] text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 disabled:opacity-50 transition-all"
                          title="Start autonomous form prep"
                        >
                          {jobs.prepping ? <Loader2 size={12} className="animate-spin" /> : <FileInput size={12} />}
                          Prep
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-center text-xs">{app.pdf === '✅' ? <span className="text-[var(--color-green)]">✅</span> : <span className="text-[var(--color-text-muted)]">❌</span>}</td>
                    <td className="p-4 text-[var(--color-text-muted)] text-xs">{app.date}</td>
                    <td className="p-4 text-xs text-[var(--color-text-muted)] max-w-xs truncate">{app.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[var(--color-text-muted)]">No applications match your search.</div>
        )}
      </div>
    </div>
  );
}
