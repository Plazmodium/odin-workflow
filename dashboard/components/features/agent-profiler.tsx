'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { phaseName } from '@/lib/utils';
import { AGENT_CHART_COLORS } from '@/lib/constants';
import type { AgentDuration } from '@/lib/types/database';

interface AgentProfilerProps {
  durations: AgentDuration[];
  error?: string | null;
}

export function AgentProfiler({ durations, error = null }: AgentProfilerProps) {
  if (error) {
    return (
      <p className="text-sm text-critical py-4 text-center">
        {error}
      </p>
    );
  }

  if (durations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No agent invocations recorded
      </p>
    );
  }

  // Get unique agents and phases
  const agents = [...new Set(durations.map((d) => d.agent_name))];
  const phases = [...new Set(durations.map((d) => d.phase))].sort();

  // Build chart data: one entry per phase, with agent durations as fields
  const chartData = phases.map((phase) => {
    const entry: Record<string, string | number> = { phase: phaseName(phase) };
    agents.forEach((agent) => {
      const match = durations.find((d) => d.phase === phase && d.agent_name === agent);
      const rawDuration = match ? Number(match.total_duration_ms) : 0;
      entry[agent] = Number.isFinite(rawDuration) ? Math.round(rawDuration / 1000) : 0;
    });
    return entry;
  });

  const hasNonZeroDuration = chartData.some((entry) =>
    agents.some((agent) => Number(entry[agent]) > 0)
  );

  if (!hasNonZeroDuration) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Agent invocations exist, but durations are all 0s. Complete invocations with measured runtime to render the graph.
      </p>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <XAxis
            dataKey="phase"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickLine={false}
            label={{ value: 'seconds', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: 12,
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
          />
          {agents.map((agent, i) => (
            <Bar
              key={agent}
              dataKey={agent}
              stackId="a"
              fill={AGENT_CHART_COLORS[i % AGENT_CHART_COLORS.length]}
              radius={i === agents.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
