import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { SkillAdapter } from '../adapters/skills/types.js';
import type { RuntimeConfig } from '../config.js';
import { computePhasePromptManifestId, computeStaticPhasePromptHashes } from '../domain/phase-prompt-manifest.js';
import { getPhaseAgentInstructions, getPhaseExecutionContract } from '../domain/phases.js';
import type { RegisterPhaseRealizationInput } from '../schemas.js';
import type { PhasePromptRealizationAttestation } from '../types.js';
import { createErrorResult, createTextResult } from '../utils.js';
import { buildPhaseContextBundleForFeature } from './prepare-phase-context.js';

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeSessionId(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed;
}

export async function handleRegisterPhaseRealization(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  config: RuntimeConfig,
  input: RegisterPhaseRealizationInput,
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
      },
    );
  }

  const phase_role_name = getPhaseAgentInstructions(input.phase).name;
  const execution = getPhaseExecutionContract(input.phase, phase_role_name);
  const execution_attestation = await adapter.getPhaseExecutionAttestation(input.feature_id, input.phase);
  const expected_bundle = await buildPhaseContextBundleForFeature(feature, adapter, skill_adapter, config, {
    feature_id: input.feature_id,
    phase: input.phase,
    include_artifacts: true,
    include_skills: true,
    include_learnings: true,
  }, {
    open_invocation: false,
  });
  const expected_manifest = expected_bundle.execution.phase_prompt_manifest;

  if (expected_manifest == null) {
    return createErrorResult(
      `Phase ${input.phase} does not expose a canonical phase prompt manifest.`,
      {
        feature_id: input.feature_id,
        phase: input.phase,
      },
    );
  }

  if (execution_attestation == null) {
    return createErrorResult(
      `Phase ${input.phase} must have an execution attestation before prompt realization can be recorded.`,
      {
        feature_id: input.feature_id,
        phase: input.phase,
      },
    );
  }

  if (execution_attestation.actual_mode !== input.actual_mode) {
    return createErrorResult(
      `Prompt realization actual_mode ${input.actual_mode} does not match the recorded execution attestation mode ${execution_attestation.actual_mode}.`,
      {
        feature_id: input.feature_id,
        phase: input.phase,
        execution_actual_mode: execution_attestation.actual_mode,
        realization_actual_mode: input.actual_mode,
      },
    );
  }

  if (input.manifest.phase_role_name !== phase_role_name) {
    return createErrorResult(
      `Manifest role ${input.manifest.phase_role_name} does not match the canonical phase role ${phase_role_name}.`,
      {
        feature_id: input.feature_id,
        phase: input.phase,
      },
    );
  }

  if (!arraysEqual(input.manifest.required_prompt_sections, execution.prompt_sections)) {
    return createErrorResult(
      `Manifest required_prompt_sections do not match the canonical prompt sections for phase ${input.phase}.`,
      {
        feature_id: input.feature_id,
        phase: input.phase,
      },
    );
  }

  const expected_manifest_id = computePhasePromptManifestId({
    phase: input.manifest.phase,
    phase_role_name: input.manifest.phase_role_name,
    shared_context_hash: input.manifest.shared_context_hash,
    phase_definition_hash: input.manifest.phase_definition_hash,
    resolved_skill_hashes: input.manifest.resolved_skill_hashes,
    required_prompt_sections: input.manifest.required_prompt_sections,
    context_bundle_hash: input.manifest.context_bundle_hash,
    manifest_version: input.manifest.manifest_version,
    nonce: input.manifest.nonce,
  });

  if (input.manifest.manifest_id !== expected_manifest_id) {
    return createErrorResult(
      'manifest_id does not match the submitted manifest payload.',
      {
        feature_id: input.feature_id,
        phase: input.phase,
      },
    );
  }

  const static_hashes = await computeStaticPhasePromptHashes(input.phase);
  if (input.manifest.shared_context_hash !== static_hashes.shared_context_hash) {
    return createErrorResult(
      'Manifest shared_context_hash does not match the canonical Odin shared context file.',
      {
        feature_id: input.feature_id,
        phase: input.phase,
      },
    );
  }

  if (input.manifest.phase_definition_hash !== static_hashes.phase_definition_hash) {
    return createErrorResult(
      'Manifest phase_definition_hash does not match the canonical Odin phase definition file.',
      {
        feature_id: input.feature_id,
        phase: input.phase,
      },
    );
  }

  const supervisor_session_id = normalizeSessionId(input.supervisor_session_id);
  const worker_session_id = normalizeSessionId(input.worker_session_id);

  if (
    supervisor_session_id !== execution_attestation.supervisor_session_id ||
    worker_session_id !== execution_attestation.worker_session_id
  ) {
    return createErrorResult(
      'Prompt realization session linkage does not match the recorded execution attestation.',
      {
        feature_id: input.feature_id,
        phase: input.phase,
      },
    );
  }

  if (input.manifest.manifest_id !== expected_manifest.manifest_id) {
    return createErrorResult(
      'manifest_id does not match the current canonical phase prompt manifest returned by odin.prepare_phase_context(...).',
      {
        feature_id: input.feature_id,
        phase: input.phase,
        expected_manifest_id: expected_manifest.manifest_id,
        provided_manifest_id: input.manifest.manifest_id,
      },
    );
  }

  if (input.manifest.context_bundle_hash !== expected_manifest.context_bundle_hash) {
    return createErrorResult(
      'context_bundle_hash does not match the current canonical phase prompt bundle.',
      {
        feature_id: input.feature_id,
        phase: input.phase,
      },
    );
  }

  if (!arraysEqual(input.manifest.resolved_skill_hashes, expected_manifest.resolved_skill_hashes)) {
    return createErrorResult(
      'resolved_skill_hashes do not match the current canonical phase prompt bundle.',
      {
        feature_id: input.feature_id,
        phase: input.phase,
      },
    );
  }

  const attestation: PhasePromptRealizationAttestation = {
    feature_id: input.feature_id,
    phase: input.phase,
    phase_role_name,
    prompt_realization_policy: execution.prompt_realization_policy,
    manifest_id: input.manifest.manifest_id,
    manifest_version: input.manifest.manifest_version,
    shared_context_hash: input.manifest.shared_context_hash,
    phase_definition_hash: input.manifest.phase_definition_hash,
    resolved_skill_hashes: [...input.manifest.resolved_skill_hashes],
    required_prompt_sections: [...input.manifest.required_prompt_sections],
    context_bundle_hash: input.manifest.context_bundle_hash,
    nonce: input.manifest.nonce,
    actual_mode: input.actual_mode,
    proof_status: input.proof_status,
    supervisor_session_id,
    worker_session_id,
    harness_run_id: normalizeSessionId(input.harness_run_id),
    attested_by: input.attested_by,
    child_prompt_hash: input.child_prompt_hash,
    wrapper_hash: input.wrapper_hash?.trim() ?? null,
    child_ack_nonce: input.child_ack_nonce?.trim() ?? null,
    recorded_at: new Date().toISOString(),
  };

  const recorded = await adapter.registerPhasePromptRealization(attestation);
  return createTextResult(
    `Registered ${recorded.proof_status} prompt realization for feature ${recorded.feature_id} phase ${recorded.phase}.`,
    { realization: recorded },
  );
}
