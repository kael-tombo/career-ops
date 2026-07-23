'use client';

import { useState } from 'react';
import { useDashboard } from '@/components/useDashboard';
import { Globe, Target, Zap, Shield, Settings, Play, Loader2, CheckCircle2, AlertCircle, ExternalLink, Search } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function MassApplyPage() {
  const { data, loading } = useDashboard();
  const [minScore, setMinScore] = useState(3.5);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [mode, setMode] = useState<'dry-run' | 'auto'>('dry-run');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ applied: number; skipped: number; failed: number } | null>(null);

  if (loading || !data) return <div className="text-center py-20 text-[var(--color-text-muted)]">Loading...</div>;

  const eligible = data.applications.filter(a => {
    const score = parseFloat(a.score);
    return !isNaN(score) && score >= minScore;
  }).length;

  const pipelineCount = data.pipeline?.items?.length || 0;

  const handleMassScan = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mass-scan', payload: {} }),
      });
      const j = await res.json();
      if (j.jobId) {
        // Poll for completion
        const check = setInterval(async () => {
          const r = await fetch(`${API}/api/jobs/${j.jobId}`, { cache: 'no-store' });
          const status = await r.json();
          if (status.state === 'completed') {
            clearInterval(check);
            setRunning(false);
            setResult({ applied: 0, skipped: 0, failed: 0 });
          } else if (status.state === 'dead') {
            clearInterval(check);
            setRunning(false);
          }
        }, 2000);
      }
    } catch { setRunning(false); }
  };

  const handleMassApply = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'mass-apply',
          payload: { minScore, dailyLimit, dryRun: mode === 'dry-run' },
        }),
      });
      const j = await res.json();
      if (j.jobId) {
        const check = setInterval(async () => {
          const r = await fetch(`${API}/api/jobs/${j.jobId}`, { cache: 'no-store' });
          const status = await r.json();
          if (status.state === 'completed') {
            clearInterval(check);
            setRunning(false);
            setResult(status.result ? JSON.parse(status.result) : { applied: 0, skipped: 0, failed: 0 });
          } else if (status.state === 'dead') {
            clearInterval(check);
            setRunning(false);
          }
        }, 2000);
      }
    } catch { setRunning(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mass Apply</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Automated job discovery and application engine
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Target size={20} className="text-[var(--color-primary-light)]" />
            <div>
              <div className="text-2xl font-bold text-white">{pipelineCount}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Pipeline entries</div>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-[var(--color-green)]" />
            <div>
              <div className="text-2xl font-bold text-white">{eligible}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Eligible (≥{minScore})</div>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Zap size={20} className="text-[var(--color-amber)]" />
            <div>
              <div className="text-2xl font-bold text-white">{dailyLimit}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Daily limit</div>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Globe size={20} className="text-[var(--color-lavender)]" />
            <div>
              <div className="text-2xl font-bold text-white">{data.reports.length}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Reports generated</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="glass rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Configuration</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="text-xs text-[var(--color-text-muted)] block mb-2">Minimum Score Threshold</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={minScore}
                onChange={e => setMinScore(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-bold text-white w-8">{minScore}</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] block mb-2">Daily Application Limit</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={dailyLimit}
                onChange={e => setDailyLimit(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-bold text-white w-8">{dailyLimit}</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] block mb-2">Application Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('dry-run')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  mode === 'dry-run'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                🔍 Review Only
              </button>
              <button
                onClick={() => setMode('auto')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  mode === 'auto'
                    ? 'bg-[var(--color-amber)] text-black'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                🚀 Auto-Submit
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleMassScan}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/20 disabled:opacity-50 transition-all"
          >
            {running ? <><Loader2 size={16} className="animate-spin" /> Scanning...</> : <><Globe size={16} /> Discover Jobs</>}
          </button>

          <button
            onClick={handleMassApply}
            disabled={running || eligible === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-green)]/10 text-[var(--color-green)] hover:bg-[var(--color-green)]/20 disabled:opacity-50 transition-all"
            title={mode === 'dry-run' ? 'Opens browser for manual review' : 'Auto-submits applications'}
          >
            {running ? <><Loader2 size={16} className="animate-spin" /> Applying...</> : <><Zap size={16} /> {mode === 'dry-run' ? 'Start Review Queue' : 'Start Mass Apply'}</>}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Results</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-[var(--color-green)]/10">
              <div className="text-2xl font-bold text-[var(--color-green)]">{result.applied}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Applied</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-[var(--color-amber)]/10">
              <div className="text-2xl font-bold text-[var(--color-amber)]">{result.skipped}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Skipped</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-[var(--color-red)]/10">
              <div className="text-2xl font-bold text-[var(--color-red)]">{result.failed}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Failed</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick guide */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-3">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[var(--color-text-muted)]">
          <div className="p-3 rounded-lg bg-[var(--color-surface)]">
            <div className="text-[var(--color-primary-light)] font-semibold mb-1">1. Discover</div>
            Mass scan searches Google Jobs, LinkedIn, Indeed, Glassdoor, and 30+ ATS platforms for matching roles.
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-surface)]">
            <div className="text-[var(--color-primary-light)] font-semibold mb-1">2. Score &amp; Filter</div>
            Only jobs meeting your score threshold are targeted. Configurable daily limits prevent spam.
          </div>
          <div className="p-3 rounded-lg bg-[var(--color-surface)]">
            <div className="text-[var(--color-primary-light)] font-semibold mb-1">3. Apply</div>
            Review mode opens each application in a visible browser. Auto-submit sends them.
          </div>
        </div>
      </div>
    </div>
  );
}
