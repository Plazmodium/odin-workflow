/**
 * Data layer: Audit Log queries
 */
import { createServerClient } from '@/lib/supabase';
import type { AuditLogEntry } from '@/lib/types/database';

/** Get audit log entries for a specific feature */
export async function getFeatureAuditLog(
  featureId: string,
  limit: number = 100
): Promise<AuditLogEntry[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('feature_id', featureId)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as AuditLogEntry[];
}

/** Get recent audit log entries across all features */
export async function getRecentAuditLog(
  limit: number = 50
): Promise<AuditLogEntry[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as AuditLogEntry[];
}
