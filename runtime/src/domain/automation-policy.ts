import type { RuntimeConfig } from '../config.js';
import type {
  AutomationClaimVerificationSummary,
  AutomationDecision,
  ClaimVerificationSummary,
  FeatureRecord,
  QualityGateRecord,
} from '../types.js';

export interface AutomationDecisionInput {
  config: RuntimeConfig;
  feature: FeatureRecord;
  open_blockers: string[];
  open_gate_records: QualityGateRecord[];
  open_findings: string[];
  pending_claims: string[];
  claim_verification: ClaimVerificationSummary[];
  claims_needing_review_count: number;
}

function summarizeClaimVerification(
  claim_verification: ClaimVerificationSummary[],
): AutomationClaimVerificationSummary {
  return {
    total: claim_verification.length,
    passed: claim_verification.filter((claim) => claim.final_status === 'PASS').length,
    failed: claim_verification.filter((claim) => claim.final_status === 'FAIL').length,
    needs_review: claim_verification.filter((claim) => claim.final_status === 'NEEDS_REVIEW').length,
    pending: claim_verification.filter((claim) => claim.final_status === 'PENDING').length,
  };
}

export function resolveAutomationDecision(input: AutomationDecisionInput): AutomationDecision {
  const policy = input.config.automation;
  const base_branch = input.feature.base_branch ?? null;
  const allowlist = policy?.allowed_base_branches ?? [];
  const allowed_base_branch = base_branch != null && allowlist.includes(base_branch);
  const claim_summary = summarizeClaimVerification(input.claim_verification);
  const blocking_reasons: string[] = [];

  if (policy?.kill_switch) {
    blocking_reasons.push('automation kill switch is active');
  }

  if (policy?.paused) {
    blocking_reasons.push('automation is paused');
  }

  if ((policy?.mode ?? 'guarded') === 'guarded') {
    blocking_reasons.push('automation.mode is guarded; human approval is required before PR creation');
  } else {
    if (allowlist.length === 0) {
      blocking_reasons.push('automation.allowed_base_branches is empty; autonomous PR actions are denied until a base branch is allowlisted');
    } else if (!allowed_base_branch) {
      blocking_reasons.push(
        base_branch == null
          ? 'feature base branch is missing, so autonomy allowlist checks cannot pass'
          : `base branch "${base_branch}" is not allowlisted for autonomous PR actions`
      );
    }

    if (policy?.require_no_open_blockers && input.open_blockers.length > 0) {
      blocking_reasons.push(`${input.open_blockers.length} open blocker(s) still need resolution`);
    }

    if (policy?.require_green_checks && input.open_gate_records.length > 0) {
      blocking_reasons.push(`${input.open_gate_records.length} open quality gate(s) still need resolution`);
    }

    if (policy?.require_green_checks && input.open_findings.length > 0) {
      blocking_reasons.push(`${input.open_findings.length} open review finding(s) still need resolution`);
    }

    if (policy?.require_clean_policy_checks && input.pending_claims.length > 0) {
      blocking_reasons.push(`${input.pending_claims.length} claim(s) still need policy resolution`);
    }

    if (policy?.require_clean_policy_checks && claim_summary.failed > 0) {
      blocking_reasons.push(`${claim_summary.failed} claim verification result(s) are failing`);
    }

    if (policy?.require_watched_claims_verified && input.claims_needing_review_count > 0) {
      blocking_reasons.push(`${input.claims_needing_review_count} claim(s) still need watcher review`);
    }

    if (policy?.require_watched_claims_verified && claim_summary.pending > 0) {
      blocking_reasons.push(`${claim_summary.pending} claim(s) are still pending verification`);
    }

    if (policy?.require_watched_claims_verified && claim_summary.needs_review > 0) {
      blocking_reasons.push(`${claim_summary.needs_review} claim(s) still require watcher resolution`);
    }
  }

  const autonomous_pr_allowed = (policy?.mode ?? 'guarded') === 'auto_pr' && blocking_reasons.length === 0;

  return {
    configured_mode: policy?.mode ?? 'guarded',
    effective_mode: (policy?.mode ?? 'guarded') === 'auto_pr' ? 'auto_pr' : 'guarded',
    paused: policy?.paused ?? false,
    kill_switch_active: policy?.kill_switch ?? false,
    base_branch,
    allowed_base_branch,
    capabilities: {
      can_open_pr: autonomous_pr_allowed,
      can_update_pr: autonomous_pr_allowed,
      can_merge: false,
      can_continue_without_human_prompt: autonomous_pr_allowed,
    },
    blocking_reasons,
    next_human_boundary: autonomous_pr_allowed ? 'merge' : 'pr',
    preconditions: {
      open_blockers: input.open_blockers.length,
      open_gates: input.open_gate_records.length,
      open_findings: input.open_findings.length,
      pending_claims: input.pending_claims.length,
      claims_needing_review: input.claims_needing_review_count,
      claim_verification: claim_summary,
    },
  };
}
