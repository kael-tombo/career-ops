'use client';
import { useState } from 'react';
import { useApi, fetchApi } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import styles from './page.module.css';

interface Evaluation {
  score: string | null;
  archetype: string | null;
  legitimacy: string | null;
  blockA: string | null;
  blockB: string | null;
  blockC: string | null;
  blockD: string | null;
  blockE: string | null;
  blockF: string | null;
  blockG: string | null;
}

interface Job {
  id: string;
  company: string;
  role: string;
  url: string | null;
  status: string;
  evaluation?: Evaluation;
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const { data: job, error, isLoading, mutate } = useApi<Job>(`/api/jobs/${params.id}`);
  const { getToken } = useAuth();
  const [outreachDraft, setOutreachDraft] = useState<string | null>(null);
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false);

  if (isLoading) return <div className={styles.page}>Loading job details...</div>;
  if (error || !job) return <div className={styles.page}>Error loading job details.</div>;

  const handleGenerateCV = async () => {
    try {
      await fetchApi(`/api/cv/generate`, {
        method: 'POST',
        body: JSON.stringify({ jobId: job.id }),
      }, getToken);
      alert('CV Generation queued!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkApplied = async () => {
    try {
      await fetchApi(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Applied' }),
      }, getToken);
      mutate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateOutreach = async () => {
    try {
      setIsGeneratingOutreach(true);
      const res = await fetchApi(`/api/jobs/${job.id}/outreach`, { method: 'POST' }, getToken);
      setOutreachDraft(res.draft);
    } catch (err: any) {
      if (err?.message?.includes('402') || err?.message?.includes('UPGRADE')) {
        alert('Smart Outreach requires a Pro plan. Upgrade in Settings.');
      } else {
        console.error(err);
        alert('Failed to generate outreach draft.');
      }
    } finally {
      setIsGeneratingOutreach(false);
    }
  };

  const evalData = job.evaluation || {} as Partial<Evaluation>;
  const blocks = [
    { id: 'A', title: 'Role Summary', content: evalData.blockA || 'Pending evaluation...', icon: '📋' },
    { id: 'B', title: 'CV Match', content: evalData.blockB || 'Pending evaluation...', icon: '✅' },
    { id: 'C', title: 'Level Strategy', content: evalData.blockC || 'Pending evaluation...', icon: '🎯' },
    { id: 'D', title: 'Compensation Research', content: evalData.blockD || 'Pending evaluation...', icon: '💰' },
    { id: 'E', title: 'Personalization Hook', content: evalData.blockE || 'Pending evaluation...', icon: '✍️' },
    { id: 'F', title: 'Interview Prep', content: evalData.blockF || 'Pending evaluation...', icon: '🎤', wide: true },
    { id: 'G', title: 'Posting Legitimacy', content: evalData.blockG || 'Pending evaluation...', icon: '🔐' },
  ];

  const scoreNum = evalData.score ? parseFloat(evalData.score) : 0;
  const scorePercent = (scoreNum / 5) * 100;
  const circumference = 2 * Math.PI * 44;
  const offset = circumference - (scorePercent / 100) * circumference;

  return (
    <div className={styles.page}>
      {/* ── Back ─────────────────────────────────────────────────────── */}
      <a href="/app/dashboard" className={styles.back}>← Back to Pipeline</a>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.companyBadge}>{job.company[0]}</div>
          <div>
            <h1 className={styles.title}>{job.role}</h1>
            <div className={styles.meta}>
              <span className={styles.company}>{job.company}</span>
              <span className={styles.dot}>·</span>
              <span className="badge badge-mauve">{evalData.archetype || 'Analyzing...'}</span>
              <span className={styles.dot}>·</span>
              {job.url && <a href={job.url} target="_blank" rel="noreferrer" className={styles.urlLink}>View Posting ↗</a>}
            </div>
          </div>
        </div>

        <div className={styles.headerRight}>
          {/* Score Ring */}
          <div className={styles.scoreRing}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--ctp-surface1)" strokeWidth="8"/>
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--ctp-blue)" strokeWidth="8"
                strokeDasharray={circumference} strokeDashoffset={offset}
                strokeLinecap="round" style={{transform:'rotate(-90deg)', transformOrigin:'50% 50%', transition:'stroke-dashoffset 1s ease'}}
              />
            </svg>
            <div className={styles.scoreText}>
              <span className={styles.scoreNum}>{evalData.score || '-'}</span>
              <span className={styles.scoreDenom}>/5</span>
            </div>
          </div>

          <div className={styles.actions}>
            <button className="btn btn-primary btn-sm" id="btn-generate-cv" onClick={handleGenerateCV}>📄 Generate CV</button>
            <button className="btn btn-ghost btn-sm" id="btn-mark-applied" onClick={handleMarkApplied}>✅ Mark Applied</button>
          </div>
        </div>
      </div>

      {/* ── Legitimacy bar ───────────────────────────────────────────── */}
      <div className={`${styles.legitimacyBar} card`}>
        <span className={styles.legIcon}>🔐</span>
        <span className={styles.legText}>{evalData.legitimacy || 'Checking legitimacy...'}</span>
        <span className="badge badge-green">{job.status}</span>
      </div>

      {/* ── Smart Outreach ────────────────────────────────────────────── */}
      <div className={`${styles.block} card ${styles.blockWide}`} style={{ marginTop: '1rem', marginBottom: '2rem' }}>
        <div className={styles.blockHeader}>
          <span className={styles.blockIcon}>✉️</span>
          <span className={styles.blockTitle}>Smart Outreach</span>
          <button 
            className="btn btn-primary btn-sm" 
            style={{ marginLeft: 'auto' }}
            onClick={handleGenerateOutreach}
            disabled={isGeneratingOutreach}
          >
            {isGeneratingOutreach ? 'Generating...' : '✨ Generate Cold Email'}
          </button>
        </div>
        <div className={styles.blockContent}>
          {!outreachDraft ? (
            <p className={styles.muted}>Generate a personalized cold email to the hiring manager based on your evaluation.</p>
          ) : (
            <textarea 
              className="input" 
              style={{ width: '100%', minHeight: '200px', fontFamily: 'var(--ctp-font-mono)', lineHeight: 1.5, padding: '1rem' }}
              value={outreachDraft}
              onChange={(e) => setOutreachDraft(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* ── Evaluation Blocks ─────────────────────────────────────────── */}
      <div className={styles.blocksGrid}>
        {blocks.map((block) => (
          <div key={block.id} className={`${styles.block} card ${block.wide ? styles.blockWide : ''}`} id={`block-${block.id}`}>
            <div className={styles.blockHeader}>
              <span className={styles.blockIcon}>{block.icon}</span>
              <span className={styles.blockId}>Block {block.id}</span>
              <span className={styles.blockTitle}>{block.title}</span>
            </div>
            <div className={styles.blockContent}>
              {block.content.split('\n\n').map((para, i) => (
                <p key={i} className={styles.blockPara}>{para}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
