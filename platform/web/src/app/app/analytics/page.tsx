'use client';
import { useApi } from '@/lib/api';
import styles from '../shared.module.css';

interface AnalyticsData {
  totalJobs: number;
  totalEvaluations: number;
  funnel: Record<string, number>;
  archetypes: Record<string, number>;
  scores: { date: string; score: number }[];
}

function GapAnalysis() {
  const { data, isLoading, error } = useApi<{ analysis: string }>('/api/profile/gaps');

  return (
    <div className={`${styles.card} card`} style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
      <h2>💡 AI Skill Gap Analyzer</h2>
      <p className={styles.muted} style={{ marginBottom: '1rem' }}>
        Synthesized from your low-scoring evaluations to identify critical missing skills and archetype weaknesses.
      </p>
      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ctp-subtext0)' }}>
          Analyzing your evaluations... This takes a moment.
        </div>
      ) : error ? (
        <div style={{ color: 'var(--ctp-red)' }}>Failed to load gap analysis.</div>
      ) : (
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontFamily: 'var(--ctp-font-sans)' }}>
          {data?.analysis || 'No data.'}
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading, error } = useApi<AnalyticsData>('/api/profile/analytics');

  if (isLoading) return <div className={styles.page}>Loading analytics...</div>;
  if (error || !data) return <div className={styles.page}>Error loading analytics.</div>;

  const funnelStages = ['Inbox', 'Evaluated', 'Applied', 'Interview', 'Offer'];
  const maxFunnel = Math.max(...Object.values(data.funnel), 1);

  const archetypeColors = ['var(--ctp-blue)', 'var(--ctp-mauve)', 'var(--ctp-peach)', 'var(--ctp-green)', 'var(--ctp-yellow)'];
  const archetypesList = Object.entries(data.archetypes).sort((a, b) => b[1] - a[1]);
  const maxArchetype = Math.max(...archetypesList.map(a => a[1]), 1);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Career Analytics</h1>
          <p className={styles.subtitle}>Insights into your pipeline, archetypes, and evaluation trends.</p>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Funnel Chart */}
        <div className={`${styles.card} card`}>
          <h2>Pipeline Funnel</h2>
          <p className={styles.muted} style={{ marginBottom: '1rem' }}>Conversion rates across stages</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {funnelStages.map(stage => {
              const count = data.funnel[stage] || 0;
              const width = `${(count / maxFunnel) * 100}%`;
              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '80px', fontSize: '0.9rem', color: 'var(--ctp-subtext0)' }}>{stage}</div>
                  <div style={{ flex: 1, height: '24px', backgroundColor: 'var(--ctp-surface1)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: width, height: '100%', backgroundColor: 'var(--ctp-blue)', transition: 'width 1s ease-out' }} />
                  </div>
                  <div style={{ width: '30px', textAlign: 'right', fontWeight: 'bold' }}>{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Archetypes Chart */}
        <div className={`${styles.card} card`}>
          <h2>Archetype Distribution</h2>
          <p className={styles.muted} style={{ marginBottom: '1rem' }}>AI classifications of your jobs</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {archetypesList.length === 0 && <p className={styles.muted}>No archetypes detected yet.</p>}
            {archetypesList.map(([arch, count], i) => {
              const width = `${(count / maxArchetype) * 100}%`;
              const color = archetypeColors[i % archetypeColors.length];
              return (
                <div key={arch} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '120px', fontSize: '0.9rem', color: 'var(--ctp-subtext0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={arch}>
                    {arch}
                  </div>
                  <div style={{ flex: 1, height: '24px', backgroundColor: 'var(--ctp-surface1)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: width, height: '100%', backgroundColor: color, transition: 'width 1s ease-out' }} />
                  </div>
                  <div style={{ width: '30px', textAlign: 'right', fontWeight: 'bold' }}>{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Score Trends */}
        <div className={`${styles.card} card`} style={{ gridColumn: '1 / -1' }}>
          <h2>Evaluation Score Trends</h2>
          <p className={styles.muted} style={{ marginBottom: '1rem' }}>AI scores of recently discovered jobs</p>
          <div style={{ height: '200px', width: '100%', position: 'relative', borderBottom: '1px solid var(--ctp-surface2)', borderLeft: '1px solid var(--ctp-surface2)', padding: '1rem 0' }}>
            {data.scores.length === 0 && <p className={styles.muted} style={{ padding: '1rem' }}>No scores available yet.</p>}
            {data.scores.map((s, i) => {
              const x = `${(i / Math.max(data.scores.length - 1, 1)) * 100}%`;
              const y = `${100 - (s.score / 5) * 100}%`; // 5 is max score
              return (
                <div key={i} style={{ position: 'absolute', left: x, top: y, width: '10px', height: '10px', backgroundColor: 'var(--ctp-peach)', borderRadius: '50%', transform: 'translate(-5px, -5px)' }} title={`${s.date}: ${s.score}/5`} />
              );
            })}
            {/* Simple SVG Line connecting dots */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}>
              <polyline 
                fill="none" 
                stroke="var(--ctp-peach)" 
                strokeWidth="2"
                points={data.scores.map((s, i) => `${(i / Math.max(data.scores.length - 1, 1)) * 100},${100 - (s.score / 5) * 100}`).join(' ')} 
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', color: 'var(--ctp-subtext0)', fontSize: '0.8rem' }}>
            <span>{data.scores[0]?.date || ''}</span>
            <span>{data.scores[data.scores.length - 1]?.date || ''}</span>
          </div>
        </div>

        {/* AI Skill Gap Analyzer */}
        <GapAnalysis />
      </div>
    </div>
  );
}
