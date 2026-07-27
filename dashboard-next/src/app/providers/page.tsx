'use client';

import { useState, useEffect } from 'react';
import {
  Cpu,
  CheckCircle2,
  XCircle,
  Server,
  ListOrdered,
  Loader2,
  BrainCircuit,
  RefreshCw,
} from 'lucide-react';
import { API_URL } from '@/lib/api';

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#00A67E',
  grok: '#1DA1F2',
  kimi: '#FF6B35',
  deepseek: '#4F46E5',
  gemini: '#4285F4',
};

interface Provider {
  id: string;
  keyVar: string;
  models: string;
  configured: boolean;
}

interface Module {
  id: string;
  path: string;
  label: string;
}

interface ProviderData {
  order: string[];
  providers: Provider[];
}

interface ApiResponse {
  modules: Module[];
  providers: ProviderData;
}

export default function ProvidersPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/ai`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Failed to load provider data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const configuredCount = data?.providers?.providers?.filter((p) => p.configured).length ?? 0;
  const totalProviders = data?.providers?.providers?.length ?? 0;
  const sortedProviders = data?.providers?.providers
    ? [...data.providers.providers].sort(
        (a, b) => data.providers.order.indexOf(a.id) - data.providers.order.indexOf(b.id)
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">LLM Providers</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Multi-provider AI gateway status and configuration
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/20 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-[var(--color-text-muted)]">Loading providers...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="glass rounded-xl p-6">
          <div className="p-4 rounded-lg bg-[var(--color-red)]/10 border border-[var(--color-red)]/20 text-sm text-[var(--color-red)]">
            {error}
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--color-text-muted)]">Providers</span>
                <Server size={16} className="text-[var(--color-primary)]" />
              </div>
              <p className="text-2xl font-bold text-white">{totalProviders}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--color-text-muted)]">Configured</span>
                <CheckCircle2 size={16} className="text-[var(--color-green)]" />
              </div>
              <p className="text-2xl font-bold text-[var(--color-green)]">{configuredCount}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--color-text-muted)]">Unconfigured</span>
                <XCircle size={16} className="text-[var(--color-red)]" />
              </div>
              <p className="text-2xl font-bold text-[var(--color-red)]">{totalProviders - configuredCount}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--color-text-muted)]">AI Modules</span>
                <BrainCircuit size={16} className="text-[var(--color-accent)]" />
              </div>
              <p className="text-2xl font-bold text-white">{data.modules.length}</p>
            </div>
          </div>

          {/* Provider Order */}
          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <ListOrdered size={18} className="text-[var(--color-primary)]" />
              <h2 className="text-lg font-semibold text-white">LLM Provider Order</h2>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              Providers are tried in this order until one responds. Set via <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-primary-light)]">LLM_PROVIDER_ORDER</code> env var.
            </p>
            <div className="flex flex-wrap gap-2">
              {data.providers.order.map((id, i) => {
                const prov = data.providers.providers.find((p) => p.id === id);
                const color = PROVIDER_COLORS[id] || 'var(--color-text-muted)';
                return (
                  <div
                    key={id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    <span className="text-xs opacity-60">#{i + 1}</span>
                    <span className="capitalize">{id}</span>
                    {prov?.configured && <CheckCircle2 size={12} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Provider Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedProviders.map((provider) => {
              const color = PROVIDER_COLORS[provider.id] || 'var(--color-text-muted)';
              const priority = data.providers.order.indexOf(provider.id) + 1;
              return (
                <div key={provider.id} className="glass rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {provider.id.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold capitalize">{provider.id}</h3>
                        <p className="text-xs text-[var(--color-text-muted)]">{provider.keyVar}</p>
                      </div>
                    </div>
                    {provider.configured ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-green)]/10 text-[var(--color-green)]">
                        <CheckCircle2 size={10} />
                        Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-red)]/10 text-[var(--color-red)]">
                        <XCircle size={10} />
                        Missing
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-text-muted)]">Priority</span>
                      <span className="text-white font-medium">#{priority}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)]">Models</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {provider.models.split(', ').map((m) => (
                          <span
                            key={m}
                            className="px-2 py-0.5 rounded text-xs bg-[var(--color-surface)] text-[var(--color-text-muted)]"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI Modules Table */}
          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={18} className="text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold text-white">AI Modules ({data.modules.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-3 px-3 text-[var(--color-text-muted)] font-medium">#</th>
                    <th className="text-left py-3 px-3 text-[var(--color-text-muted)] font-medium">Module</th>
                    <th className="text-left py-3 px-3 text-[var(--color-text-muted)] font-medium">ID</th>
                    <th className="text-left py-3 px-3 text-[var(--color-text-muted)] font-medium">File</th>
                  </tr>
                </thead>
                <tbody>
                  {data.modules.map((mod, i) => (
                    <tr
                      key={mod.id}
                      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)]/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-[var(--color-text-muted)]">{i + 1}</td>
                      <td className="py-2.5 px-3 text-white font-medium">{mod.label}</td>
                      <td className="py-2.5 px-3">
                        <code className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-primary-light)] text-xs">
                          {mod.id}
                        </code>
                      </td>
                      <td className="py-2.5 px-3 text-[var(--color-text-muted)] text-xs font-mono">
                        {mod.path}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
