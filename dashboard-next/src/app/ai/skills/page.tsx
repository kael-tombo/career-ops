'use client';

import { useState, useEffect } from 'react';
import { Brain, Target, BookOpen, Clock, Loader2, ChevronDown, ChevronUp, Zap, ExternalLink } from 'lucide-react';
import { useDashboard } from '@/components/useDashboard';
import { API_URL } from '@/lib/api';

export default function AISkillsPage() {
  const { data, loading } = useDashboard();
  const [jdInput, setJdInput] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'analyze' | 'history'>('analyze');

  const analyzeSkills = async () => {
    if (!jdInput.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_URL}/api/ai/skill-gap/analyzeSkillGap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText: jdInput }),
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) setAnalysis(json.data);
    } catch {}
    setAnalyzing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Skill Gap Analyzer</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Compare your skills against any job description</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-surface)] w-fit">
        <button onClick={() => setActiveTab('analyze')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'analyze' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}>Analyze</button>
        <button onClick={() => setActiveTab('history')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}>History</button>
      </div>

      {activeTab === 'analyze' && (
        <>
          <div className="glass rounded-xl p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">Job Description</label>
              <textarea
                value={jdInput}
                onChange={e => setJdInput(e.target.value)}
                rows={8}
                placeholder="Paste a job description here to analyze skill gaps..."
                className="w-full px-4 py-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-white placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
              />
            </div>
            <button
              onClick={analyzeSkills}
              disabled={analyzing || !jdInput.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 transition-all disabled:opacity-50"
            >
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
              Analyze Skill Gap
            </button>
          </div>

          {analyzing && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
            </div>
          )}

          {analysis && !analyzing && (
            <>
              {/* Score Card */}
              <div className="glass rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Analysis Results</h2>
                  <span className={`badge ${analysis.overallGapScore === 'low' ? 'badge-green' : analysis.overallGapScore === 'medium' ? 'badge-lavender' : 'badge-red'}`}>
                    Gap: {analysis.overallGapScore}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium ${analysis.shouldApply ? 'bg-[var(--color-green)]/10 text-[var(--color-green)]' : 'bg-[var(--color-red)]/10 text-[var(--color-red)]'}`}>
                    {analysis.shouldApply ? '✓ Recommended to apply' : '✗ Consider upskilling first'}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Existing Skills */}
                  {analysis.existingSkills?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-green)] mb-3 flex items-center gap-1.5"><Target size={14} /> Your Matching Skills</h3>
                      <div className="space-y-2">
                        {analysis.existingSkills.map((s: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-surface)]">
                            <span className="text-sm text-white">{s.name}</span>
                            <span className={`text-xs ${s.matchLevel === 'exact' ? 'text-[var(--color-green)]' : s.matchLevel === 'partial' ? 'text-[var(--color-amber, #f0c040)]' : 'text-[var(--color-text-muted)]'}`}>{s.matchLevel}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gap Skills */}
                  {analysis.gapSkills?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--color-red)] mb-3 flex items-center gap-1.5"><BookOpen size={14} /> Skills to Learn</h3>
                      <div className="space-y-2">
                        {analysis.gapSkills.map((s: any, i: number) => (
                          <div key={i} className="p-2 rounded-lg bg-[var(--color-surface)]">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-white">{s.name}</span>
                              <span className={`text-xs ${s.importance === 'critical' ? 'text-[var(--color-red)]' : s.importance === 'important' ? 'text-[var(--color-amber, #f0c040)]' : 'text-[var(--color-text-muted)]'}`}>{s.importance}</span>
                            </div>
                            {s.estimatedTimeToLearn && (
                              <p className="text-xs text-[var(--color-text-muted)] mt-1">{s.estimatedTimeToLearn} to learn</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Wins */}
                {analysis.quickWins?.length > 0 && (
                  <div className="mt-4 p-4 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
                    <h3 className="text-sm font-semibold text-[var(--color-accent)] mb-2 flex items-center gap-1.5"><Zap size={14} /> Quick Wins</h3>
                    <ul className="space-y-1">
                      {analysis.quickWins.map((w: string, i: number) => (
                        <li key={i} className="text-sm text-[var(--color-text)]">{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="glass rounded-xl p-6">
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
            Skill gap analysis history will appear here as you analyze job descriptions.
          </p>
        </div>
      )}
    </div>
  );
}
