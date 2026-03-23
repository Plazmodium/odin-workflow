'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Shield } from 'lucide-react';
import { normalizeWorkflowAgentLabel } from '@/lib/agent-names';
import { phaseName } from '@/lib/utils';
import { AGENT_CHART_COLORS, WATCHED_PHASES } from '@/lib/constants';
import type { AgentDuration } from '@/lib/types/database';
import type { ClaimsSummary } from '@/lib/data/claims';

interface AgentProfilerProps {
  durations: AgentDuration[];
  error?: string | null;
  claimsSummary?: ClaimsSummary | null;
}

export function AgentProfiler({ durations, error = null, claimsSummary = null }: AgentProfilerProps) {
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

  const normalizedBuckets = new Map<string, AgentDuration>();
  for (const duration of durations) {
    const normalizedAgentName = normalizeWorkflowAgentLabel(duration.agent_name, duration.phase);
    const key = `${duration.phase}::${normalizedAgentName}`;
    const existing = normalizedBuckets.get(key);

    if (existing == null) {
      normalizedBuckets.set(key, {
        ...duration,
        agent_name: normalizedAgentName,
      });
      continue;
    }

    const combinedInvocationCount = existing.invocation_count + duration.invocation_count;
    const combinedTotalDuration = existing.total_duration_ms + duration.total_duration_ms;
    normalizedBuckets.set(key, {
      ...existing,
      invocation_count: combinedInvocationCount,
      total_duration_ms: combinedTotalDuration,
      avg_duration_ms: Math.round(combinedTotalDuration / combinedInvocationCount),
      min_duration_ms:
        existing.min_duration_ms == null
          ? duration.min_duration_ms
          : duration.min_duration_ms == null
            ? existing.min_duration_ms
            : Math.min(existing.min_duration_ms, duration.min_duration_ms),
      max_duration_ms:
        existing.max_duration_ms == null
          ? duration.max_duration_ms
          : duration.max_duration_ms == null
            ? existing.max_duration_ms
            : Math.max(existing.max_duration_ms, duration.max_duration_ms),
    });
  }

  const normalizedDurations = Array.from(normalizedBuckets.values());

  // Get unique agents and phases
  const agents = [...new Set(normalizedDurations.map((d) => d.agent_name))];
  const phases = [...new Set(normalizedDurations.map((d) => d.phase))].sort((left, right) => Number(left) - Number(right));

  // Build chart data: one entry per phase, with agent durations as fields
  const chartData = phases.map((phase) => {
    const entry: Record<string, string | number | boolean> = { 
      phase: phaseName(phase),
      phaseNum: phase,
      isWatched: WATCHED_PHASES.includes(phase as typeof WATCHED_PHASES[number]),
    };
    agents.forEach((agent) => {
      const match = normalizedDurations.find((d) => d.phase === phase && d.agent_name === agent);
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
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              const data = payload[0]?.payload;
              const isWatched = data?.isWatched;
              return (
                <div className="bg-card border border-border rounded-lg p-2 text-xs shadow-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{label}</span>
                    {isWatched && (
                      <span className="flex items-center gap-1 text-primary text-[10px]">
                        <Shield className="h-3 w-3" />
                        Watched
                      </span>
                    )}
                  </div>
                  {payload.map((entry, index) => (
                    <div key={entry.name ?? index} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-sm"
                        style={{ backgroundColor: entry.color ?? '#888' }}
                      />
                      <span className="text-muted-foreground">{String(entry.name ?? '')}:</span>
                      <span>{entry.value}s</span>
                    </div>
                  ))}
                  {isWatched && claimsSummary && claimsSummary.total > 0 && (
                    <div className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground">
                      Claims: {claimsSummary.passed} passed, {claimsSummary.failed} failed, {claimsSummary.needsReview} pending review
                    </div>
                  )}
                </div>
              );
            }}
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
