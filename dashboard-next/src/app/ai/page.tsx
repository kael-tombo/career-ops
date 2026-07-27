'use client';

import Link from 'next/link';
import { Brain, Target, BarChart3, TrendingUp, ShieldCheck, Cpu, ArrowRight, Server } from 'lucide-react';

const AI_FEATURES = [
  {
    href: '/ai/skills',
    label: 'Skill Gap Analyzer',
    desc: 'Analyze JD vs your CV to find missing skills',
    icon: Brain,
    color: '#4285F4',
  },
  {
    href: '/ai/forecast',
    label: 'Pipeline Forecast',
    desc: 'Predict when you\'ll land based on pipeline velocity',
    icon: TrendingUp,
    color: '#00A67E',
  },
  {
    href: '/ai/intel',
    label: 'Company Intel',
    desc: 'Research companies and prepare intelligently',
    icon: Target,
    color: '#4F46E5',
  },
  {
    href: '/ai/rejections',
    label: 'Rejection Analyzer',
    desc: 'Find patterns in rejections to improve targeting',
    icon: ShieldCheck,
    color: '#FF6B35',
  },
  {
    href: '/ai/quality',
    label: 'Application Quality',
    desc: 'Score and improve your application quality',
    icon: BarChart3,
    color: '#1DA1F2',
  },
  {
    href: '/providers',
    label: 'LLM Providers',
    desc: 'Configure AI providers powering all modules',
    icon: Server,
    color: '#FF6B35',
  },
];

export default function AIOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Modules</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          15 AI-powered modules for evaluation, matching, scoring, and research
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {AI_FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <Link
              key={f.href}
              href={f.href}
              className="glass rounded-xl p-5 hover:scale-[1.02] transition-all group"
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${f.color}20` }}
                >
                  <Icon size={24} style={{ color: f.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold group-hover:text-[var(--color-primary-light)] transition-colors">
                    {f.label}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{f.desc}</p>
                </div>
                <ArrowRight size={16} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-primary-light)] transition-colors mt-1 shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Cpu size={18} className="text-[var(--color-primary)]" />
          <h2 className="text-lg font-semibold text-white">Powered By</h2>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          All AI modules use the multi-provider LLM gateway supporting OpenAI, Grok, Kimi, DeepSeek, and Gemini.
          Set your API keys in <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-primary-light)]">.env</code> or <code className="px-1 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-primary-light)]">.env.docker</code>.
        </p>
      </div>
    </div>
  );
}
