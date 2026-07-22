'use client';

import { useState } from 'react';
import { Globe, Search, Play, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { submitScan } from '@/lib/api';

const REGIONS_CONFIG: Record<string, { label: string; countries: string[]; count?: number }> = {
  'middle-east': { label: 'Middle East & North Africa', countries: ['UAE', 'Dubai', 'Qatar', 'Saudi Arabia', 'Bahrain', 'Kuwait', 'Oman', 'Egypt', 'Morocco', 'Israel'] },
  'europe': { label: 'Europe (incl. Remote EU)', countries: ['UK', 'Germany', 'France', 'Netherlands', 'Spain', 'Italy', 'Sweden', 'Denmark', 'Poland', 'Portugal', 'Switzerland', 'Ireland', 'Czech Republic'] },
  'asia': { label: 'Asia & Asia-Pacific', countries: ['Singapore', 'Japan', 'India', 'China', 'South Korea', 'Hong Kong', 'Vietnam', 'Thailand', 'Indonesia', 'Australia'] },
  'africa': { label: 'Africa', countries: ['South Africa', 'Nigeria', 'Kenya', 'Morocco', 'Egypt', 'Ghana', 'Rwanda', 'Mauritius', 'Madagascar'] },
  'americas': { label: 'North & South America', countries: ['US', 'Canada', 'Brazil', 'Mexico', 'Argentina', 'Colombia', 'Chile'] },
  'global': { label: 'Global / Remote Anywhere', countries: ['Remote', 'Worldwide', 'Global', 'Anywhere', 'Fully Remote'] },
};

export default function RegionsPage() {
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const filtered = Object.entries(REGIONS_CONFIG).filter(([key, reg]) =>
    !search || reg.label.toLowerCase().includes(search.toLowerCase()) ||
    reg.countries.some(c => c.toLowerCase().includes(search.toLowerCase()))
  );

  const handleScan = async (regionKey: string) => {
    setScanning(regionKey);
    setScanResult(null);
    const result = await submitScan(regionKey);
    if (result.jobId) {
      setScanResult('queued');
    } else {
      setScanResult('started');
    }
    setTimeout(() => {
      setScanning(null);
      setScanResult(null);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Global Job Markets</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">6 regions · 60+ countries tracked</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search regions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white w-64 focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(([key, reg]) => (
          <div key={key} className="glass rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-accent)]/20 flex items-center justify-center">
                <Globe size={20} className="text-[var(--color-primary-light)]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{reg.label}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{reg.countries.length} countries</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {reg.countries.map(c => (
                <span key={c} className="px-2.5 py-1 rounded-full bg-[var(--color-surface)] text-xs text-[var(--color-text-muted)]">
                  {c}
                </span>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
              <code className="text-xs text-[var(--color-primary-light)]">
                node search-region.mjs {key}
              </code>
              <button
                onClick={() => handleScan(key)}
                disabled={scanning === key}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/20 disabled:opacity-50 transition-all"
              >
                {scanning === key ? (
                  <><Loader2 size={12} className="animate-spin" /> Scanning...</>
                ) : scanResult === key ? (
                  <><CheckCircle2 size={12} className="text-[var(--color-green)]" /> Done</>
                ) : (
                  <><Play size={12} /> Scan Now</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
