'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { EvalHealth } from '@/lib/types/database';
import { cn } from '@/lib/utils';

interface HealthGaugeProps {
  score: number | null;
  status: EvalHealth | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  HEALTHY: '#22c55e',
  CONCERNING: '#f59e0b',
  CRITICAL: '#ef4444',
};

export function HealthGauge({ score, status, size = 'md', className }: HealthGaugeProps) {
  const displayScore = score ?? 0;
  const color = status ? STATUS_COLORS[status] ?? '#71717a' : '#71717a';
  const remaining = 100 - displayScore;

  const data = [
    { value: displayScore },
    { value: remaining },
  ];

  const dimensions = {
    sm: { width: 100, height: 100, inner: 30, outer: 42, fontSize: 'text-lg' },
    md: { width: 160, height: 160, inner: 50, outer: 68, fontSize: 'text-3xl' },
    lg: { width: 200, height: 200, inner: 65, outer: 85, fontSize: 'text-4xl' },
  }[size];

  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <div style={{ width: dimensions.width, height: dimensions.height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              startAngle={180}
              endAngle={0}
              innerRadius={dimensions.inner}
              outerRadius={dimensions.outer}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="hsl(var(--muted))" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: dimensions.height * 0.15 }}>
        <span className={cn('font-bold tabular-nums', dimensions.fontSize)}>
          {score != null ? Math.round(displayScore) : '—'}
        </span>
        <span className="text-xs text-muted-foreground">
          {status ?? 'No Data'}
        </span>
      </div>
    </div>
  );
}
