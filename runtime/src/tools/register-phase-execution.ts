import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { getPhaseAgentInstructions, getPhaseExecutionContract } from '../domain/phases.js';
import type { RegisterPhaseExecutionInput } from '../schemas.js';
import type { PhaseExecutionAttestation } from '../types.js';
import { createErrorResult, createTextResult } from '../utils.js';

function normalizeSessionId(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed;
}

function buildAttestation(
  input: RegisterPhaseExecutionInput,
): PhaseExecutionAttestation | { error: string } {
  const phase_role_name = getPhaseAgentInstructions(input.phase).name;
  const execution = getPhaseExecutionContract(input.phase, phase_role_name);
  const supervisor_session_id = normalizeSessionId(input.supervisor_session_id);
  const worker_session_id = normalizeSessionId(input.worker_session_id);
  const harness_run_id = normalizeSessionId(input.harness_run_id);

  if (supervisor_session_id == null) {
    return { error: 'supervisor_session_id is required to attest actual execution mode.' };
  }

  if (input.actual_mode === 'subagent') {
    if (worker_session_id == null) {
      return { error: 'worker_session_id is required when actual_mode is subagent.' };
    }

    if (worker_session_id === supervisor_session_id) {
      return { error: 'worker_session_id must differ from supervisor_session_id when actual_mode is subagent.' };
    }
  }

  if (input.actual_mode === 'inline' && worker_session_id != null && worker_session_id !== supervisor_session_id) {
    return { error: 'worker_session_id must be omitted or match supervisor_session_id when actual_mode is inline.' };
  }

  return {
    feature_id: input.feature_id,
    phase: input.phase,
    execution_policy: execution.execution_policy,
    recommended_mode: execution.recommended_mode,
    actual_mode: input.actual_mode,
    proof_status: 'attested',
    supervisor_session_id,
    worker_session_id: input.actual_mode === 'inline' ? supervisor_session_id : worker_session_id,
    harness_run_id,
    attested_by: input.attested_by,
    attestation_source: 'harness',
    recorded_at: new Date().toISOString(),
  };
}

export async function handleRegisterPhaseExecution(
  adapter: WorkflowStateAdapter,
  input: RegisterPhaseExecutionInput,
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

  const attestation = buildAttestation(input);
  if ('error' in attestation) {
    return createErrorResult(attestation.error, {
      feature_id: input.feature_id,
      phase: input.phase,
      actual_mode: input.actual_mode,
    });
  }

  const recorded = await adapter.registerPhaseExecution(attestation);
  return createTextResult(
    `Registered ${recorded.actual_mode} execution for feature ${recorded.feature_id} phase ${recorded.phase}.`,
    { attestation: recorded },
  );
}
