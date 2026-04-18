'use client';
import { useState, useEffect } from 'react';
import { useApi, fetchApi } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import styles from '../shared.module.css';

export default function ProfilePage() {
  const { data: profile, isLoading, mutate } = useApi<any>('/api/profile');
  const { getToken } = useAuth();
  
  const [cvMarkdown, setCvMarkdown] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile && profile.cvMarkdown) {
      setCvMarkdown(profile.cvMarkdown);
    }
  }, [profile]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetchApi('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ cvMarkdown }),
      }, getToken);
      mutate();
      alert('Profile saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className={styles.page}>Loading profile...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Master Profile</h1>
          <p className={styles.subtitle}>Manage your base CV. AI evaluations will use this to score your fit.</p>
        </div>
        <div className={styles.headerActions}>
          <button 
            className="btn btn-primary" 
            onClick={handleSave} 
            disabled={isSaving || !cvMarkdown.trim()}
          >
            {isSaving ? 'Saving...' : '💾 Save Profile'}
          </button>
        </div>
      </div>

      <div className={`${styles.card} card`} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h2>CV Markdown Editor</h2>
        <p className={styles.muted} style={{ marginBottom: '1rem' }}>
          Paste your resume here in Markdown format. The AI evaluates jobs against this exact content.
        </p>
        
        <textarea 
          className="input" 
          style={{ 
            flex: 1, 
            minHeight: '500px', 
            fontFamily: 'var(--ctp-font-mono)', 
            lineHeight: 1.6, 
            padding: '1rem',
            resize: 'vertical'
          }}
          value={cvMarkdown}
          onChange={(e) => setCvMarkdown(e.target.value)}
          placeholder="# John Doe\n\n## Experience\n\n### Senior Software Engineer\n..."
        />
      </div>
    </div>
  );
}
