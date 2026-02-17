/**
 * Data layer: Health Overview queries
 */
import { createServerClient } from '@/lib/supabase';
import type {
  SystemHealthEval,
  FeatureHealthOverview,
  AllFeatureSummary,
  ActiveEvalAlert,
  ActiveLearning,
} from '@/lib/types/database';

export async function getLatestSystemHealth(
  periodDays: number = 7
): Promise<SystemHealthEval | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('latest_system_health')
    .select('*')
    .eq('period_days', periodDays)
    .maybeSingle();
  if (error || !data) return null;
  return data as SystemHealthEval;
}

export async function getFeatureHealthOverview(): Promise<FeatureHealthOverview[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('feature_health_overview')
    .select('*')
    .order('active_alerts', { ascending: false });
  if (error || !data) return [];
  return data as FeatureHealthOverview[];
}

export async function getActiveAlerts(): Promise<ActiveEvalAlert[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('active_eval_alerts')
    .select('*')
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as ActiveEvalAlert[];
}

export async function getActiveLearningStats(): Promise<{
  total: number;
  highConfidence: number;
  openConflicts: number;
  propagated: number;
}> {
  const supabase = createServerClient();

  const [learningsResult, conflictsResult, propagatedResult] = await Promise.all([
    supabase.from('active_learnings').select('id, confidence_score', { count: 'exact' }),
    supabase.from('open_learning_conflicts').select('id', { count: 'exact' }),
    supabase
      .from('learning_propagation_overview')
      .select('learning_id', { count: 'exact' })
      .eq('propagation_status', 'complete'),
  ]);

  const total = learningsResult.count ?? 0;
  const highConfidence = learningsResult.data?.filter(
    (l) => (l as { confidence_score: number }).confidence_score >= 0.8
  ).length ?? 0;

  return {
    total,
    highConfidence,
    openConflicts: conflictsResult.count ?? 0,
    propagated: propagatedResult.count ?? 0,
  };
}

export async function getQuickStats(): Promise<{
  inProgress: number;
  blocked: number;
  completed: number;
  openAlerts: number;
  openBlockers: number;
}> {
  const supabase = createServerClient();

  const [inProgressResult, blockedResult, completedResult, alertsResult, blockersResult] =
    await Promise.all([
      supabase.from('features').select('id', { count: 'exact' }).eq('status', 'IN_PROGRESS'),
      supabase.from('features').select('id', { count: 'exact' }).eq('status', 'BLOCKED'),
      supabase.from('features').select('id', { count: 'exact' }).eq('status', 'COMPLETED'),
      supabase.from('active_eval_alerts').select('id', { count: 'exact' }),
      supabase.from('blockers').select('id', { count: 'exact' }).eq('status', 'OPEN'),
    ]);

  return {
    inProgress: inProgressResult.count ?? 0,
    blocked: blockedResult.count ?? 0,
    completed: completedResult.count ?? 0,
    openAlerts: alertsResult.count ?? 0,
    openBlockers: blockersResult.count ?? 0,
  };
}

export async function getAllFeaturesSummary(): Promise<AllFeatureSummary[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('all_features_summary')
    .select('*');
  if (error || !data) return [];
  return data as AllFeatureSummary[];
}

export async function getRecentLearnings(
  limit: number = 5
): Promise<ActiveLearning[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('active_learnings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as ActiveLearning[];
}
