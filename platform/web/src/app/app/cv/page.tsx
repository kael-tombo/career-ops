'use client';
import { useApi, fetchApi } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import styles from '../shared.module.css';

interface CV {
  id: string;
  jobId: string;
  createdAt: string;
  status: string;
  pdfUrl?: string;
  job: {
    company: string;
    role: string;
  };
}

export default function CVsPage() {
  const { data: cvs, error, isLoading } = useApi<CV[]>('/api/cv');
  const { getToken } = useAuth();

  if (isLoading) return <div className={styles.page}>Loading CVs...</div>;
  if (error) return <div className={styles.page}>Error loading CVs.</div>;

  const activeCVs = cvs || [];

  const handleDownload = async (id: string) => {
    try {
      const res = await fetchApi(`/api/cv/${id}/download`, { method: 'GET' }, getToken);
      if (res && res.url) {
        window.open(res.url, '_blank');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Targeted CVs</h1>
          <p className={styles.subtitle}>AI-generated, ATS-optimized CVs tailored to each specific job role.</p>
        </div>
      </div>
      
      <div className={styles.cvGrid}>
        {activeCVs.map(cv => (
          <div key={cv.id} className={`${styles.cvCard} card`}>
            <div className={styles.cvTop}>
              <span className={`badge badge-${cv.status === 'Ready' ? 'green' : 'surface'}`}>{cv.status}</span>
              <span className={styles.cvDate}>{new Date(cv.createdAt).toLocaleDateString()}</span>
            </div>
            <div className={styles.cvBody}>
              <div className={styles.cvCompany}>{cv.job.company}</div>
              <div className={styles.cvRole}>{cv.job.role}</div>
            </div>
            <div className={styles.cvBottom}>
              <button 
                className="btn btn-ghost btn-sm" 
                disabled={cv.status !== 'Ready'}
                onClick={() => handleDownload(cv.id)}
              >⬇ Download PDF</button>
            </div>
          </div>
        ))}
        {activeCVs.length === 0 && <div>No CVs generated yet. Evaluate a job and generate a CV first!</div>}
      </div>
    </div>
  );
}
