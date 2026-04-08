/**
 * Pick Next Autonomous Phase Tool
 * Version: 0.1.0
 */

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import { resolveAutomationDecision } from '../domain/automation-policy.js';
import {
  currentAutonomousPhase,
  deriveAutonomyFeatureState,
  pickAutonomousQueueEntry,
  type AutonomousQueueEntry,
} from '../domain/autonomous-pickup.js';
import type { PickNextAutonomousPhaseInput } from '../schemas.js';
import { createTextResult } from '../utils.js';
import { handlePreparePhaseContext } from './prepare-phase-context.js';

async function buildQueueEntry(
  adapter: WorkflowStateAdapter,
  config: RuntimeConfig,
  feature_id: string,
): Promise<AutonomousQueueEntry | null> {
  const feature = await adapter.getFeature(feature_id);
  if (feature == null) {
    return null;
  }

  const [open_blockers, open_gate_records, open_findings, pending_claims, claim_verification, claims_needing_review, invocations] =
    await Promise.all([
      adapter.listOpenBlockers(feature_id),
      adapter.listOpenGateRecords(feature_id),
      adapter.listOpenFindings(feature_id),
      adapter.listPendingClaims(feature_id),
      adapter.listClaimVerificationStatus(feature_id),
      adapter.listClaimsNeedingReview(feature_id),
      adapter.listAgentInvocations(feature_id),
    ]);

  const automation = resolveAutomationDecision({
    config,
    feature,
    open_blockers,
    open_gate_records,
    open_findings,
    pending_claims,
    claim_verification,
    claims_needing_review_count: claims_needing_review.length,
  });

  return {
    feature,
    automation,
    state: deriveAutonomyFeatureState({
      feature,
      automation,
      open_blockers,
      open_gate_records,
      open_findings,
      pending_claims,
      claims_needing_review_count: claims_needing_review.length,
      has_open_invocation: invocations.some((invocation) => invocation.ended_at == null),
    }),
  };
}

export async function handlePickNextAutonomousPhase(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  config: RuntimeConfig,
  input: PickNextAutonomousPhaseInput,
) {
  const features = await adapter.listFeatures({ statuses: ['IN_PROGRESS', 'BLOCKED'] });
  const entries = (
    await Promise.all(features.map((feature) => buildQueueEntry(adapter, config, feature.id)))
  ).filter((entry): entry is AutonomousQueueEntry => entry != null);
  const phase_filtered_entries =
    input.allowed_phases == null || input.allowed_phases.length === 0
      ? entries
      : entries.filter((entry) => input.allowed_phases?.includes(entry.feature.current_phase));
  const eligible_entries =
    input.allowed_selection_reasons == null || input.allowed_selection_reasons.length === 0
      ? phase_filtered_entries
      : phase_filtered_entries.filter(
          (entry) => entry.state.selection_reason != null && input.allowed_selection_reasons?.includes(entry.state.selection_reason)
        );

  const selected = pickAutonomousQueueEntry(eligible_entries);
  const skipped_summary = phase_filtered_entries
    .filter((entry) => selected == null || entry.feature.id !== selected.feature.id)
    .map((entry) => ({
      feature_id: entry.feature.id,
      feature_name: entry.feature.name,
      current_phase: entry.feature.current_phase,
      status: entry.state.status,
      detail: entry.state.detail,
    }));

  if (selected == null) {
    return createTextResult('No autonomous phase is eligible right now.', {
      selection: null,
      skipped_summary,
    });
  }

  const phase = currentAutonomousPhase(selected.feature);
  const context_result = await handlePreparePhaseContext(adapter, skill_adapter, config, {
    feature_id: selected.feature.id,
    phase,
    agent_name: input.agent_name,
    include_artifacts: input.include_artifacts,
    include_skills: input.include_skills,
    include_learnings: input.include_learnings,
  });

  if (context_result.isError === true) {
    return context_result;
  }

  const context = context_result.structuredContent?.context;

  try {
    await adapter.recordAuditEvent(selected.feature.id, 'AUTONOMOUS_PICK_SELECTED', input.supervisor_name, {
      phase,
      selection_reason: selected.state.selection_reason,
      board_status: selected.state.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown audit failure';
    console.error(`[Odin Runtime] Failed to record autonomous pick audit event: ${message}`);
  }

  return createTextResult(
    `Selected feature ${selected.feature.id} phase ${phase} for autonomous pickup.`,
    {
      selection: {
        feature_id: selected.feature.id,
        feature_name: selected.feature.name,
        phase,
        reason: selected.state.selection_reason,
      },
      context,
      skipped_summary,
    },
  );
}
