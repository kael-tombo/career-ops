'use client';
import { useState, useEffect } from 'react';
import { useApi, fetchApi } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import styles from '../shared.module.css';

export default function SettingsPage() {
  const { data: profile, isLoading, mutate } = useApi<any>('/api/profile');
  const { getToken } = useAuth();

  const [origin, setOrigin] = useState('https://career-ops.app');
  const [portalsConfig, setPortalsConfig] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (profile && profile.portalsConfig) {
      setPortalsConfig(profile.portalsConfig);
    }
  }, [profile]);

  const handleSavePortals = async () => {
    setIsSaving(true);
    try {
      await fetchApi('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ portalsConfig }),
      }, getToken);
      mutate();
      alert('Portals configuration saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save portals.');
    } finally {
      setIsSaving(false);
    }
  };

  const bookmarkletCode = `javascript:(function(){const u=encodeURIComponent(window.location.href);window.open('${origin}/app/dashboard?importUrl='+u,'_blank');})();`;

  if (isLoading) return <div className={styles.page}>Loading settings...</div>;
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Manage your profile, integrations, and subscription.</p>
        </div>
      </div>

      <div className={`${styles.section} card`}>
        <h2>AI Integrations</h2>
        <div className={styles.formGroup}>
          <label className={styles.label}>Anthropic API Key</label>
          <input type="password" className="input" placeholder="sk-ant-api03-..." defaultValue="sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXXXX" />
          <p className={styles.helpText}>Required for custom evaluations if on Free Tier.</p>
        </div>
        <button className="btn btn-primary btn-sm">Save Configuration</button>
      </div>

      <div className={`${styles.section} card`}>
        <h2>1-Click Job Importer</h2>
        <p className={styles.muted} style={{ marginBottom: '1rem' }}>
          Drag the button below to your bookmarks bar. Click it when viewing any job posting (LinkedIn, Greenhouse, etc.) to instantly import it to your Career-Ops dashboard.
        </p>
        <div style={{ padding: '1rem', backgroundColor: 'var(--ctp-surface1)', borderRadius: '8px', display: 'inline-block' }}>
          <a 
            href={bookmarkletCode}
            className="btn btn-primary"
            style={{ cursor: 'grab', display: 'inline-block' }}
            onClick={(e) => e.preventDefault()}
          >
            ➕ Send to Career-Ops
          </a>
        </div>
      </div>

      <div className={`${styles.section} card`}>
        <h2>Sourcing Portals Config</h2>
        <p className={styles.muted} style={{ marginBottom: '1rem' }}>
          Configure the job boards the AI scanner monitors in YAML format.
        </p>
        <textarea 
          className="input" 
          style={{ width: '100%', minHeight: '200px', fontFamily: 'var(--ctp-font-mono)', lineHeight: 1.5, padding: '1rem' }}
          value={portalsConfig}
          onChange={(e) => setPortalsConfig(e.target.value)}
          placeholder="greenhouse:\n  - anthropic\n  - linear\nlever:\n  - netflix"
        />
        <div style={{ marginTop: '1rem' }}>
          <button className="btn btn-primary btn-sm" onClick={handleSavePortals} disabled={isSaving}>
            {isSaving ? 'Saving...' : '💾 Save Portals'}
          </button>
        </div>
      </div>
      
      <div className={`${styles.section} card`}>
        <h2>Subscription</h2>
        <div className={styles.planInfo}>
          Você está no plano <span className="badge badge-blue">Free</span>
        </div>
        <a href="/pricing" className="btn btn-primary btn-sm">Upgrade Plan</a>
      </div>
    </div>
  );
}
