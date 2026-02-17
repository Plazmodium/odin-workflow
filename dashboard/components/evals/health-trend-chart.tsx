'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils';
import type { SystemHealthEval } from '@/lib/types/database';

interface HealthTrendChartProps {
  history: SystemHealthEval[];
  periodDays?: number;
}

export function HealthTrendChart({ history, periodDays }: HealthTrendChartProps) {
  const filtered = periodDays
    ? history.filter((h) => h.period_days === periodDays)
    : history;

  const data = filtered.map((h) => ({
    date: formatDateTime(h.computed_at),
    score: h.overall_health_score,
    status: h.health_status,
  }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Health Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No health history available. Run &quot;Refresh EVALS&quot; to compute system health.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Health Trend {periodDays ? `(${periodDays}-day window)` : '(All periods)'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              {/* Threshold lines */}
              <ReferenceLine
                y={70}
                stroke="#22c55e"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: 'Healthy', position: 'right', fontSize: 10, fill: '#22c55e' }}
              />
              <ReferenceLine
                y={50}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{ value: 'Concerning', position: 'right', fontSize: 10, fill: '#f59e0b' }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
                activeDot={{ r: 5, fill: '#3b82f6' }}
                name="Health Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
