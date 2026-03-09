/**
 * Data layer: Claims & Watcher queries (Odin v2)
 */
import { createServerClient } from '@/lib/supabase';
import type {
  AgentClaim,
  PolicyVerdict,
  WatcherReview,
  ClaimWithVerification,
  VerificationStatus,
} from '@/lib/types/database';

/**
 * Get all claims for a feature
 */
export async function getFeatureClaims(
  featureId: string
): Promise<AgentClaim[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('agent_claims')
    .select('*')
    .eq('feature_id', featureId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as AgentClaim[];
}

/**
 * Get policy verdicts for a claim
 */
export async function getClaimPolicyVerdicts(
  claimId: string
): Promise<PolicyVerdict[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('policy_verdicts')
    .select('*')
    .eq('claim_id', claimId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as PolicyVerdict[];
}

/**
 * Get watcher reviews for a claim
 */
export async function getClaimWatcherReviews(
  claimId: string
): Promise<WatcherReview[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('watcher_reviews')
    .select('*')
    .eq('claim_id', claimId)
    .order('reviewed_at', { ascending: false });
  if (error || !data) return [];
  return data as WatcherReview[];
}

/**
 * Get all claims for a feature with their verification status
 * This joins claims with their latest policy verdict and watcher review
 */
export async function getFeatureClaimsWithVerification(
  featureId: string
): Promise<ClaimWithVerification[]> {
  const supabase = createServerClient();
  
  // Get all claims
  const { data: claims, error: claimsError } = await supabase
    .from('agent_claims')
    .select('*')
    .eq('feature_id', featureId)
    .order('created_at', { ascending: true });
  
  if (claimsError || !claims || claims.length === 0) {
    return [];
  }

  const claimIds = claims.map((c) => c.id);

  // Get all policy verdicts for these claims
  const { data: verdicts } = await supabase
    .from('policy_verdicts')
    .select('*')
    .in('claim_id', claimIds);

  // Get all watcher reviews for these claims
  const { data: reviews } = await supabase
    .from('watcher_reviews')
    .select('*')
    .in('claim_id', claimIds);

  // Build maps for quick lookup (latest verdict/review per claim)
  const verdictMap = new Map<string, PolicyVerdict>();
  for (const v of (verdicts || []) as PolicyVerdict[]) {
    const existing = verdictMap.get(v.claim_id);
    if (!existing || new Date(v.created_at) > new Date(existing.created_at)) {
      verdictMap.set(v.claim_id, v);
    }
  }

  const reviewMap = new Map<string, WatcherReview>();
  for (const r of (reviews || []) as WatcherReview[]) {
    const existing = reviewMap.get(r.claim_id);
    if (!existing || new Date(r.reviewed_at) > new Date(existing.reviewed_at)) {
      reviewMap.set(r.claim_id, r);
    }
  }

  // Combine claims with their verification status
  return (claims as AgentClaim[]).map((claim) => {
    const verdict = verdictMap.get(claim.id);
    const review = reviewMap.get(claim.id);

    // Determine final status:
    // 1. If watcher reviewed, use watcher verdict
    // 2. Else use policy verdict
    // 3. Else PENDING
    let finalStatus: VerificationStatus = 'PENDING';
    if (review) {
      finalStatus = review.verdict;
    } else if (verdict) {
      finalStatus = verdict.verdict;
    }

    return {
      ...claim,
      policy_verdict: verdict?.verdict || null,
      policy_reason: verdict?.reason || null,
      watcher_verdict: review?.verdict || null,
      watcher_confidence: review?.confidence || null,
      watcher_reasoning: review?.reasoning || null,
      final_status: finalStatus,
    };
  });
}

/**
 * Get claims that need watcher review (NEEDS_REVIEW status from policy)
 */
export async function getClaimsNeedingReview(
  featureId: string
): Promise<ClaimWithVerification[]> {
  const allClaims = await getFeatureClaimsWithVerification(featureId);
  return allClaims.filter(
    (c) => c.policy_verdict === 'NEEDS_REVIEW' && !c.watcher_verdict
  );
}

/**
 * Summary statistics for claims in a feature
 */
export interface ClaimsSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  needsReview: number;
  watcherReviewed: number;
}

export async function getClaimsSummary(
  featureId: string
): Promise<ClaimsSummary> {
  const claims = await getFeatureClaimsWithVerification(featureId);
  
  return {
    total: claims.length,
    passed: claims.filter((c) => c.final_status === 'PASS').length,
    failed: claims.filter((c) => c.final_status === 'FAIL').length,
    pending: claims.filter((c) => c.final_status === 'PENDING').length,
    needsReview: claims.filter((c) => c.final_status === 'NEEDS_REVIEW').length,
    watcherReviewed: claims.filter((c) => c.watcher_verdict !== null).length,
  };
}
