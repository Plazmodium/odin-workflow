/**
 * Data layer: Feature Detail queries
 */
import { createServerClient } from '@/lib/supabase';
import type {
  FeatureStatusResult,
  FeatureCommit,
  PhaseDuration,
  AgentDuration,
  AgentInvocation,
  Phase,
  PhaseExecutionMode,
  PhaseExecutionPolicy,
  PhaseExecutionProofStatus,
  QualityGate,
  Blocker,
  FeatureEval,
  EvalAlert,
  Learning,
  PhaseTransition,
  IterationTracking,
  PhaseExecutionAttestation,
  PhaseOutput,
} from '@/lib/types/database';

export interface AgentDurationsResult {
  durations: AgentDuration[];
  error: string | null;
}

export interface PhaseExecutionAttestationsResult {
  attestations: PhaseExecutionAttestation[];
  error: string | null;
  current_phase: {
    execution_policy: PhaseExecutionPolicy;
    recommended_mode: PhaseExecutionMode;
    actual_mode: PhaseExecutionMode | null;
    proof_status: PhaseExecutionProofStatus;
    warning: string | null;
  } | null;
}

const EXECUTION_POLICY_BY_PHASE: Record<Phase, PhaseExecutionPolicy> = {
  '0': 'inline_allowed',
  '1': 'inline_allowed',
  '2': 'inline_allowed',
  '3': 'inline_allowed',
  '4': 'inline_allowed',
  '5': 'distinct_session_preferred',
  '6': 'distinct_session_preferred',
  '7': 'distinct_session_preferred',
  '8': 'inline_allowed',
  '9': 'inline_allowed',
  '10': 'inline_allowed',
};

const RECOMMENDED_MODE_BY_PHASE: Record<Phase, PhaseExecutionMode> = {
  '0': 'inline',
  '1': 'inline',
  '2': 'inline',
  '3': 'inline',
  '4': 'inline',
  '5': 'subagent',
  '6': 'subagent',
  '7': 'subagent',
  '8': 'subagent',
  '9': 'inline',
  '10': 'inline',
};

function hasDistinctSessionProof(attestation: PhaseExecutionAttestation | null): boolean {
  return (
    attestation != null &&
    attestation.actual_mode === 'subagent' &&
    attestation.proof_status !== 'none' &&
    attestation.supervisor_session_id != null &&
    attestation.worker_session_id != null &&
    attestation.worker_session_id !== attestation.supervisor_session_id
  );
}

function assessCurrentPhaseExecution(
  currentPhase: Phase,
  attestation: PhaseExecutionAttestation | null,
  error: string | null,
) {
  const execution_policy = EXECUTION_POLICY_BY_PHASE[currentPhase];
  const recommended_mode = RECOMMENDED_MODE_BY_PHASE[currentPhase];

  if (error != null || execution_policy === 'inline_allowed') {
    return {
      execution_policy,
      recommended_mode,
      actual_mode: attestation?.actual_mode ?? null,
      proof_status: attestation?.proof_status ?? 'none',
      warning: null,
    };
  }

  const warning =
    attestation == null
      ? `No execution attestation recorded for current phase ${currentPhase}.`
      : !hasDistinctSessionProof(attestation)
        ? `Current phase ${currentPhase} prefers a distinct worker session, but the recorded attestation does not prove one.`
        : null;

  return {
    execution_policy,
    recommended_mode,
    actual_mode: attestation?.actual_mode ?? null,
    proof_status: attestation?.proof_status ?? 'none',
    warning,
  };
}

function formatMissingRpcError(functionName: string): string {
  return `RPC function ${functionName} is missing in Supabase. Apply the latest migrations and verify the function exists.`;
}

function formatMissingTableError(tableName: string): string {
  return `Table ${tableName} is missing in Supabase. Apply migration 012_phase_execution_attestations.sql and verify the table exists.`;
}

function isMissingTableError(error: unknown, tableName: string): boolean {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : String(error ?? '');

  return (
    message.includes(`relation "public.${tableName}" does not exist`) ||
    message.includes(`relation "${tableName}" does not exist`) ||
    message.includes(`Could not find the table 'public.${tableName}'`) ||
    message.includes(`Could not find the table '${tableName}'`)
  );
}

export async function getFeatureStatus(
  featureId: string
): Promise<FeatureStatusResult | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('get_feature_status', {
    p_feature_id: featureId,
  });
  if (error || !data || data.length === 0) return null;
  return data[0] as FeatureStatusResult;
}

export async function getFeatureCommits(
  featureId: string
): Promise<FeatureCommit[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('feature_commits')
    .select('*')
    .eq('feature_id', featureId)
    .order('committed_at', { ascending: true });
  if (error || !data) return [];
  return data as FeatureCommit[];
}

export async function getPhaseDurations(
  featureId: string
): Promise<PhaseDuration[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('get_phase_durations', {
    p_feature_id: featureId,
  });
  if (error || !data) return [];
  return data as PhaseDuration[];
}

export async function getAgentDurations(
  featureId: string
): Promise<AgentDurationsResult> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('get_agent_durations', {
    p_feature_id: featureId,
  });

  if (error) {
    const isMissingFunction = error.message.includes('Could not find the function public.get_agent_durations');
    return {
      durations: [],
      error: isMissingFunction
        ? formatMissingRpcError('get_agent_durations(p_feature_id)')
        : error.message,
    };
  }

  if (!data) {
    return fallbackAgentDurations(supabase, featureId);
  }

  const durations = data as AgentDuration[];
  if (durations.length > 0) {
    return { durations, error: null };
  }

  // Fallback: if RPC returns empty despite invocations existing,
  // aggregate directly from agent_invocations to keep profiler usable.
  return fallbackAgentDurations(supabase, featureId);

}

async function fallbackAgentDurations(
  supabase: ReturnType<typeof createServerClient>,
  featureId: string
): Promise<AgentDurationsResult> {
  const { data, error } = await supabase
    .from('agent_invocations')
    .select('phase, agent_name, duration_ms, ended_at')
    .eq('feature_id', featureId)
    .not('ended_at', 'is', null)
    .not('duration_ms', 'is', null);

  if (error || !data || data.length === 0) {
    return { durations: [], error: null };
  }

  const buckets = new Map<string, {
    phase: AgentDuration['phase'];
    agent_name: string;
    durations: number[];
  }>();

  for (const row of data as Array<{ phase: AgentDuration['phase']; agent_name: string; duration_ms: number }>) {
    const key = `${row.phase}::${row.agent_name}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.durations.push(row.duration_ms);
      continue;
    }
    buckets.set(key, {
      phase: row.phase,
      agent_name: row.agent_name,
      durations: [row.duration_ms],
    });
  }

  const durations: AgentDuration[] = Array.from(buckets.values())
    .map((bucket) => {
      const total = bucket.durations.reduce((sum, d) => sum + d, 0);
      const min = Math.min(...bucket.durations);
      const max = Math.max(...bucket.durations);
      return {
        phase: bucket.phase,
        agent_name: bucket.agent_name,
        invocation_count: bucket.durations.length,
        total_duration_ms: total,
        avg_duration_ms: Math.round(total / bucket.durations.length),
        min_duration_ms: min,
        max_duration_ms: max,
      };
    })
    .sort((a, b) => {
      if (a.phase === b.phase) return a.agent_name.localeCompare(b.agent_name);
      return String(a.phase).localeCompare(String(b.phase), undefined, { numeric: true });
    });

  return { durations, error: null };
}

export async function getQualityGates(
  featureId: string
): Promise<QualityGate[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('quality_gates')
    .select('*')
    .eq('feature_id', featureId)
    .order('approved_at', { ascending: true });
  if (error || !data) return [];
  return data as QualityGate[];
}

export async function getBlockers(featureId: string): Promise<Blocker[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('blockers')
    .select('*')
    .eq('feature_id', featureId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Blocker[];
}

export async function getFeatureEval(
  featureId: string
): Promise<FeatureEval | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('feature_evals')
    .select('*')
    .eq('feature_id', featureId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as FeatureEval;
}

export async function getFeatureAlerts(
  featureId: string
): Promise<EvalAlert[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eval_alerts')
    .select('*')
    .eq('feature_id', featureId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as EvalAlert[];
}

export async function getFeatureLearnings(
  featureId: string
): Promise<Learning[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('learnings')
    .select('*')
    .eq('feature_id', featureId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Learning[];
}

export async function getTransitions(
  featureId: string
): Promise<PhaseTransition[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('phase_transitions')
    .select('*')
    .eq('feature_id', featureId)
    .order('transitioned_at', { ascending: true })
    .order('id', { ascending: true });
  if (error || !data) return [];
  return data as PhaseTransition[];
}

export async function getAgentInvocations(
  featureId: string
): Promise<AgentInvocation[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('agent_invocations')
    .select('*')
    .eq('feature_id', featureId)
    .order('started_at', { ascending: true });
  if (error || !data) return [];
  return data as AgentInvocation[];
}

export async function getPhaseExecutionAttestations(
  featureId: string,
  currentPhase: Phase,
): Promise<PhaseExecutionAttestationsResult> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('phase_execution_attestations')
    .select('*')
    .eq('feature_id', featureId)
    .order('phase', { ascending: true });
  if (error) {
    const isMissingTable = isMissingTableError(error, 'phase_execution_attestations');
    const formattedError = isMissingTable
      ? formatMissingTableError('phase_execution_attestations')
      : error.message;
    return {
      attestations: [],
      error: formattedError,
      current_phase: assessCurrentPhaseExecution(currentPhase, null, formattedError),
    };
  }

  if (!data) {
    return {
      attestations: [],
      error: null,
      current_phase: assessCurrentPhaseExecution(currentPhase, null, null),
    };
  }

  const attestations = data as PhaseExecutionAttestation[];
  const currentPhaseAttestation = attestations.find((attestation) => attestation.phase === currentPhase) ?? null;

  return {
    attestations,
    error: null,
    current_phase: assessCurrentPhaseExecution(currentPhase, currentPhaseAttestation, null),
  };
}

export async function getIterationTracking(
  featureId: string
): Promise<IterationTracking[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('iteration_tracking')
    .select('*')
    .eq('feature_id', featureId)
    .order('iteration_number', { ascending: true });
  if (error || !data) return [];
  return data as IterationTracking[];
}

export async function getPhaseOutputs(
  featureId: string
): Promise<PhaseOutput[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('phase_outputs')
    .select('*')
    .eq('feature_id', featureId)
    .order('phase', { ascending: true })
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as PhaseOutput[];
}
