'use client';
import { useApi, fetchApi } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import styles from './page.module.css';

interface Match {
  company: string;
  role: string;
  source: string;
  score: string | null;
  new: boolean;
}

interface ScanData {
  lastScan: string;
  portalsChecked: number;
  newMatches: number;
  runtimeMs: number;
  matches: Match[];
  portals: { name: string; source: string; last: string; status: string }[];
}

export default function ScanPage() {
  const { data: scanData, isLoading, error, mutate } = useApi<ScanData>('/api/scan');
  const { getToken } = useAuth();

  const handleScanNow = async () => {
    try {
      await fetchApi('/api/scan/trigger', { method: 'POST' }, getToken);
      alert('Scan queued! New matches will appear shortly.');
      setTimeout(() => mutate(), 3000); // re-fetch after a moment
    } catch (err: any) {
      if (err?.message?.includes('402') || err?.message?.includes('UPGRADE')) {
        alert('Daily auto-scan requires a Pro plan. Upgrade in Settings.');
      } else {
        console.error(err);
      }
    }
  };

  if (isLoading) return <div className={styles.page}>Loading scan data...</div>;
  if (error || !scanData) return <div className={styles.page}>Error loading scan data.</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Portal Scanner</h1>
          <p className={styles.subtitle}>Automatically discovers new job openings across 45+ company career pages</p>
        </div>
        <button className="btn btn-primary" id="btn-trigger-scan" onClick={handleScanNow}>🔍 Scan Now</button>
      </div>

      {/* Last scan status */}
      <div className={`${styles.statusCard} card`}>
        <div className={styles.statusRow}>
          <div className={styles.statusLeft}>
            <span className={styles.pulseGreen} />
            <span className={styles.statusText}>Last scan: <strong>{scanData.lastScan || 'Never'}</strong></span>
          </div>
          <div className={styles.statusRight}>
            <span className={styles.statChip}>🏢 {scanData.portalsChecked || 0} portals checked</span>
            <span className={styles.statChip}>✨ {scanData.newMatches || 0} new matches</span>
            <span className={styles.statChip}>⏱ {Math.round((scanData.runtimeMs || 0) / 1000)}s runtime</span>
          </div>
        </div>
      </div>

      {/* New matches */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>New Matches <span className="badge badge-green">{scanData.newMatches || 0} new</span></h2>
        <div className={styles.matchGrid}>
          {scanData.matches?.map((m) => (
            <div key={`${m.company}-${m.role}`} className={`${styles.matchCard} card`}>
              <div className={styles.matchTop}>
                <div className={styles.matchCompany}>{m.company[0]}</div>
                <div>
                  <div className={styles.matchName}>{m.company}</div>
                  <div className={styles.matchSource}>via {m.source}</div>
                </div>
                {m.new && <span className="badge badge-green" style={{marginLeft:'auto'}}>New</span>}
              </div>
              <div className={styles.matchRole}>{m.role}</div>
              <div className={styles.matchActions}>
                <button className="btn btn-primary btn-sm" id={`btn-eval-${m.company.toLowerCase()}`}>⚡ Evaluate</button>
                <button className="btn btn-ghost btn-sm" id={`btn-skip-${m.company.toLowerCase()}`}>Skip</button>
              </div>
            </div>
          ))}
          {(!scanData.matches || scanData.matches.length === 0) && (
            <div>No new matches found.</div>
          )}
        </div>
      </div>

      {/* Portal config */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Configured Portals</h2>
        <div className={`${styles.portalsTable} card`}>
          {scanData.portals?.map((p) => (
            <div key={p.name} className={styles.portalRow}>
              <span className={styles.portalName}>{p.name}</span>
              <span className="badge badge-surface">{p.source}</span>
              <span className={styles.portalLast}>{p.last}</span>
              <span className={`${styles.portalDot} ${p.status === 'active' ? styles.portalActive : ''}`} />
            </div>
          ))}
          {(!scanData.portals || scanData.portals.length === 0) && (
            <div>No portals configured.</div>
          )}
        </div>
      </div>

      {/* Upgrade gate for auto-scan */}
      <div className={`${styles.upgradeGate} card`}>
        <div className={styles.upgradeIcon}>⚡</div>
        <div>
          <div className={styles.upgradeTitle}>Enable Daily Auto-Scan</div>
          <div className={styles.upgradeSub}>Upgrade to Pro to scan all 45+ portals automatically every day — new matches appear in your pipeline before you wake up.</div>
        </div>
        <a href="/app/settings" className="btn btn-primary btn-sm" id="btn-upgrade-scan">Upgrade to Pro</a>
      </div>
    </div>
  );
}
