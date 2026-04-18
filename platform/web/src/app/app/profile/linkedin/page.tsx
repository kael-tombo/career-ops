'use client';
import { useState } from 'react';
import { fetchApi } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import styles from '../../shared.module.css';

export default function LinkedInOptimizerPage() {
  const { getToken } = useAuth();
  const [linkedinContent, setLinkedinContent] = useState('');
  const [report, setReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleOptimize = async () => {
    if (!linkedinContent.trim()) return alert('Please paste your LinkedIn content first.');
    try {
      setIsGenerating(true);
      const res = await fetchApi('/api/profile/optimize-linkedin', {
        method: 'POST',
        body: JSON.stringify({ linkedinContent }),
      }, getToken);
      setReport(res.analysis);
    } catch (err) {
      console.error(err);
      alert('Failed to generate LinkedIn optimization report.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>LinkedIn Profile Optimizer</h1>
          <p className={styles.subtitle}>Align your professional brand with your target roles using AI.</p>
        </div>
      </div>

      <div className={`${styles.section} card`}>
        <h2>Your Current LinkedIn Content</h2>
        <p className={styles.muted} style={{ marginBottom: '1rem' }}>
          Paste your current headline, "About" section, and recent experience bullets below.
        </p>
        <textarea 
          className="input" 
          style={{ width: '100%', minHeight: '200px', padding: '1rem', fontFamily: 'var(--ctp-font-sans)' }}
          value={linkedinContent}
          onChange={(e) => setLinkedinContent(e.target.value)}
          placeholder="Paste your LinkedIn content here..."
        />
        <div style={{ marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={handleOptimize} disabled={isGenerating}>
            {isGenerating ? 'Analyzing Profile...' : '🎨 Optimize My Brand'}
          </button>
        </div>
      </div>

      {report && (
        <div className={`${styles.section} card`}>
          <h2>✨ Elite Branding Report</h2>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: '1rem', color: 'var(--ctp-text)' }}>
            {report}
          </div>
        </div>
      )}
    </div>
  );
}
