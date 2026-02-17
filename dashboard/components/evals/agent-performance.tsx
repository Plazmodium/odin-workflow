'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/layout/empty-state';
import { formatScore } from '@/lib/utils';
import { AGENT_CHART_COLORS } from '@/lib/constants';
import { Bot } from 'lucide-react';
import type { AgentEval } from '@/lib/types/database';

interface AgentPerformanceProps {
  agentEvals: AgentEval[];
}

export function AgentPerformance({ agentEvals }: AgentPerformanceProps) {
  if (agentEvals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Agent Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<Bot className="h-8 w-8" />}
            title="No agent performance data"
            description="Agent evaluations are computed during workflow execution. Complete features using Odin's 8-phase workflow to generate performance metrics."
          />
        </CardContent>
      </Card>
    );
  }

  // Group by agent, take latest eval per agent
  const latestByAgent = new Map<string, AgentEval>();
  agentEvals.forEach((ae) => {
    const existing = latestByAgent.get(ae.agent_name);
    if (!existing || ae.period_end > existing.period_end) {
      latestByAgent.set(ae.agent_name, ae);
    }
  });

  const data = Array.from(latestByAgent.values())
    .map((ae) => ({
      agent: ae.agent_name.replace('-agent', ''),
      score: ae.performance_score ?? 0,
      fullName: ae.agent_name,
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Agent Performance (Latest)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="agent"
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
                formatter={(value: number) => [formatScore(value), 'Score']}
              />
              <Bar
                dataKey="score"
                radius={[4, 4, 0, 0]}
                fill={AGENT_CHART_COLORS[0]}
              >
                {data.map((_, index) => (
                  <rect
                    key={`cell-${index}`}
                    fill={AGENT_CHART_COLORS[index % AGENT_CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
