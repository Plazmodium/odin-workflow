/**
 * Record Phase Result Tool
 * Version: 0.1.0
 */

import type { ArchiveAdapter } from '../adapters/archive/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import { getNextPhaseId, getPhaseContract } from '../domain/phases.js';
import { completeTaskArtifactContent } from '../domain/tasks.js';
import type { RecordPhaseResultInput } from '../schemas.js';
import type { FeatureEvalSummary } from '../types.js';
import { createErrorResult, createId, createTextResult } from '../utils.js';
import { autoArchiveFeature } from './archive-feature-release.js';

async function completeBuilderTasks(
  adapter: WorkflowStateAdapter,
  feature_id: string,
  created_by: string
): Promise<void> {
  const artifacts = await adapter.listPhaseArtifacts(feature_id);
  const latest_tasks = artifacts.filter((artifact) => artifact.output_type === 'tasks').at(-1);

  if (latest_tasks == null) {
    return;
  }

  const completed = completeTaskArtifactContent(latest_tasks.content);
  if (!completed.changed) {
    return;
  }

  await adapter.recordPhaseArtifact({
    id: createId('artifact'),
    feature_id,
    phase: latest_tasks.phase,
    output_type: latest_tasks.output_type,
    content: completed.content,
    created_by,
    created_at: new Date().toISOString(),
  });
}

export async function handleRecordPhaseResult(
  adapter: WorkflowStateAdapter,
  archive_adapter: ArchiveAdapter | null,
  input: RecordPhaseResultInput
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  if (feature.current_phase !== input.phase) {
    return createErrorResult(
      `Feature ${input.feature_id} is currently in phase ${feature.current_phase}, not ${input.phase}.`,
      {
        feature_id: input.feature_id,
        expected_phase: feature.current_phase,
        provided_phase: input.phase,
      }
    );
  }

  const next_phase =
    input.outcome === 'completed' ? input.next_phase ?? getNextPhaseId(input.phase) : input.next_phase ?? null;
  const workflow_actor = resolveWorkflowActorName(input.phase, input.created_by);

  if (input.phase === '5' && input.outcome === 'completed') {
    await completeBuilderTasks(adapter, input.feature_id, workflow_actor);
  }

  let invocation_id = (
    await adapter.findOpenAgentInvocation(input.feature_id, input.phase, workflow_actor)
  )?.id ?? null;

  if (invocation_id == null && input.phase !== '10') {
    try {
      const phase_contract = getPhaseContract(input.phase);
      const invocation = await adapter.startAgentInvocation(
        input.feature_id,
        input.phase,
        workflow_actor,
        `Phase ${input.phase}: ${phase_contract.name} (fallback)`
      );
      invocation_id = invocation.id;
    } catch {
      console.error(`[Odin Runtime] Failed to start agent invocation for ${input.feature_id} phase ${input.phase}`);
    }
  }

  const updated_feature = await adapter.recordPhaseResult({
    id: createId('result'),
    feature_id: input.feature_id,
    phase: input.phase,
    outcome: input.outcome,
    summary: input.summary,
    next_phase,
    blockers: input.blockers,
    created_by: workflow_actor,
    created_at: new Date().toISOString(),
  });

  // GAP-1: Complete the agent invocation
  if (invocation_id != null) {
    try {
      await adapter.completeAgentInvocation(invocation_id);
    } catch {
      console.error(`[Odin Runtime] Failed to complete agent invocation ${invocation_id}`);
    }
  }

  // GAP-2: Record quality gate when phase completes
  if (input.outcome === 'completed') {
    try {
      const phase_contract = getPhaseContract(input.phase);
      await adapter.recordQualityGate(
        input.feature_id,
        `${phase_contract.name.toLowerCase()}_phase_complete`,
        'APPROVED',
        workflow_actor,
        input.summary
      );
    } catch {
      console.error(`[Odin Runtime] Failed to record quality gate for ${input.feature_id} phase ${input.phase}`);
    }
  }

  if (updated_feature == null) {
    return createErrorResult(`Feature ${input.feature_id} could not be updated.`, {
      feature_id: input.feature_id,
    });
  }

  // GAP-3: Compute feature eval when feature completes
  let feature_eval: FeatureEvalSummary | null = null;
  let auto_archive: { files_archived: number; storage_path: string } | null = null;
  if (updated_feature.status === 'COMPLETED') {
    try {
      feature_eval = await adapter.computeFeatureEval(input.feature_id);
    } catch {
      console.error(`[Odin Runtime] Failed to compute feature eval for ${input.feature_id}`);
    }

    // GAP-5: Auto-archive artifacts when feature completes
    if (archive_adapter != null) {
      try {
        auto_archive = await autoArchiveFeature(
          adapter,
          archive_adapter,
          input.feature_id,
          input.summary,
          input.created_by
        );
      } catch {
        console.error(`[Odin Runtime] Failed to auto-archive feature ${input.feature_id}`);
      }
    }
  }

  return createTextResult(
    `Recorded ${input.outcome} result for phase ${input.phase} on feature ${input.feature_id}.`,
    {
      feature: updated_feature,
      next_phase,
      ...(feature_eval != null ? { feature_eval } : {}),
      ...(auto_archive != null ? { auto_archive } : {}),
    }
  );
}
