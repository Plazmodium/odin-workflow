/**
 * Record Phase Result Tool
 * Version: 0.1.0
 */

import type { ArchiveAdapter } from '../adapters/archive/types.js';
import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import { assessPhaseExecutionPolicy } from '../domain/execution-policy.js';
import { assessPhaseExpectedArtifacts } from '../domain/phase-artifacts.js';
import { getNextPhaseId, getPhaseContract } from '../domain/phases.js';
import { assessPromptRealizationPolicy } from '../domain/prompt-realization.js';
import { completeTaskArtifactContent } from '../domain/tasks.js';
import type { RecordPhaseResultInput } from '../schemas.js';
import type { FeatureEvalSummary } from '../types.js';
import { createErrorResult, createId, createTextResult } from '../utils.js';
import { autoArchiveFeature } from './archive-feature-release.js';
import { buildPhaseContextBundleForFeature } from './prepare-phase-context.js';

function applyAttestationOverride<T extends { warning: string | null; error: string | null }>(
  assessment: T,
  config: RuntimeConfig,
  override_reason: string | undefined,
): T {
  if (assessment.error == null || override_reason == null || config.attestation?.mode === 'strict') {
    return assessment;
  }

  return {
    ...assessment,
    warning: `${assessment.error} Override accepted: ${override_reason}`,
    error: null,
  };
}

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
  skill_adapter: SkillAdapter,
  config: RuntimeConfig,
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
  const completing_feature = input.phase === '9' && input.outcome === 'completed' && next_phase === '10';
  const execution_attestation = await adapter.getPhaseExecutionAttestation(input.feature_id, input.phase);
  const prompt_realization = await adapter.getPhasePromptRealization(input.feature_id, input.phase);
  const expected_bundle = await buildPhaseContextBundleForFeature(feature, adapter, skill_adapter, config, {
    feature_id: input.feature_id,
    phase: input.phase,
    agent_name: workflow_actor,
    include_artifacts: true,
    include_skills: true,
    include_learnings: true,
  }, {
    open_invocation: false,
  });
  const execution_assessment = applyAttestationOverride(
    assessPhaseExecutionPolicy(input.phase, execution_attestation, config.attestation),
    config,
    input.attestation_override_reason,
  );
  const prompt_realization_assessment = applyAttestationOverride(
    assessPromptRealizationPolicy(
      input.phase,
      expected_bundle.execution.phase_prompt_manifest,
      prompt_realization,
      config.attestation,
    ),
    config,
    input.attestation_override_reason,
  );

  if (execution_assessment.error != null) {
    if (config.attestation?.mode === 'strict' && input.attestation_override_reason != null) {
      await adapter.recordAuditEvent(input.feature_id, 'STRICT_ATTESTATION_OVERRIDE_REJECTED', workflow_actor, {
        phase: input.phase,
        missing_proof: 'execution_attestation',
        reason: input.attestation_override_reason,
        error: execution_assessment.error,
      });
    }
    return createErrorResult(execution_assessment.error, {
      feature_id: input.feature_id,
      phase: input.phase,
      execution: execution_assessment.row,
      recovery: 'Run the canonical Odin phase agent in a distinct worker session, record odin.register_phase_execution and odin.register_phase_realization before completion, or use a dedicated break-glass process outside normal phase completion.',
    });
  }

  if (prompt_realization_assessment.error != null) {
    if (config.attestation?.mode === 'strict' && input.attestation_override_reason != null) {
      await adapter.recordAuditEvent(input.feature_id, 'STRICT_ATTESTATION_OVERRIDE_REJECTED', workflow_actor, {
        phase: input.phase,
        missing_proof: 'prompt_realization',
        reason: input.attestation_override_reason,
        error: prompt_realization_assessment.error,
      });
    }
    return createErrorResult(prompt_realization_assessment.error, {
      feature_id: input.feature_id,
      phase: input.phase,
      prompt_realization: prompt_realization_assessment.row,
      recovery: 'Build the worker prompt from odin.prepare_phase_context, invoke the canonical phase agent or spawned subagent, record odin.register_phase_realization, then retry completion.',
    });
  }

  if (completing_feature && feature.merged_at == null) {
    return createErrorResult(
      `Feature ${input.feature_id} cannot complete Release until a merge has been recorded with odin.record_merge.`,
      {
        feature_id: input.feature_id,
        phase: input.phase,
        next_phase,
      }
    );
  }

  const artifact_completion =
    input.outcome === 'completed'
      ? assessPhaseExpectedArtifacts(
          input.phase,
          await adapter.listPhaseArtifacts(input.feature_id),
          config.attestation,
        )
      : null;

  if (artifact_completion?.error != null) {
    return createErrorResult(artifact_completion.error, {
      feature_id: input.feature_id,
      phase: input.phase,
      artifact_completion,
    });
  }

  if (input.phase === '5' && input.outcome === 'completed') {
    await completeBuilderTasks(adapter, input.feature_id, workflow_actor);
  }

  let invocation_id = (
    await adapter.findOpenAgentInvocation(input.feature_id, input.phase, workflow_actor)
  )?.id ?? null;
  let invocation_completed = false;

  if (completing_feature && invocation_id != null) {
    try {
      await adapter.completeAgentInvocation(invocation_id);
      invocation_completed = true;
    } catch {
      return createErrorResult(
        `Feature ${input.feature_id} could not complete Release because the phase 9 invocation could not be closed first.`,
        {
          feature_id: input.feature_id,
          phase: input.phase,
          invocation_id,
        }
      );
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
  if (invocation_id != null && !invocation_completed) {
    try {
      await adapter.completeAgentInvocation(invocation_id);
    } catch {
      console.error(`[Odin Runtime] Failed to complete agent invocation ${invocation_id}`);
    }
  }

  const should_record_phase_gate = input.outcome === 'completed' && (!completing_feature || updated_feature?.status === 'COMPLETED');

  // GAP-2: Record quality gate when phase completes
  if (should_record_phase_gate) {
    try {
      const phase_contract = getPhaseContract(input.phase);
      await adapter.recordQualityGate(
        input.feature_id,
        `${phase_contract.name.toLowerCase()}_phase_complete`,
        'APPROVED',
        workflow_actor,
        input.summary,
        input.phase
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

  if (completing_feature && updated_feature.status !== 'COMPLETED') {
    return createErrorResult(
      `Feature ${input.feature_id} could not complete Release because the runtime completion guard blocked finalization.`,
      {
        feature: updated_feature,
        next_phase,
        blocking_reasons: await adapter.listOpenBlockers(input.feature_id),
      }
    );
  }

  // GAP-3: Compute feature eval when feature completes
  let feature_eval: FeatureEvalSummary | null = null;
  let auto_archive: { files_archived: number; storage_path: string } | null = null;
  if (updated_feature.status === 'COMPLETED') {
    if (completing_feature) {
      try {
        feature_eval = await adapter.getLatestFeatureEval(input.feature_id);
      } catch {
        console.error(`[Odin Runtime] Failed to load feature eval for ${input.feature_id}`);
      }
    } else {
      try {
        feature_eval = await adapter.computeFeatureEval(input.feature_id);
      } catch {
        console.error(`[Odin Runtime] Failed to compute feature eval for ${input.feature_id}`);
      }
    }

    // GAP-5: Auto-archive artifacts when feature completes
    if (!completing_feature && archive_adapter != null) {
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
    execution_assessment.warning == null && prompt_realization_assessment.warning == null && artifact_completion?.warning == null
      ? `Recorded ${input.outcome} result for phase ${input.phase} on feature ${input.feature_id}.`
      : `Recorded ${input.outcome} result for phase ${input.phase} on feature ${input.feature_id}. Warning: ${[execution_assessment.warning, prompt_realization_assessment.warning, artifact_completion?.warning].filter((value): value is string => value != null).join(' ')}`,
    {
      feature: updated_feature,
      next_phase,
      execution: {
        ...execution_assessment,
      },
      prompt_realization: {
        ...prompt_realization_assessment,
      },
      artifact_completion,
      ...(feature_eval != null ? { feature_eval } : {}),
      ...(auto_archive != null ? { auto_archive } : {}),
    }
  );
}
