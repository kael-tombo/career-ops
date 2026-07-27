'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Loader2, FileText, Zap, TrendingUp, ArrowUp } from 'lucide-react';
import { API_URL } from '@/lib/api';

export default function AIQualityPage() {
  const [cvInput, setCvInput] = useState('');
  const [jdInput, setJdInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'score' | 'improve'>('score');

  const scoreApplication = async () => {
    if (!cvInput.trim() || !jdInput.trim()) return;
    setLoading(true);
    try {
      const action = tab === 'improve' ? 'autoImproveCV' : 'scoreApplicationQuality';
      const body = tab === 'improve'
        ? JSON.stringify({ tailoredCvContent: cvInput, jdText: jdInput })
        : JSON.stringify({ tailoredCvContent: cvInput, jdText: jdInput });

      const res = await fetch(`${API_URL}/api/ai/quality-scorer/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) setResult(json.data);
    } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Application Quality</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Score and improve your CV before submitting</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-surface)] w-fit">
        <button onClick={() => setTab('score')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'score' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}>Score CV</button>
        <button onClick={() => setTab('improve')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === 'improve' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}>Auto-Improve</button>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              {tab === 'improve' ? 'Your Current CV (tailored)' : 'Your CV Content'}
            </label>
            <textarea
              value={cvInput}
              onChange={e => setCvInput(e.target.value)}
              rows={10}
              placeholder="Paste your CV content here..."
              className="w-full px-4 py-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">Job Description</label>
            <textarea
              value={jdInput}
              onChange={e => setJdInput(e.target.value)}
              rows={10}
              placeholder="Paste the job description here..."
              className="w-full px-4 py-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
            />
          </div>
        </div>

        <button
          onClick={scoreApplication}
          disabled={loading || !cvInput.trim() || !jdInput.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          {tab === 'improve' ? 'Auto-Improve CV' : 'Score Application'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {/* Score */}
          {result.overallScore !== undefined && (
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Quality Score</h2>
                <div className="text-center">
                  <div className={`text-4xl font-bold ${result.overallScore >= 80 ? 'text-[var(--color-green)]' : result.overallScore >= 60 ? 'text-[var(--color-amber, #f0c040)]' : 'text-[var(--color-red)]'}`}>
                    {result.overallScore}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">/100</p>
                </div>
              </div>

              {result.scoreBreakdown && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {Object.entries(result.scoreBreakdown).map(([key, val]) => (
                    <div key={key} className="p-3 rounded-lg bg-[var(--color-surface)] text-center">
                      <p className="text-xs text-[var(--color-text-muted)] mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                      <p className="text-lg font-bold text-white">{val as number}/100</p>
                    </div>
                  ))}
                </div>
              )}

              {result.estimatedRank && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Estimated rank: <span className="text-white font-medium">{result.estimatedRank}</span>
                </p>
              )}

              {result.readyToSubmit !== undefined && (
                <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${result.readyToSubmit ? 'bg-[var(--color-green)]/10 text-[var(--color-green)]' : 'bg-[var(--color-red)]/10 text-[var(--color-red)]'}`}>
                  {result.readyToSubmit ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  <span className="text-sm font-medium">{result.readyToSubmit ? 'Ready to submit!' : 'Needs improvement before submitting'}</span>
                </div>
              )}
            </div>
          )}

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {result.strengths?.length > 0 && (
              <div className="glass rounded-xl p-6">
                <h3 className="text-sm font-semibold text-[var(--color-green)] mb-3 flex items-center gap-1.5"><TrendingUp size={14} /> Strengths</h3>
                <ul className="space-y-2">
                  {result.strengths.map((s: string, i: number) => (
                    <li key={i} className="text-sm text-[var(--color-text)] flex items-start gap-2">
                      <CheckCircle size={12} className="text-[var(--color-green)] mt-1 shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.weaknesses?.length > 0 && (
              <div className="glass rounded-xl p-6">
                <h3 className="text-sm font-semibold text-[var(--color-red)] mb-3 flex items-center gap-1.5"><AlertTriangle size={14} /> Weaknesses</h3>
                <ul className="space-y-2">
                  {result.weaknesses.map((w: string, i: number) => (
                    <li key={i} className="text-sm text-[var(--color-text)] flex items-start gap-2">
                      <XCircle size={12} className="text-[var(--color-red)] mt-1 shrink-0" /> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Quick Fixes */}
          {result.quickFixes?.length > 0 && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Zap size={16} className="text-[var(--color-amber, #f0c040)]" /> Quick Fixes</h3>
              <div className="space-y-2">
                {result.quickFixes.map((f: any, i: number) => (
                  <div key={i} className={`p-3 rounded-lg flex items-start gap-3 ${f.priority === 'high' ? 'bg-[var(--color-red)]/10 border border-[var(--color-red)]/20' : f.priority === 'medium' ? 'bg-[var(--color-amber)]/10 border border-[var(--color-amber)]/20' : 'bg-[var(--color-surface)]'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${f.priority === 'high' ? 'bg-[var(--color-red)]/20 text-[var(--color-red)]' : f.priority === 'medium' ? 'bg-[var(--color-amber, #f0c040)]/20 text-[var(--color-amber, #f0c040)]' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'}`}>{i + 1}</div>
                    <div>
                      <p className="text-sm text-white">{f.action}</p>
                      {f.expectedImpact && <p className="text-xs text-[var(--color-green)] mt-0.5">Impact: {f.expectedImpact}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improved CV */}
          {result.improvedCv && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Improved CV</h3>
              <pre className="text-sm text-[var(--color-text)] whitespace-pre-wrap font-sans bg-[var(--color-surface)] p-4 rounded-lg max-h-96 overflow-y-auto">{result.improvedCv}</pre>
              {result.changes?.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-[var(--color-green)] mb-2">Changes Made</h4>
                  <ul className="space-y-1">
                    {result.changes.map((c: string, i: number) => (
                      <li key={i} className="text-sm text-[var(--color-text)] flex items-start gap-2">
                        <ArrowUp size={12} className="text-[var(--color-green)] mt-1 shrink-0" /> {c.replace(/^- /, '')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
