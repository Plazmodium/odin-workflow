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
  QualityGate,
  Blocker,
  FeatureEval,
  EvalAlert,
  Learning,
  PhaseTransition,
  IterationTracking,
  PhaseOutput,
} from '@/lib/types/database';

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
): Promise<AgentDuration[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('get_agent_durations', {
    p_feature_id: featureId,
  });
  if (error || !data) return [];
  return data as AgentDuration[];
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
    .order('transitioned_at', { ascending: true });
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
    .order('phase', { ascending: true });
  if (error || !data) return [];
  return data as PhaseOutput[];
}
