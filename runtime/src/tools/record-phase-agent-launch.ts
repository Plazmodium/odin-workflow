import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import { getPhaseAgentInstructions } from '../domain/phases.js';
import type { RecordPhaseAgentLaunchInput } from '../schemas.js';
import { createErrorResult, createTextResult } from '../utils.js';
import { buildPhaseContextBundleForFeature } from './prepare-phase-context.js';

export async function handleRecordPhaseAgentLaunch(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  config: RuntimeConfig,
  input: RecordPhaseAgentLaunchInput,
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, { feature_id: input.feature_id });
  }

  if (feature.current_phase !== input.phase) {
    return createErrorResult(`Feature ${input.feature_id} is currently in phase ${feature.current_phase}, not ${input.phase}.`, {
      feature_id: input.feature_id,
      expected_phase: feature.current_phase,
      provided_phase: input.phase,
    });
  }

  const actor = resolveWorkflowActorName(input.phase, input.agent_name ?? input.launched_by);
  const phase_role_name = getPhaseAgentInstructions(input.phase).name;

  if (input.launch_mode === 'inline_reduced_fidelity') {
    await adapter.recordAuditEvent(input.feature_id, 'PHASE_REDUCED_FIDELITY_RECORDED', actor, {
      phase: input.phase,
      phase_role_name,
      launched_by: input.launched_by,
      reason: input.reduced_fidelity_reason,
      supervisor_session_id: input.supervisor_session_id ?? null,
      harness_run_id: input.harness_run_id ?? null,
    });

    return createTextResult(
      `Recorded reduced-fidelity inline execution for feature ${input.feature_id} phase ${input.phase}.`,
      {
        feature_id: input.feature_id,
        phase: input.phase,
        fidelity: 'inline_reduced_fidelity',
      },
    );
  }

  if (input.manifest == null) {
    return createErrorResult('A launch manifest is required for direct_agent and subagent launches.', {
      feature_id: input.feature_id,
      phase: input.phase,
      provided_manifest_id: null,
    });
  }

  const expected_bundle = await buildPhaseContextBundleForFeature(feature, adapter, skill_adapter, config, {
    feature_id: input.feature_id,
    phase: input.phase,
    agent_name: actor,
    include_artifacts: true,
    include_skills: true,
    include_learnings: true,
  }, { open_invocation: false });
  const expected_manifest = expected_bundle.execution.phase_prompt_manifest;

  if (expected_manifest == null) {
    return createErrorResult(`Phase ${input.phase} does not expose a canonical phase prompt manifest.`, {
      feature_id: input.feature_id,
      phase: input.phase,
    });
  }

  if (input.manifest.manifest_id !== expected_manifest.manifest_id) {
    return createErrorResult('Launch manifest does not match the current canonical phase prompt manifest.', {
      feature_id: input.feature_id,
      phase: input.phase,
      expected_manifest_id: expected_manifest.manifest_id,
      provided_manifest_id: input.manifest.manifest_id,
    });
  }

  await adapter.recordAuditEvent(input.feature_id, 'PHASE_AGENT_LAUNCH_RECORDED', actor, {
    phase: input.phase,
    phase_role_name,
    launch_mode: input.launch_mode,
    launched_by: input.launched_by,
    supervisor_session_id: input.supervisor_session_id ?? null,
    worker_session_id: input.worker_session_id ?? null,
    harness_run_id: input.harness_run_id ?? null,
    manifest_id: expected_manifest.manifest_id,
    phase_definition_hash: expected_manifest.phase_definition_hash,
    resolved_skill_hashes: expected_manifest.resolved_skill_hashes,
  });

  return createTextResult(
    `Recorded ${input.launch_mode} launch for feature ${input.feature_id} phase ${input.phase}.`,
    {
      feature_id: input.feature_id,
      phase: input.phase,
      launch_mode: input.launch_mode,
      manifest_id: expected_manifest.manifest_id,
    },
  );
}
