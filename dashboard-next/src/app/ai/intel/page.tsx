'use client';

import { useState } from 'react';
import { Search, Building2, Loader2, Globe, Users, AlertTriangle, ExternalLink, BookOpen, CheckCircle } from 'lucide-react';

export default function AICompanyIntelPage() {
  const [company, setCompany] = useState('');
  const [intel, setIntel] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchIntel = async () => {
    if (!company.trim()) return;
    setLoading(true);
    setError('');
    setIntel(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${base}/api/ai/company-intel/gatherCompanyIntel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: company.trim(), opts: { webFetch: false } }),
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) setIntel(json.data);
      else setError(json.error || 'Failed to gather intel');
    } catch { setError('Failed to connect to API'); }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Company Intel</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Research companies before you apply</p>
        </div>
      </div>

      {/* Search */}
      <div className="glass rounded-xl p-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchIntel()}
              placeholder="Enter company name (e.g. Stripe, Google, Datadog)..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <button
            onClick={searchIntel}
            disabled={loading || !company.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
            Research
          </button>
        </div>
      </div>

      {/* Results */}
      {error && (
        <div className="glass rounded-xl p-4 border border-[var(--color-red)]/30">
          <p className="text-sm text-[var(--color-red)]">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-[var(--color-primary)] mx-auto mb-4" />
            <p className="text-sm text-[var(--color-text-muted)]">Gathering intelligence...</p>
          </div>
        </div>
      )}

      {intel && !loading && (
        <>
          {/* Header */}
          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Building2 size={24} className="text-[var(--color-primary)]" />
              <div>
                <h2 className="text-xl font-bold text-white">{intel.companyName}</h2>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <span className={`badge ${intel.size === 'enterprise' ? 'badge-blue' : intel.size === 'mid' ? 'badge-lavender' : 'badge-green'}`}>{intel.size || 'Unknown'}</span>
                  <span className="badge">{intel.industry || 'N/A'}</span>
                  <span className={`badge ${intel.remotePolicy === 'remote' ? 'badge-green' : intel.remotePolicy === 'hybrid' ? 'badge-lavender' : 'badge-red'}`}>{intel.remotePolicy || 'Unknown'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left */}
              <div className="space-y-4">
                {intel.engineeringCulture?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5"><Users size={14} /> Engineering Culture</h3>
                    <ul className="space-y-1">
                      {intel.engineeringCulture.map((c: string, i: number) => (
                        <li key={i} className="text-sm text-[var(--color-text)] flex items-start gap-2"><CheckCircle size={12} className="text-[var(--color-green)] mt-1 shrink-0" />{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {intel.techStackClues?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">Tech Stack</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {intel.techStackClues.map((t: string, i: number) => (
                        <span key={i} className="text-xs px-2 py-1 rounded-md bg-[var(--color-surface)] text-[var(--color-text-muted)]">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right */}
              <div className="space-y-4">
                {intel.growthSignals?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-green)] mb-2 flex items-center gap-1.5"><TrendingUp size={14} /> Growth Signals</h3>
                    <ul className="space-y-1">
                      {intel.growthSignals.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-[var(--color-text)] flex items-start gap-2"><span className="text-[var(--color-green)]">+</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {intel.redFlags?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-red)] mb-2 flex items-center gap-1.5"><AlertTriangle size={14} /> Red Flags</h3>
                    <ul className="space-y-1">
                      {intel.redFlags.map((f: string, i: number) => (
                        <li key={i} className="text-sm text-[var(--color-text)] flex items-start gap-2"><span className="text-[var(--color-red)]">•</span>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {intel.preparationTips?.length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
                <h3 className="text-sm font-semibold text-[var(--color-primary-light)] mb-2 flex items-center gap-1.5"><BookOpen size={14} /> Preparation Tips</h3>
                <ul className="space-y-1">
                  {intel.preparationTips.map((t: string, i: number) => (
                    <li key={i} className="text-sm text-[var(--color-text)]">{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TrendingUp(props: any) { return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> }
