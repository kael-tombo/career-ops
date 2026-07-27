'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Shield, Zap, FileText, Globe, BookOpen, Activity, Rocket, Compass, Bot, Brain, BarChart3, Cpu, Server } from 'lucide-react';
import { API_URL } from '@/lib/api';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/autonomous', label: 'AI Team', icon: Bot },
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/ai', label: 'AI Modules', icon: Cpu },
  { href: '/providers', label: 'LLM Providers', icon: Server },
  { href: '/tracker', label: 'Tracker', icon: Shield },
  { href: '/pipeline', label: 'Pipeline', icon: Zap },
  { href: '/global', label: 'Global', icon: Compass },
  { href: '/mass-apply', label: 'Mass Apply', icon: Rocket },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/regions', label: 'Regions', icon: Globe },
  { href: '/interview-prep', label: 'Interview Prep', icon: BookOpen },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [trackerCount, setTrackerCount] = useState<number | null>(null);
  const [version, setVersion] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/diagnostics`)
      .then(r => r.json())
      .then(d => {
        if (d?.queue) setTrackerCount(d.queue.completed + d.queue.queued + d.queue.active);
      })
      .catch(() => {});
    fetch(`${API_URL}/api/applications`)
      .then(r => r.json())
      .then(a => setTrackerCount(Array.isArray(a) ? a.length : null))
      .catch(() => {});
    setVersion('3.0');
  }, []);

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
          <span>v{version || '3.0'} · {trackerCount !== null ? `${trackerCount} trackers` : ''}</span>
        </div>
      </div>
    </aside>
  );
}
