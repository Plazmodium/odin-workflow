import { createServerClient } from '@/lib/supabase';
import type { AuditLogEntry, RalphLoopStatus } from '@/lib/types/database';

const SUPERVISOR_OPERATIONS = [
  'SUPERVISOR_TICK_STARTED',
  'SUPERVISOR_TICK_SELECTED',
  'SUPERVISOR_TICK_NOOP',
  'SUPERVISOR_TICK_FAILED',
  'SUPERVISOR_TICK_COMPLETED',
] as const;

function detailString(entry: AuditLogEntry, key: string): string | null {
  const value = entry.details?.[key];
  return typeof value === 'string' ? value : null;
}

function detailPhase(entry: AuditLogEntry): string | null {
  return detailString(entry, 'phase');
}

function outcomeFromOperation(operation: string): RalphLoopStatus['latest_outcome'] {
  switch (operation) {
    case 'SUPERVISOR_TICK_STARTED':
      return 'running';
    case 'SUPERVISOR_TICK_SELECTED':
      return 'selected';
    case 'SUPERVISOR_TICK_NOOP':
      return 'noop';
    case 'SUPERVISOR_TICK_FAILED':
      return 'failed';
    case 'SUPERVISOR_TICK_COMPLETED':
      return 'completed';
    default:
      return 'idle';
  }
}

export async function getRalphLoopStatus(): Promise<RalphLoopStatus> {
  const supabase = createServerClient();
  const supervisor_name = process.env.RALPH_LOOP_NAME ?? 'ralph-loop';
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('agent_name', supervisor_name)
    .in('operation', [...SUPERVISOR_OPERATIONS])
    .order('timestamp', { ascending: false })
    .limit(25);

  if (error != null || data == null || data.length === 0) {
    return {
      latest_outcome: 'idle',
      last_tick_at: null,
      last_selected_feature_id: null,
      last_selected_phase: null,
      last_noop_reason: null,
      last_failure_summary: null,
    };
  }

  const entries = data as AuditLogEntry[];
  const latest = entries[0];
  const latest_selection = entries.find(
    (entry) =>
      (entry.operation === 'SUPERVISOR_TICK_SELECTED' || entry.operation === 'SUPERVISOR_TICK_COMPLETED') &&
      entry.feature_id != null,
  ) ?? null;
  const latest_noop = entries.find((entry) => entry.operation === 'SUPERVISOR_TICK_NOOP') ?? null;
  const latest_failure = entries.find((entry) => entry.operation === 'SUPERVISOR_TICK_FAILED') ?? null;

  return {
    latest_outcome: outcomeFromOperation(latest.operation),
    last_tick_at: latest.timestamp,
    last_selected_feature_id: latest_selection?.feature_id ?? null,
    last_selected_phase: latest_selection == null ? null : detailPhase(latest_selection),
    last_noop_reason: latest_noop == null ? null : detailString(latest_noop, 'summary'),
    last_failure_summary: latest_failure == null ? null : detailString(latest_failure, 'summary'),
  };
}
