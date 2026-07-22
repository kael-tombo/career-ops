'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import type { Application } from '@/lib/types';

const SCORE_COLORS = ['#e17055', '#fab1a0', '#a29bfe', '#74b9ff', '#00b894'];

export default function OverviewCharts({ data }: { data: Application[] }) {
  const safeNum = (s: string | undefined | null): number => {
    const n = parseFloat(s || '');
    return isNaN(n) ? 0 : n;
  };

  const scores = [0, 0, 0, 0, 0];
  data.forEach(a => {
    const s = safeNum(a.score);
    if (s >= 4.5) scores[4]++;
    else if (s >= 4) scores[3]++;
    else if (s >= 3) scores[2]++;
    else if (s >= 2) scores[1]++;
    else scores[0]++;
  });

  const scoreChart = [
    { name: '<2', value: scores[0] },
    { name: '2-3', value: scores[1] },
    { name: '3-4', value: scores[2] },
    { name: '4-4.5', value: scores[3] },
    { name: '4.5+', value: scores[4] },
  ];

  const statusCounts: Record<string, number> = {};
  data.forEach(a => {
    const s = a.status.trim();
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const statusChart = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Score Distribution</h3>
        <span className="text-xs text-[var(--color-text-muted)]">{data.length} total</span>
      </div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={scoreChart}>
            <XAxis dataKey="name" tick={{ fill: '#636e72', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: '#636e72', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#dfe6e9' }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {scoreChart.map((_, i) => (
                <Cell key={i} fill={SCORE_COLORS[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="border-t border-[var(--color-border)] pt-6">
        <h3 className="text-sm font-semibold text-white mb-4">Status Breakdown</h3>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusChart}
                cx="50%" cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                label
              >
                {statusChart.map((_, i) => (
                  <Cell key={i} fill={SCORE_COLORS[i % SCORE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#dfe6e9' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
