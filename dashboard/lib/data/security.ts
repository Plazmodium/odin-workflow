/**
 * Data layer: Security Findings queries (Odin v2)
 */
import { createServerClient } from '@/lib/supabase';
import type { SecurityFinding, FindingSeverity } from '@/lib/types/database';

/**
 * Get all security findings for a feature
 */
export async function getSecurityFindings(
  featureId: string
): Promise<SecurityFinding[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('security_findings')
    .select('*')
    .eq('feature_id', featureId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as SecurityFinding[];
}

/**
 * Get unresolved security findings for a feature
 */
export async function getUnresolvedFindings(
  featureId: string
): Promise<SecurityFinding[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('security_findings')
    .select('*')
    .eq('feature_id', featureId)
    .eq('resolved', false)
    .order('severity', { ascending: false }) // CRITICAL first
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as SecurityFinding[];
}

/**
 * Get blocking findings (HIGH and CRITICAL severity that are unresolved)
 */
export async function getBlockingFindings(
  featureId: string
): Promise<SecurityFinding[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('security_findings')
    .select('*')
    .eq('feature_id', featureId)
    .eq('resolved', false)
    .in('severity', ['HIGH', 'CRITICAL'])
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as SecurityFinding[];
}

/**
 * Summary statistics for security findings in a feature
 */
export interface SecuritySummary {
  total: number;
  resolved: number;
  unresolved: number;
  blocking: number; // HIGH + CRITICAL unresolved
  bySeverity: Record<FindingSeverity, { total: number; resolved: number }>;
}

export async function getSecuritySummary(
  featureId: string
): Promise<SecuritySummary> {
  const findings = await getSecurityFindings(featureId);
  
  const bySeverity: Record<FindingSeverity, { total: number; resolved: number }> = {
    INFO: { total: 0, resolved: 0 },
    LOW: { total: 0, resolved: 0 },
    MEDIUM: { total: 0, resolved: 0 },
    HIGH: { total: 0, resolved: 0 },
    CRITICAL: { total: 0, resolved: 0 },
  };

  let resolved = 0;
  let blocking = 0;

  for (const f of findings) {
    bySeverity[f.severity].total++;
    if (f.resolved) {
      bySeverity[f.severity].resolved++;
      resolved++;
    } else if (f.severity === 'HIGH' || f.severity === 'CRITICAL') {
      blocking++;
    }
  }

  return {
    total: findings.length,
    resolved,
    unresolved: findings.length - resolved,
    blocking,
    bySeverity,
  };
}

/**
 * Check if feature has blocking security findings
 * (unresolved HIGH or CRITICAL findings)
 */
export async function hasBlockingFindings(
  featureId: string
): Promise<boolean> {
  const blocking = await getBlockingFindings(featureId);
  return blocking.length > 0;
}
