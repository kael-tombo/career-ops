'use client';

import { useState, useEffect } from 'react';
import { Brain, ThumbsUp, ThumbsDown, Building2, TrendingUp, AlertTriangle, CheckCircle2, XCircle, ChevronRight, Star, Activity, Zap, RefreshCw } from 'lucide-react';
import { API_URL, fetchMemorySnapshot, fetchMemoryPreferences, fetchPreferenceSummary, submitMemoryFeedback } from '@/lib/api';

type Tab = 'overview' | 'companies' | 'preferences' | 'patterns' | 'feedback';

export default function MemoryPage() {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [preferences, setPreferences] = useState<any[]>([]);
  const [prefSummary, setPrefSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [learnings, setLearnings] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [companyData, setCompanyData] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [briefing, setBriefing] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const snap = await fetchMemorySnapshot();
      if (snap) setSnapshot(snap);

      const prefs = await fetchMemoryPreferences();
      if (prefs) setPreferences(prefs);

      const prefSum = await fetchPreferenceSummary();
      if (prefSum) setPrefSummary(prefSum);

      const [l, f, c, p] = await Promise.all([
        fetch(`${API_URL}/api/memory/learnings`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/api/memory/feedback`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/api/memory/companies`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/api/memory/patterns`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
      ]);
      setLearnings(l || []);
      setFeedback(f || []);
      setCompanyData(c || []);
      setPatterns(p || []);

      const briefRes = await fetch(`${API_URL}/api/memory/briefing`, { cache: 'no-store' });
      if (briefRes.ok) {
        const data = await briefRes.json();
        setBriefing(data.briefing || '');
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: Brain },
    { id: 'companies' as Tab, label: 'Companies', icon: Building2 },
    { id: 'preferences' as Tab, label: 'Preferences', icon: ThumbsUp },
    { id: 'patterns' as Tab, label: 'Patterns', icon: TrendingUp },
    { id: 'feedback' as Tab, label: 'Feedback', icon: Star },
  ];

  const l = snapshot?.learnings || { total: 0, byCategory: [] };
  const fb = snapshot?.feedback || { total: 0, avgUserScore: 0, avgRating: 0, byAction: [] };
  const comp = snapshot?.companies || { total: 0, totalApplied: 0, avgResponseRate: 0 };
  const pref = snapshot?.preferences || { categories: [], topLikes: [], topDislikes: [] };

  if (loading && !snapshot) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading AI memory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Memory & Learning</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            The system remembers everything: <span className="text-[var(--color-primary-light)]">{l.total} facts</span> &middot;{' '}
            <span className="text-[var(--color-green)]">{comp.total} companies tracked</span> &middot;{' '}
            <span className="text-[var(--color-amber)]">{pref.topLikes.length} preferences</span>
          </p>
        </div>
        <button onClick={loadData} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-primary)] transition-colors flex items-center gap-1.5">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Knowledge Base</span>
            <Brain size={16} className="text-[var(--color-primary-light)]" />
          </div>
          <div className="text-lg font-bold text-white">{l.total}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">{l.byCategory.length} categories</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Companies</span>
            <Building2 size={16} className="text-[var(--color-green)]" />
          </div>
          <div className="text-lg font-bold text-white">{comp.total}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">{comp.totalApplied} applied</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Feedback</span>
            <Star size={16} className="text-[var(--color-amber)]" />
          </div>
          <div className="text-lg font-bold text-white">{fb.total}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">Avg rating: {fb.avgRating ? fb.avgRating.toFixed(1) : 'N/A'}</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Response Rate</span>
            <Activity size={16} className="text-[var(--color-purple)]" />
          </div>
          <div className="text-lg font-bold text-white">{comp.avgResponseRate || 0}%</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">Companies responding</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Preferences</span>
            <ThumbsUp size={16} className="text-[var(--color-lavender)]" />
          </div>
          <div className="text-lg font-bold text-white">{pref.topLikes.length + pref.topDislikes.length}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">{pref.categories.length} categories</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)] pb-1 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-t-lg transition-all whitespace-nowrap ${
                tab === t.id ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary-light)] font-semibold border-b-2 border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Learnings by Category */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Learnings by Category</h3>
            {l.byCategory.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] italic">No learnings yet. The AI will populate this as you evaluate jobs.</p>
            ) : (
              <div className="space-y-3">
                {l.byCategory.map((cat: any) => (
                  <div key={cat.category} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface)]">
                    <span className="text-sm text-white capitalize">{cat.category}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--color-text-muted)]">{cat.count} facts</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cat.avg_confidence >= 0.7 ? 'bg-[var(--color-green)]/20 text-[var(--color-green)]' : 'bg-[var(--color-amber)]/20 text-[var(--color-amber)]'}`}>
                        {Math.round(cat.avg_confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Preferences */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Top Preferences</h3>
            {pref.topLikes.length === 0 && pref.topDislikes.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] italic">No preferences yet. Feedback on evaluations builds this.</p>
            ) : (
              <div className="space-y-2">
                {pref.topLikes.slice(0, 8).map((p: any, i: number) => (
                  <div key={`like-${i}`} className="flex items-center gap-2 text-sm">
                    <ThumbsUp size={12} className="text-[var(--color-green)] shrink-0" />
                    <span className="text-white">{p.key}</span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-auto">+{p.signal.toFixed(1)} ({p.count}x)</span>
                  </div>
                ))}
                {pref.topDislikes.slice(0, 5).map((p: any, i: number) => (
                  <div key={`dislike-${i}`} className="flex items-center gap-2 text-sm">
                    <ThumbsDown size={12} className="text-[var(--color-red)] shrink-0" />
                    <span className="text-[var(--color-text-muted)]">{p.key}</span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-auto">{p.signal.toFixed(1)} ({p.count}x)</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Learnings */}
          <div className="lg:col-span-2 glass rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
            {learnings.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] italic">No learning activity yet.</p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {learnings.slice(0, 30).map((l: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded hover:bg-[var(--color-surface)] text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 ${
                      l.category === 'evaluation' ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary-light)]' :
                      l.category === 'preference' ? 'bg-[var(--color-green)]/20 text-[var(--color-green)]' :
                      l.category === 'company' ? 'bg-[var(--color-lavender)]/20 text-[var(--color-lavender)]' :
                      'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                    }`}>{l.category}</span>
                    <span className="text-[var(--color-text)] truncate">{l.key}</span>
                    <span className="text-[var(--color-text-muted)] ml-auto">{Math.round(l.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'companies' && (
        <CompanyTab data={companyData} stats={comp} />
      )}

      {tab === 'preferences' && (
        <PreferencesTab data={preferences} summary={prefSummary} />
      )}

      {tab === 'patterns' && (
        <PatternsTab data={patterns} />
      )}

      {tab === 'feedback' && (
        <FeedbackTab data={feedback} stats={fb} onRefresh={loadData} />
      )}

      {/* Memory Briefing */}
      {briefing && (
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Zap size={16} className="text-[var(--color-amber)]" /> AI Memory Briefing
          </h3>
          <pre className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap font-sans leading-relaxed">{briefing}</pre>
        </div>
      )}
    </div>
  );
}

function CompanyTab({ data, stats }: { data: any[]; stats: any }) {
  const [sortBy, setSortBy] = useState('total_jobs_seen');
  const [filter, setFilter] = useState('');

  const sorted = [...data]
    .filter(c => !filter || c.company.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input type="text" placeholder="Filter companies..." value={filter} onChange={e => setFilter(e.target.value)}
          className="flex-1 px-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)]" />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white">
          <option value="total_jobs_seen">Most Seen</option>
          <option value="total_applied">Most Applied</option>
          <option value="avg_score">Highest Score</option>
          <option value="total_interviewed">Most Interviews</option>
          <option value="last_interaction">Recent</option>
        </select>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)] uppercase">
                <th className="text-left p-3 font-medium">Company</th>
                <th className="text-center p-3 font-medium">Seen</th>
                <th className="text-center p-3 font-medium">Applied</th>
                <th className="text-center p-3 font-medium">Responded</th>
                <th className="text-center p-3 font-medium">Interview</th>
                <th className="text-center p-3 font-medium">Offer</th>
                <th className="text-center p-3 font-medium">Rejected</th>
                <th className="text-center p-3 font-medium">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-[var(--color-text-muted)]">No company data yet</td></tr>
              ) : sorted.map((c: any, i: number) => (
                <tr key={i} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors">
                  <td className="p-3 text-white font-medium">{c.company}</td>
                  <td className="p-3 text-center text-[var(--color-text-muted)]">{c.total_jobs_seen}</td>
                  <td className="p-3 text-center">
                    <span className={c.total_applied > 0 ? 'text-[var(--color-green)]' : 'text-[var(--color-text-muted)]'}>{c.total_applied}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={c.total_responded > 0 ? 'text-[var(--color-lavender)]' : 'text-[var(--color-text-muted)]'}>{c.total_responded}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={c.total_interviewed > 0 ? 'text-[var(--color-purple)]' : 'text-[var(--color-text-muted)]'}>{c.total_interviewed}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={c.total_offers > 0 ? 'text-[var(--color-amber)]' : 'text-[var(--color-text-muted)]'}>{c.total_offers}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={c.total_rejected > 0 ? 'text-[var(--color-red)]' : 'text-[var(--color-text-muted)]'}>{c.total_rejected}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={c.avg_score >= 4 ? 'text-[var(--color-green)]' : 'text-[var(--color-text-muted)]'}>{c.avg_score ? c.avg_score.toFixed(1) : '-'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PreferencesTab({ data, summary }: { data: any[]; summary: any }) {
  const [cat, setCat] = useState('all');

  const categories = summary?.categories || [];
  const filtered = cat === 'all' ? data : data.filter(p => p.category === cat);
  const likes = filtered.filter(p => p.signal > 0).sort((a, b) => b.signal - a.signal);
  const dislikes = filtered.filter(p => p.signal < 0).sort((a, b) => a.signal - b.signal);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <ThumbsUp size={14} className="text-[var(--color-green)]" /> Likes ({likes.length})
        </h3>
        {likes.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] italic">No likes recorded yet</p>
        ) : (
          <div className="space-y-2">
            {likes.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-surface)]">
                <ThumbsUp size={12} className="text-[var(--color-green)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white truncate block">{p.key}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{p.category} &middot; {p.count}x</span>
                </div>
                <span className="text-xs text-[var(--color-green)] font-semibold">+{p.signal.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <ThumbsDown size={14} className="text-[var(--color-red)]" /> Dislikes ({dislikes.length})
        </h3>
        {dislikes.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] italic">No dislikes recorded yet</p>
        ) : (
          <div className="space-y-2">
            {dislikes.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--color-surface)]">
                <ThumbsDown size={12} className="text-[var(--color-red)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[var(--color-text-muted)] truncate block">{p.key}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{p.category} &middot; {p.count}x</span>
                </div>
                <span className="text-xs text-[var(--color-red)] font-semibold">{p.signal.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Summary */}
      {categories.length > 0 && (
        <div className="lg:col-span-2 glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">By Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categories.map((c: any) => (
              <div key={c.category} className="p-3 rounded-lg bg-[var(--color-surface)] text-center">
                <div className="text-lg font-bold text-white">{c.count}</div>
                <div className="text-xs text-[var(--color-text-muted)] capitalize">{c.category}</div>
                {c.total_signal !== undefined && (
                  <div className={`text-xs mt-1 ${c.total_signal >= 0 ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}`}>
                    Signal: {c.total_signal >= 0 ? '+' : ''}{c.total_signal.toFixed(1)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PatternsTab({ data }: { data: any[] }) {
  const byType = data.reduce((acc: any, p: any) => {
    if (!acc[p.pattern_type]) acc[p.pattern_type] = [];
    acc[p.pattern_type].push(p);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-4">
      {Object.keys(byType).length === 0 ? (
        <div className="glass rounded-xl p-6 text-center">
          <p className="text-sm text-[var(--color-text-muted)] italic">No patterns recognized yet. Pattern recognition builds over time as you evaluate and apply.</p>
        </div>
      ) : Object.entries(byType).map(([type, patterns]) => (
        <div key={type} className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-3 capitalize flex items-center gap-2">
            <TrendingUp size={14} className="text-[var(--color-primary-light)]" />
            {type.replace(/_/g, ' ')} ({(patterns as any[]).length})
          </h3>
          <div className="space-y-1">
            {(patterns as any[]).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-[var(--color-surface)] text-sm">
                <span className="text-white flex-1">{p.pattern}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  p.weight >= 0.5 ? 'bg-[var(--color-green)]/20 text-[var(--color-green)]' :
                  p.weight <= -0.5 ? 'bg-[var(--color-red)]/20 text-[var(--color-red)]' :
                  'bg-[var(--color-amber)]/20 text-[var(--color-amber)]'
                }`}>
                  {p.weight >= 0 ? '+' : ''}{p.weight.toFixed(2)}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">{p.sample_size}x</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedbackTab({ data, stats, onRefresh }: { data: any[]; stats: any; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company: '', role: '', url: '', originalScore: '', userScore: '', userRating: '3', userNotes: '', actionTaken: '' });

  const submit = async () => {
    await submitMemoryFeedback({
      company: form.company,
      role: form.role,
      url: form.url,
      originalScore: form.originalScore ? parseFloat(form.originalScore) : undefined,
      userScore: form.userScore ? parseFloat(form.userScore) : undefined,
      userRating: parseInt(form.userRating),
      userNotes: form.userNotes,
      actionTaken: form.actionTaken,
    });
    setShowForm(false);
    setForm({ company: '', role: '', url: '', originalScore: '', userScore: '', userRating: '3', userNotes: '', actionTaken: '' });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Feedback', value: stats.total, color: 'var(--color-primary-light)' },
            { label: 'Avg Score', value: stats.avgUserScore ? Number(stats.avgUserScore).toFixed(1) : 'N/A', color: 'var(--color-green)' },
            { label: 'Avg Rating', value: stats.avgRating ? (stats.avgRating.toFixed(1) + '/5') : 'N/A', color: 'var(--color-amber)' },
            { label: 'With Notes', value: data.filter((d: any) => d.user_notes).length, color: 'var(--color-lavender)' },
          ].map((s: any) => (
            <div key={s.label} className="glass rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setShowForm(!showForm)}
        className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-primary)]/20 text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/30 transition-colors">
        {showForm ? 'Cancel' : '+ New Feedback'}
      </button>

      {showForm && (
        <div className="glass rounded-xl p-6 space-y-3">
          <h3 className="text-sm font-semibold text-white">Record Feedback</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Company *" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)]" />
            <input placeholder="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)]" />
            <input placeholder="URL" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)]" />
            <select value={form.actionTaken} onChange={e => setForm({ ...form, actionTaken: e.target.value })}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white">
              <option value="">Action taken...</option>
              <option value="applied">Applied</option>
              <option value="skipped">Skipped</option>
              <option value="saved">Saved for later</option>
              <option value="discarded">Discarded</option>
            </select>
            <input type="number" step="0.1" min="1" max="5" placeholder="Original score" value={form.originalScore} onChange={e => setForm({ ...form, originalScore: e.target.value })}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)]" />
            <input type="number" step="0.1" min="1" max="5" placeholder="Your score" value={form.userScore} onChange={e => setForm({ ...form, userScore: e.target.value })}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)]" />
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(r => (
                <button key={r} onClick={() => setForm({ ...form, userRating: String(r) })}
                  className={`p-2 rounded ${parseInt(form.userRating) >= r ? 'text-[var(--color-amber)]' : 'text-[var(--color-text-muted)]'}`}>
                  <Star size={16} fill={parseInt(form.userRating) >= r ? 'var(--color-amber)' : 'none'} />
                </button>
              ))}
            </div>
          </div>
          <textarea placeholder="Notes (what did the AI get right/wrong?)" value={form.userNotes} onChange={e => setForm({ ...form, userNotes: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)]" rows={2} />
          <button onClick={submit} disabled={!form.company} className="px-4 py-2 text-sm rounded-lg bg-[var(--color-primary)]/20 text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/30 transition-colors disabled:opacity-50">
            Submit Feedback
          </button>
        </div>
      )}

      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Feedback History</h3>
        {data.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] italic">No feedback yet</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.map((f: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-[var(--color-surface)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium">{f.company}{f.role ? ` — ${f.role}` : ''}</span>
                  <div className="flex items-center gap-2">
                    {f.user_score && <span className="text-xs text-[var(--color-primary-light)]">Score: {f.user_score}</span>}
                    {f.user_rating && <span className="text-xs text-[var(--color-amber)]">{'★'.repeat(f.user_rating)}{'☆'.repeat(5 - f.user_rating)}</span>}
                  </div>
                </div>
                {f.action_taken && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary-light)] uppercase">{f.action_taken}</span>}
                {f.user_notes && <p className="text-xs text-[var(--color-text-muted)] mt-1">{f.user_notes}</p>}
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{new Date(f.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
