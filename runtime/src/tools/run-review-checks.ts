/**
 * Run Review Checks Tool
 * Version: 0.1.0
 */

import type { ReviewAdapter } from '../adapters/review/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { SkillAdapter } from '../adapters/skills/types.js';
import type { RuntimeConfig } from '../config.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import type { RunReviewChecksInput } from '../schemas.js';
import { createErrorResult, createId, createTextResult } from '../utils.js';
import { assessStrictPhaseAgentPrework } from './phase-agent-prework.js';

export async function handleRunReviewChecks(
  adapter: WorkflowStateAdapter,
  review_adapter: ReviewAdapter,
  input: RunReviewChecksInput,
  skill_adapter?: SkillAdapter,
  config?: RuntimeConfig,
) {
  if (config?.attestation?.mode === 'strict' && skill_adapter == null) {
    return createErrorResult('Strict attestation mode requires skill_adapter for run review checks so phase-agent prework cannot be bypassed.', {
      feature_id: input.feature_id,
      phase: input.phase,
      recovery: 'Provide the runtime skill adapter when calling odin.run_review_checks in strict attestation mode.',
    });
  }

  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  if (skill_adapter != null && config != null) {
    const prework_error = await assessStrictPhaseAgentPrework(
      adapter,
      skill_adapter,
      config,
      feature,
      input.phase,
      resolveWorkflowActorName(input.phase, input.initiated_by),
      'run review checks',
    );
    if (prework_error != null) {
      return prework_error;
    }
  }

  const execution = await review_adapter.runChecks({
    feature_id: input.feature_id,
    tool: input.tool,
    changed_files: input.changed_files,
  });

  const review_check = await adapter.recordReviewCheck({
    id: createId('review'),
    feature_id: input.feature_id,
    phase: input.phase,
    tool: execution.tool,
    status: execution.status,
    summary: execution.summary,
    changed_files: execution.changed_files,
    initiated_by: input.initiated_by,
    created_at: new Date().toISOString(),
  });

  // GAP-4: Persist individual security findings for dashboard visibility
  let findings_recorded = 0;
  if (execution.findings.length > 0) {
    try {
      findings_recorded = await adapter.recordSecurityFindings(
        input.feature_id,
        input.phase,
        execution.findings,
        input.tool
      );
    } catch {
      console.error(`[Odin Runtime] Failed to record security findings for ${input.feature_id}`);
    }
  }

  return createTextResult(
    `Review checks completed for feature ${review_check.feature_id} with status ${review_check.status}.`,
    {
      review_check,
      findings: execution.findings,
      findings_recorded,
    }
  );
}
