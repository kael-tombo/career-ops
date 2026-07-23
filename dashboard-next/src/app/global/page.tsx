'use client';

import { useState, useEffect } from 'react';
import { Globe, Search, MapPin, Zap, Loader2, CheckCircle2, AlertCircle, BarChart3, Layers, RadioTower, Rss, Cpu } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';
import { fetchGlobalCapabilities, fetchGlobalCountries, startGlobalSweep, fetchGlobalSweepStatus } from '@/lib/api';
import type { GlobalCapabilities, CountryData, SweepStatus } from '@/lib/types';

export default function GlobalPage() {
  const [countries, setCountries] = useState<Record<string, CountryData>>({});
  const [caps, setCaps] = useState<GlobalCapabilities | null>(null);
  const [sweepStatus, setSweepStatus] = useState<SweepStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('software engineer');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    Promise.all([
      fetchGlobalCapabilities(),
      fetchGlobalCountries(),
    ]).then(([capsData, countriesData]) => {
      if (capsData) setCaps(capsData);
      if (countriesData) setCountries(countriesData.countries || {});
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const startSweep = async () => {
    setSweeping(true);
    const result = await startGlobalSweep(
      searchQuery.split(',').map(s => s.trim()).filter(Boolean)
    );
    if (result.id) {
      setSweepStatus({ id: result.id, status: 'queued' });
      const poll = setInterval(async () => {
        const status = await fetchGlobalSweepStatus(result.id);
        if (status) {
          setSweepStatus(status);
          if (status.status === 'completed' || status.status === 'failed' || status.status === 'dead') {
            clearInterval(poll);
            setSweeping(false);
          }
        }
      }, 3000);
    } else {
      setSweeping(false);
    }
  };

  const countryEntries = Object.entries(countries)
    .filter(([code, info]) =>
      !filter || code.toLowerCase().includes(filter.toLowerCase()) || info.name.toLowerCase().includes(filter.toLowerCase())
    )
    .sort(([, a], [, b]) => a.name.localeCompare(b.name));

  const totalBoards = Object.values(countries).reduce((s, c) => s + c.boardCount, 0);

  if (loading) return <LoadingSpinner text="Loading global coverage data..." />;

  return (
    <ErrorBoundary>
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Global Discovery</h1>
        <p className="text-[var(--color-text-muted)] text-sm">
          Search {caps?.searchEngineTLDs?.toLocaleString() || 'thousands'} of search engine TLDs across {caps?.countries || 120}+ countries
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {[
          { icon: Search, label: 'Search Engines', value: caps?.searchEngines || '-', sub: `${caps?.searchEngineTLDs || '-'} TLDs` },
          { icon: MapPin, label: 'Countries', value: Object.keys(countries).length || '-', sub: `${totalBoards} job boards` },
          { icon: Layers, label: 'Job Boards', value: totalBoards || '-', sub: `${Object.keys(countries).length} countries` },
          { icon: RadioTower, label: 'Max RPM', value: caps?.maxRPM || '-', sub: `${caps?.proxyFingerprints || '-'} fingerprints` },
          { icon: Rss, label: 'Sitemap Limit', value: caps?.sitemapCrawlLimit?.toLocaleString() || '-', sub: 'URLs per crawl' },
          { icon: Cpu, label: 'ATS APIs', value: '5', sub: 'Greenhouse, Lever +' },
        ].map((card, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-center gap-2 mb-1">
              <card.icon size={16} className="text-[var(--color-primary)]" />
              <span className="text-xs text-[var(--color-text-muted)]">{card.label}</span>
            </div>
            <div className="text-2xl font-bold">{card.value}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Zap size={16} className="text-[var(--color-primary)]" />
            Start Global Sweep
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--color-text-muted)] block mb-1">Search Queries (comma-separated)</label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="software engineer, product manager, data scientist"
                className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <button
              onClick={startSweep}
              disabled={sweeping}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {sweeping ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
              {sweeping ? 'Sweeping...' : 'Start Global Sweep'}
            </button>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BarChart3 size={16} className="text-[var(--color-primary)]" />
            Sweep Status
          </h2>
          {sweepStatus ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-text-muted)]">Status:</span>
                {sweepStatus.status === 'running' && <span className="flex items-center gap-1 text-yellow-400"><Loader2 size={12} className="animate-spin" /> Running</span>}
                {sweepStatus.status === 'completed' && <span className="flex items-center gap-1 text-green-400"><CheckCircle2 size={12} /> Completed</span>}
                {sweepStatus.status === 'failed' && <span className="flex items-center gap-1 text-red-400"><AlertCircle size={12} /> Failed</span>}
                {(sweepStatus.status === 'queued' || sweepStatus.status === 'started') && <span className="text-[var(--color-text-muted)]">Queued...</span>}
              </div>
              {sweepStatus.startedAt && <div><span className="text-[var(--color-text-muted)]">Started:</span> {new Date(sweepStatus.startedAt).toLocaleString()}</div>}
              {sweepStatus.jobsFound !== undefined && <div><span className="text-[var(--color-text-muted)]">Jobs Found:</span> <span className="font-bold">{sweepStatus.jobsFound}</span></div>}
              {sweepStatus.countriesCovered !== undefined && <div><span className="text-[var(--color-text-muted)]">Countries:</span> {sweepStatus.countriesCovered}</div>}
              {sweepStatus.error && <div className="text-red-400 text-xs">{sweepStatus.error}</div>}
            </div>
          ) : (
            <div className="text-[var(--color-text-muted)] text-xs">No sweep running. Click "Start Global Sweep" to begin.</div>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <MapPin size={16} className="text-[var(--color-primary)]" />
            Country Explorer ({countryEntries.length} countries)
          </h2>
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter countries..."
            className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs w-48 focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 max-h-96 overflow-y-auto">
          {countryEntries.map(([code, info]) => (
            <button
              key={code}
              onClick={() => setSelectedCountry(selectedCountry === code ? null : code)}
              className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                selectedCountry === code
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
              }`}
            >
              <div className="font-semibold">{info.name}</div>
              <div className="text-[var(--color-text-muted)]">
                {code} · {info.engines.length} engines · {info.boardCount} boards
              </div>
            </button>
          ))}
        </div>

        {selectedCountry && countries[selectedCountry] && (
          <div className="mt-4 p-3 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5">
            <h3 className="font-semibold mb-2">{countries[selectedCountry].name} ({selectedCountry})</h3>
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-[var(--color-text-muted)] mb-1">Search Engines:</div>
                <div className="flex flex-wrap gap-1">
                  {countries[selectedCountry].engines.map(e => (
                    <span key={e} className="px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">{e}</span>
                  ))}
                </div>
                <div className="text-[var(--color-text-muted)] mt-2">TLD: .{countries[selectedCountry].tld} · Lang: {countries[selectedCountry].lang}</div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)] mb-1">Job Boards ({countries[selectedCountry].boardCount}):</div>
                <div className="flex flex-wrap gap-1">
                  {countries[selectedCountry].boards.map(b => (
                    <span key={b} className="px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">{b}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
        {[
          { region: 'Europe', count: countryEntries.filter(([k]) => ['GB','DE','FR','IT','ES','NL','BE','CH','AT','SE','NO','DK','FI','PL','CZ','SK','HU','RO','BG','HR','RS','SI','LT','LV','EE','IE','PT','GR','LU','MT','CY','IS','RU','UA','BY','KZ','TR'].includes(k)).length, color: 'from-blue-500/20 to-blue-600/10' },
          { region: 'Asia-Pacific', count: countryEntries.filter(([k]) => ['JP','KR','IN','AU','NZ','SG','HK','TW','TH','ID','MY','PH','VN','CN','PK','BD','LK','NP'].includes(k)).length, color: 'from-green-500/20 to-green-600/10' },
          { region: 'Middle East', count: countryEntries.filter(([k]) => ['AE','SA','QA','KW','BH','OM','IL','IQ','JO','LB'].includes(k)).length, color: 'from-yellow-500/20 to-yellow-600/10' },
          { region: 'Africa', count: countryEntries.filter(([k]) => ['ZA','NG','KE','GH','MA','DZ','TN','EG','SN','CI','UG','TZ','ZM','ZW','MU','NA','ET'].includes(k)).length, color: 'from-orange-500/20 to-orange-600/10' },
          { region: 'Americas', count: countryEntries.filter(([k]) => ['US','CA','MX','BR','AR','CL','CO','PE','EC','VE','UY','PY','BO','CR','PA','GT','SV','HN','NI','DO','PR','JM','TT'].includes(k)).length, color: 'from-red-500/20 to-red-600/10' },
        ].map(region => (
          <div key={region.region} className={`card p-3 bg-gradient-to-br ${region.color}`}>
            <div className="text-xs text-[var(--color-text-muted)]">{region.region}</div>
            <div className="text-2xl font-bold">{region.count}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">countries</div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
        <p>Total sources: {(caps?.searchEngineTLDs || 0) + totalBoards + (caps?.sitemapCrawlLimit || 0).toLocaleString()}</p>
        <p className="mt-1">
          {caps?.searchEngineTLDs || 'Thousands'} search engine URLs + {totalBoards} job boards + {caps?.sitemapCrawlLimit?.toLocaleString() || '100K'} sitemap URLs + 5 ATS APIs
        </p>
      </div>

      <style jsx>{`
        .stat-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 16px; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; }
        .btn-primary { background: var(--color-primary); color: white; border: none; border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
    </ErrorBoundary>
  );
}
