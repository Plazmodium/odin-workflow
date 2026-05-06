/**
 * Record Watcher Review Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import { resolveNamedActorName } from '../domain/actors.js';
import type { RecordWatcherReviewInput } from '../schemas.js';
import type { AgentClaimRecord, PhaseExecutionAttestation, WatcherReviewTrustLevel } from '../types.js';
import { createErrorResult, createTextResult } from '../utils.js';

function normalizeSessionId(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed;
}

function assessWatcherTrust(
  input: RecordWatcherReviewInput,
  claim: AgentClaimRecord,
  execution: PhaseExecutionAttestation | null,
  config: RuntimeConfig,
): { trust_level: WatcherReviewTrustLevel; error: string | null; warning: string | null } {
  const watcher_session_id = normalizeSessionId(input.watcher_session_id);
  const strict = config.attestation?.mode === 'strict';
  const override_reason = normalizeSessionId(input.independence_override_reason);
  const execution_sessions = [execution?.supervisor_session_id, execution?.worker_session_id]
    .filter((value): value is string => value != null && value.length > 0);
  const same_session = watcher_session_id != null && execution_sessions.includes(watcher_session_id);
  const missing_pass_session = input.verdict === 'PASS' && watcher_session_id == null;
  const self_review = input.verdict === 'PASS' && (same_session || missing_pass_session);

  if (!self_review) {
    return { trust_level: 'independent', error: null, warning: null };
  }

  const reason = missing_pass_session
    ? `Watcher PASS for claim ${claim.id} did not include watcher_session_id, so Odin cannot distinguish independent review from self-review.`
    : `Watcher PASS for claim ${claim.id} used the same session as the phase execution attestation.`;

  if (override_reason != null) {
    return {
      trust_level: 'override',
      error: null,
      warning: `${reason} Override accepted: ${override_reason}`,
    };
  }

  if (strict) {
    return { trust_level: 'self_review', error: `${reason} Strict attestation mode requires a distinct watcher session or independence_override_reason.`, warning: null };
  }

  return { trust_level: 'self_review', error: null, warning: reason };
}

export async function handleRecordWatcherReview(
  adapter: WorkflowStateAdapter,
  config: RuntimeConfig,
  input: RecordWatcherReviewInput
) {
  const watcher_agent = resolveNamedActorName('watcher-agent', input.watcher_agent);
  const claim = await adapter.getClaim(input.claim_id);
  if (claim == null) {
    return createErrorResult(`Claim ${input.claim_id} was not found.`, {
      claim_id: input.claim_id,
    });
  }

  const execution = await adapter.getPhaseExecutionAttestation(claim.feature_id, claim.phase);
  const trust = assessWatcherTrust(input, claim, execution, config);
  if (trust.error != null) {
    return createErrorResult(trust.error, {
      claim_id: input.claim_id,
      feature_id: claim.feature_id,
      phase: claim.phase,
      trust_level: trust.trust_level,
    });
  }

  const review = await adapter.recordWatcherReview({
    claim_id: input.claim_id,
    verdict: input.verdict,
    confidence: input.confidence,
    reasoning: input.reasoning,
    watcher_agent,
    watcher_session_id: normalizeSessionId(input.watcher_session_id),
    trust_level: trust.trust_level,
    independence_override_reason: normalizeSessionId(input.independence_override_reason),
  });

  return createTextResult(
    trust.warning == null
      ? `Recorded watcher ${review.verdict} review for claim ${review.claim_id}.`
      : `Recorded watcher ${review.verdict} review for claim ${review.claim_id}. Warning: ${trust.warning}`,
    { review, watcher_trust: trust }
  );
}
