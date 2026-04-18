import type { Metadata } from 'next';
import styles from './layout.module.css';
import Sidebar from './Sidebar';
export const metadata: Metadata = {
  title: 'Dashboard — Career-Ops Cloud',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <Sidebar />

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
