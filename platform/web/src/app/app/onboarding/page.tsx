'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import styles from '../shared.module.css';

export default function OnboardingPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [rawResume, setRawResume] = useState('');
  const [markdownCV, setMarkdownCV] = useState('');
  const [targetRoles, setTargetRoles] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleIngest = async () => {
    try {
      setIsProcessing(true);
      const res = await fetchApi('/api/profile/ingest-resume', {
        method: 'POST',
        body: JSON.stringify({ rawText: rawResume })
      }, getToken);
      setMarkdownCV(res.markdown);
      setStep(2);
    } catch (err) {
      alert('Failed to process resume.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = async () => {
    try {
      setIsProcessing(true);
      await fetchApi('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          cvMarkdown: markdownCV,
          targetRoles: targetRoles.split(',').map(r => r.trim()),
        })
      }, getToken);
      router.push('/app/dashboard');
    } catch (err) {
      alert('Failed to save profile.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.page} style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className={styles.header} style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className={styles.title}>Welcome to Career-Ops Cloud 🚀</h1>
        <p className={styles.subtitle}>Let's set up your AI-native career engine in 2 minutes.</p>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
          {[1, 2].map(s => (
            <div key={s} style={{ 
              width: '40px', height: '40px', borderRadius: '50%', 
              backgroundColor: step >= s ? 'var(--ctp-blue)' : 'var(--ctp-surface1)',
              color: step >= s ? 'var(--ctp-crust)' : 'var(--ctp-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900
            }}>
              {s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <h2 style={{ marginBottom: '1rem' }}>Step 1: Your Foundation</h2>
            <p className={styles.muted} style={{ marginBottom: '1.5rem' }}>Paste your existing resume. Our AI will convert it to a structured Markdown format.</p>
            <textarea 
              className="input"
              style={{ width: '100%', minHeight: '300px', padding: '1rem' }}
              placeholder="Paste your resume text here..."
              value={rawResume}
              onChange={(e) => setRawResume(e.target.value)}
            />
            <button className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={handleIngest} disabled={isProcessing}>
              {isProcessing ? 'Processing Resume...' : 'Continue to Targets →'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ marginBottom: '1rem' }}>Step 2: Your Strategy</h2>
            <p className={styles.muted} style={{ marginBottom: '1.5rem' }}>What roles are you targeting? (e.g. Senior Backend Engineer, Tech Lead)</p>
            <input 
              className="input"
              style={{ width: '100%', marginBottom: '1.5rem' }}
              placeholder="Backend Engineer, Fullstack Dev, etc."
              value={targetRoles}
              onChange={(e) => setTargetRoles(e.target.value)}
            />
            
            <h3 style={{ marginBottom: '0.5rem' }}>Refined CV (AI Generated)</h3>
            <textarea 
              className="input"
              style={{ width: '100%', minHeight: '200px', padding: '1rem', fontSize: '12px' }}
              value={markdownCV}
              onChange={(e) => setMarkdownCV(e.target.value)}
            />

            <button className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={handleFinish} disabled={isProcessing}>
              {isProcessing ? 'Saving Profile...' : 'Launch Dashboard 🚀'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
