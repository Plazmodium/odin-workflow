/**
 * Data layer: EVALS History queries
 */
import { createServerClient } from '@/lib/supabase';
import type {
  SystemHealthEval,
  AgentEval,
  EvalAlert,
} from '@/lib/types/database';

export async function getSystemHealthHistory(
  periodDays?: number
): Promise<SystemHealthEval[]> {
  const supabase = createServerClient();
  let query = supabase
    .from('system_health_evals')
    .select('*')
    .order('computed_at', { ascending: true });

  if (periodDays) {
    query = query.eq('period_days', periodDays);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as SystemHealthEval[];
}

export async function getLatestSystemHealthAllPeriods(): Promise<
  SystemHealthEval[]
> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('latest_system_health')
    .select('*')
    .order('period_days', { ascending: true });
  if (error || !data) return [];
  return data as SystemHealthEval[];
}

export async function getAgentEvals(): Promise<AgentEval[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('agent_evals')
    .select('*')
    .order('period_end', { ascending: false });
  if (error || !data) return [];
  return data as AgentEval[];
}

export async function getAlertHistory(
  limit: number = 50
): Promise<EvalAlert[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('eval_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as EvalAlert[];
}
