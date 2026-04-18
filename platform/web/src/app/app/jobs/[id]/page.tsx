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
  const [activeTab, setActiveTab] = useState<'outreach' | 'coverLetter' | 'negotiation' | 'network'>('outreach');
  const [outreachDraft, setOutreachDraft] = useState<string | null>(null);
  const [coverLetterDraft, setCoverLetterDraft] = useState<string | null>(null);
  const [negotiationDraft, setNegotiationDraft] = useState<string | null>(null);
  const [portfolioLink, setPortfolioLink] = useState<string | null>(null);
  const [referralDraft, setReferralDraft] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState('');
  const [connectionContext, setConnectionContext] = useState('');
  const [offerDetails, setOfferDetails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

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
      setIsGenerating(true);
      const res = await fetchApi(`/api/jobs/${job.id}/outreach`, { method: 'POST' }, getToken);
      setOutreachDraft(res.draft);
    } catch (err: any) {
      alert(err.message || 'Failed to generate outreach draft.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    try {
      setIsGenerating(true);
      const res = await fetchApi(`/api/jobs/${job.id}/cover-letter`, { method: 'POST' }, getToken);
      setCoverLetterDraft(res.draft);
    } catch (err: any) {
      alert(err.message || 'Failed to generate cover letter.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateNegotiation = async () => {
    if (!offerDetails.trim()) return alert('Please enter offer details first.');
    try {
      setIsGenerating(true);
      const res = await fetchApi(`/api/jobs/${job.id}/negotiate`, { 
        method: 'POST',
        body: JSON.stringify({ offerDetails })
      }, getToken);
      setNegotiationDraft(res.draft);
    } catch (err: any) {
      alert(err.message || 'Failed to generate negotiation draft.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePortfolio = async () => {
    try {
      setIsGenerating(true);
      const res = await fetchApi(`/api/jobs/${job.id}/portfolio`, { method: 'POST' }, getToken);
      setPortfolioLink(`${window.location.origin}/p/${res.slug}`);
    } catch (err: any) {
      alert(err.message || 'Failed to generate portfolio.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateReferral = async () => {
    try {
      setIsGenerating(true);
      const res = await fetchApi(`/api/jobs/${job.id}/referral-request`, { 
        method: 'POST',
        body: JSON.stringify({ connectionName, context: connectionContext })
      }, getToken);
      setReferralDraft(res.draft);
    } catch (err: any) {
      alert(err.message || 'Failed to generate referral request.');
    } finally {
      setIsGenerating(false);
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
            <button className="btn btn-primary btn-sm" id="btn-generate-portfolio" onClick={handleGeneratePortfolio}>🚀 Share Portfolio</button>
            <button className="btn btn-ghost btn-sm" id="btn-mark-applied" onClick={handleMarkApplied}>✅ Mark Applied</button>
          </div>
        </div>
      </div>

      {portfolioLink && (
        <div className={`${styles.legitimacyBar} card`} style={{ backgroundColor: 'var(--ctp-blue)', color: 'var(--ctp-crust)', fontWeight: 800 }}>
          <span>🚀 Public Portfolio Link:</span>
          <a href={portfolioLink} target="_blank" rel="noreferrer" style={{ color: 'var(--ctp-crust)', textDecoration: 'underline' }}>{portfolioLink}</a>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--ctp-crust)', marginLeft: 'auto' }} onClick={() => { navigator.clipboard.writeText(portfolioLink); alert('Copied!'); }}>Copy Link</button>
        </div>
      )}

      {/* ── Legitimacy bar ───────────────────────────────────────────── */}
      <div className={`${styles.legitimacyBar} card`}>
        <span className={styles.legIcon}>🔐</span>
        <span className={styles.legText}>{evalData.legitimacy || 'Checking legitimacy...'}</span>
        <span className="badge badge-green">{job.status}</span>
      </div>

      {/* ── AI Assistants ────────────────────────────────────────────── */}
      <div className={`${styles.block} card ${styles.blockWide}`} style={{ marginTop: '1rem', marginBottom: '2rem' }}>
        <div className={styles.blockHeader} style={{ borderBottom: '1px solid var(--ctp-surface1)', paddingBottom: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <button 
              className={activeTab === 'outreach' ? styles.activeTab : styles.tab} 
              onClick={() => setActiveTab('outreach')}
            >
              ✉️ Outreach
            </button>
            <button 
              className={activeTab === 'coverLetter' ? styles.activeTab : styles.tab} 
              onClick={() => setActiveTab('coverLetter')}
            >
              📄 Cover Letter
            </button>
            {job.status === 'Offer' && (
              <button 
                className={activeTab === 'negotiation' ? styles.activeTab : styles.tab} 
                onClick={() => setActiveTab('negotiation')}
              >
                🤝 Negotiation
              </button>
            )}
            <button 
              className={activeTab === 'network' ? styles.activeTab : styles.tab} 
              onClick={() => setActiveTab('network')}
            >
              🤝 Network
            </button>
          </div>
          
          <div style={{ marginLeft: 'auto' }}>
            {activeTab === 'outreach' && (
              <button className="btn btn-primary btn-sm" onClick={handleGenerateOutreach} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : '✨ Generate Email'}
              </button>
            )}
            {activeTab === 'coverLetter' && (
              <button className="btn btn-primary btn-sm" onClick={handleGenerateCoverLetter} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : '✨ Generate Letter'}
              </button>
            )}
            {activeTab === 'negotiation' && (
              <button className="btn btn-primary btn-sm" onClick={handleGenerateNegotiation} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : '✨ Draft Response'}
              </button>
            )}
            {activeTab === 'network' && (
              <button className="btn btn-primary btn-sm" onClick={handleGenerateReferral} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : '✨ Draft Request'}
              </button>
            )}
          </div>
        </div>

        <div className={styles.blockContent} style={{ paddingTop: '1rem' }}>
          {activeTab === 'outreach' && (
            !outreachDraft ? (
              <p className={styles.muted}>Generate a personalized cold email based on your evaluation.</p>
            ) : (
              <textarea 
                className="input" 
                style={{ width: '100%', minHeight: '200px', fontFamily: 'var(--ctp-font-mono)', lineHeight: 1.5, padding: '1rem' }}
                value={outreachDraft}
                onChange={(e) => setOutreachDraft(e.target.value)}
              />
            )
          )}

          {activeTab === 'coverLetter' && (
            !coverLetterDraft ? (
              <p className={styles.muted}>Generate a formal cover letter tailored to this role and your profile.</p>
            ) : (
              <textarea 
                className="input" 
                style={{ width: '100%', minHeight: '300px', fontFamily: 'var(--ctp-font-mono)', lineHeight: 1.5, padding: '1rem' }}
                value={coverLetterDraft}
                onChange={(e) => setCoverLetterDraft(e.target.value)}
              />
            )
          )}

          {activeTab === 'negotiation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p className={styles.muted}>Paste the offer details (salary, equity, benefits) to draft a negotiation response.</p>
              <textarea 
                className="input" 
                placeholder="Paste offer email or details here..."
                style={{ width: '100%', minHeight: '100px', padding: '1rem' }}
                value={offerDetails}
                onChange={(e) => setOfferDetails(e.target.value)}
              />
              {negotiationDraft && (
                <textarea 
                  className="input" 
                  style={{ width: '100%', minHeight: '250px', fontFamily: 'var(--ctp-font-mono)', lineHeight: 1.5, padding: '1rem', marginTop: '1rem' }}
                  value={negotiationDraft}
                  onChange={(e) => setNegotiationDraft(e.target.value)}
                />
              )}
            </div>
          )}

          {activeTab === 'network' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p className={styles.muted}>Draft a referral request to someone you know at {job.company}.</p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input 
                  className="input" 
                  placeholder="Connection Name (e.g. John Doe)"
                  style={{ flex: 1 }}
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                />
                <input 
                  className="input" 
                  placeholder="Context (e.g. Ex-colleague at Apple)"
                  style={{ flex: 2 }}
                  value={connectionContext}
                  onChange={(e) => setConnectionContext(e.target.value)}
                />
              </div>
              {referralDraft && (
                <textarea 
                  className="input" 
                  style={{ width: '100%', minHeight: '250px', fontFamily: 'var(--ctp-font-mono)', lineHeight: 1.5, padding: '1rem', marginTop: '1rem' }}
                  value={referralDraft}
                  onChange={(e) => setReferralDraft(e.target.value)}
                />
              )}
            </div>
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
