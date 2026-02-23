'use server';

/**
 * Server Actions for EVAL computation and alert management
 */
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase';

function formatRpcError(errorMessage: string, functionName: string): string {
  if (errorMessage.includes(`Could not find the function public.${functionName}`)) {
    return `RPC function ${functionName} is missing in Supabase. Apply the latest migrations and verify the function exists.`;
  }

  return errorMessage;
}

export async function refreshSystemHealth(periodDays: number = 7) {
  const supabase = createServerClient();
  const { error } = await supabase.rpc('compute_system_health', {
    p_period_days: periodDays,
  });
  if (error) {
    return { success: false, error: error.message };
  }
  revalidatePath('/');
  revalidatePath('/evals');
  return { success: true };
}

export async function refreshFeatureEval(featureId: string) {
  const supabase = createServerClient();
  const { error } = await supabase.rpc('compute_feature_eval', {
    p_feature_id: featureId,
  });
  if (error) {
    return {
      success: false,
      error: formatRpcError(error.message, 'compute_feature_eval'),
    };
  }
  revalidatePath(`/features/${featureId}`);
  revalidatePath('/');
  return { success: true };
}

export async function acknowledgeAlert(alertId: string) {
  const supabase = createServerClient();
  const { error } = await supabase.rpc('acknowledge_alert', {
    p_alert_id: alertId,
    p_acknowledged_by: 'dashboard-user',
  });
  if (error) {
    return { success: false, error: error.message };
  }
  revalidatePath('/');
  return { success: true };
}

export async function resolveAlert(alertId: string, notes: string) {
  const supabase = createServerClient();
  const { error } = await supabase.rpc('resolve_alert', {
    p_alert_id: alertId,
    p_resolved_by: 'dashboard-user',
    p_resolution_notes: notes,
  });
  if (error) {
    return { success: false, error: error.message };
  }
  revalidatePath('/');
  return { success: true };
}
