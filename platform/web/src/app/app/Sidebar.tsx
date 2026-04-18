'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './layout.module.css';

const NAV_ITEMS = [
  { href: '/app/dashboard',  icon: '⬡',  label: 'Dashboard' },
  { href: '/app/scan',       icon: '🔍', label: 'Scan Portals' },
  { href: '/app/cv',         icon: '📄', label: 'My CVs' },
  { href: '/app/interview',  icon: '🎯', label: 'Interview Prep' },
  { href: '/app/settings',   icon: '⚙',  label: 'Settings' },
];

export default function Sidebar({ plan = 'free', evalCount = 3, evalLimit = 5 }: {
  plan?: string;
  evalCount?: number;
  evalLimit?: number;
}) {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarTop}>
        <Link href="/app/dashboard" className={styles.logoLink}>
          <span className={styles.logo}>
            career<span className={styles.logoAccent}>-ops</span>
            <span className={styles.logoBadge}>cloud</span>
          </span>
        </Link>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
                {isActive && <span className={styles.navIndicator} />}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={styles.sidebarBottom}>
        {plan === 'free' && (
          <>
            <div className={styles.planBadge}>
              <span className="badge badge-surface">Free Plan</span>
              <span className={styles.planUsage}>{evalCount} / {evalLimit} evals</span>
            </div>
            <div className={styles.planBar}>
              <div
                className={styles.planBarFill}
                style={{ width: `${(evalCount / evalLimit) * 100}%` }}
              />
            </div>
            <a href="/pricing" className={`btn btn-primary btn-sm ${styles.upgradeBtn}`} id="sidebar-upgrade-btn">
              ⚡ Upgrade to Pro
            </a>
          </>
        )}
        {plan !== 'free' && (
          <div className={styles.planBadge}>
            <span className={`badge badge-${plan === 'elite' ? 'mauve' : 'blue'}`}>
              {plan === 'elite' ? 'Elite' : 'Pro'} Plan
            </span>
            <span className={styles.planUsage}>Unlimited evals</span>
          </div>
        )}
      </div>
    </aside>
  );
}
