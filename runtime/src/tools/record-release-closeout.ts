/**
 * Record Release Closeout Tool
 * Version: 0.1.0
 */

import type { ArchiveAdapter } from '../adapters/archive/types.js';
import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import type { RecordReleaseCloseoutInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';
import { handleRecordPhaseResult } from './record-phase-result.js';

export async function handleRecordReleaseCloseout(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  config: RuntimeConfig,
  archive_adapter: ArchiveAdapter | null,
  input: RecordReleaseCloseoutInput,
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const needs_phase_completion = feature.current_phase === '9';
  const can_retry_missing_closeout = feature.current_phase === '10' && feature.release_closeout_at == null;

  if (!needs_phase_completion && !can_retry_missing_closeout) {
    return createErrorResult(
      `Feature ${input.feature_id} is currently in phase ${feature.current_phase}, not Release.`,
      {
        feature_id: input.feature_id,
        current_phase: feature.current_phase,
      },
    );
  }

  if (feature.pr_url == null || feature.pr_number == null) {
    return createErrorResult(
      `Feature ${input.feature_id} cannot record release closeout until a pull request is recorded.`,
      { feature_id: input.feature_id },
    );
  }

  if (feature.merged_at == null) {
    return createErrorResult(
      `Feature ${input.feature_id} cannot record release closeout until a merge has been recorded with odin.record_merge.`,
      { feature_id: input.feature_id },
    );
  }

  const result = needs_phase_completion
    ? await handleRecordPhaseResult(adapter, skill_adapter, config, archive_adapter, {
        feature_id: input.feature_id,
        phase: '9',
        outcome: 'completed',
        next_phase: '10',
        summary: input.summary,
        created_by: input.created_by,
        blockers: [],
      })
    : null;

  if (result?.isError === true) {
    return result;
  }

  const actor = resolveWorkflowActorName('9', input.created_by);
  const closeout = await adapter.recordReleaseCloseout(input.feature_id, input.summary, actor);
  await adapter.recordAuditEvent(input.feature_id, 'RELEASE_CLOSEOUT_RECORDED', actor, {
    summary: input.summary,
    pr_url: feature.pr_url,
    pr_number: feature.pr_number,
    merged_at: feature.merged_at,
  });
  const refreshed = await adapter.getFeature(input.feature_id);

  return createTextResult(
    `Recorded release closeout for feature ${input.feature_id}.`,
    {
      feature: refreshed,
      closeout,
      phase_result: result?.structuredContent ?? null,
    },
  );
}
