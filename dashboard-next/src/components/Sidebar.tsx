'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Shield, Zap, FileText, Globe, BookOpen, Activity } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/tracker', label: 'Tracker', icon: Shield },
  { href: '/pipeline', label: 'Pipeline', icon: Zap },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/regions', label: 'Regions', icon: Globe },
  { href: '/interview-prep', label: 'Interview Prep', icon: BookOpen },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 lg:w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col">
      <div className="p-5 border-b border-[var(--color-border)]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center text-white font-bold text-sm">
            CO
          </div>
          <div>
            <div className="text-sm font-bold leading-tight text-white">CAREER-OPS</div>
            <div className="text-[10px] text-[var(--color-text-muted)] tracking-widest uppercase">Dashboard</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary-light)] font-semibold'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Activity size={14} />
          <span>v1.8.1 · 26 trackers</span>
        </div>
      </div>
    </aside>
  );
}
