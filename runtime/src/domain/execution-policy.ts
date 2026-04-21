import { getPhaseAgentInstructions, getPhaseExecutionContract } from './phases.js';

import type {
  PhaseExecutionAttestation,
  PhaseExecutionMode,
  PhaseExecutionPolicy,
  PhaseExecutionProofStatus,
  PhaseId,
} from '../types.js';

export const EXECUTION_AUDIT_PHASES: PhaseId[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export interface PhaseExecutionStatusRow {
  phase: PhaseId;
  phase_role_name: string;
  recommended_mode: PhaseExecutionMode;
  execution_policy: PhaseExecutionPolicy;
  actual_mode: PhaseExecutionMode | null;
  proof_status: PhaseExecutionProofStatus;
  attested_by: string | null;
  supervisor_session_id: string | null;
  worker_session_id: string | null;
  harness_run_id: string | null;
  attestation_source: PhaseExecutionAttestation['attestation_source'];
}

export interface PhaseExecutionPolicyAssessment {
  row: PhaseExecutionStatusRow;
  warning: string | null;
  error: string | null;
}

export interface PhaseExecutionStatusSummary {
  rows: PhaseExecutionStatusRow[];
  counts: {
    attested: number;
    verified: number;
    subagent_attested: number;
  };
  preferred_without_distinct_session: Array<{ phase: PhaseId; phase_role_name: string }>;
  required_without_distinct_session: Array<{ phase: PhaseId; phase_role_name: string }>;
}

function defaultRow(phase: PhaseId): PhaseExecutionStatusRow {
  const phase_role_name = getPhaseAgentInstructions(phase).name;
  const contract = getPhaseExecutionContract(phase, phase_role_name);

  return {
    phase,
    phase_role_name,
    recommended_mode: contract.recommended_mode,
    execution_policy: contract.execution_policy,
    actual_mode: null,
    proof_status: 'none',
    attested_by: null,
    supervisor_session_id: null,
    worker_session_id: null,
    harness_run_id: null,
    attestation_source: null,
  };
}

function hasDistinctSessionProof(row: PhaseExecutionStatusRow): boolean {
  return (
    row.actual_mode === 'subagent' &&
    row.proof_status !== 'none' &&
    row.supervisor_session_id != null &&
    row.worker_session_id != null &&
    row.worker_session_id !== row.supervisor_session_id
  );
}

export function buildPhaseExecutionStatusRow(
  phase: PhaseId,
  attestation: PhaseExecutionAttestation | null,
): PhaseExecutionStatusRow {
  const row = defaultRow(phase);
  if (attestation == null) {
    return row;
  }

  return {
    ...row,
    actual_mode: attestation.actual_mode,
    proof_status: attestation.proof_status,
    attested_by: attestation.attested_by,
    supervisor_session_id: attestation.supervisor_session_id,
    worker_session_id: attestation.worker_session_id,
    harness_run_id: attestation.harness_run_id,
    attestation_source: attestation.attestation_source,
  };
}

export function assessPhaseExecutionPolicy(
  phase: PhaseId,
  attestation: PhaseExecutionAttestation | null,
): PhaseExecutionPolicyAssessment {
  const row = buildPhaseExecutionStatusRow(phase, attestation);

  if (row.execution_policy === 'inline_allowed') {
    return { row, warning: null, error: null };
  }

  if (hasDistinctSessionProof(row)) {
    return { row, warning: null, error: null };
  }

  const missing_message =
    row.actual_mode == null
      ? `Phase ${phase} (${row.phase_role_name}) ${row.execution_policy === 'distinct_session_required' ? 'requires' : 'prefers'} a distinct worker session, but no execution attestation was recorded.`
      : row.actual_mode === 'inline'
        ? `Phase ${phase} (${row.phase_role_name}) ${row.execution_policy === 'distinct_session_required' ? 'requires' : 'prefers'} a distinct worker session, but the recorded actual mode was inline.`
        : `Phase ${phase} (${row.phase_role_name}) ${row.execution_policy === 'distinct_session_required' ? 'requires' : 'prefers'} distinct-session proof, but the attestation is incomplete.`;

  if (row.execution_policy === 'distinct_session_required') {
    return { row, warning: null, error: missing_message };
  }

  return {
    row,
    warning: missing_message,
    error: null,
  };
}

export function summarizePhaseExecutionStatus(
  attestations: PhaseExecutionAttestation[],
): PhaseExecutionStatusSummary {
  const rows = EXECUTION_AUDIT_PHASES.map((phase) => {
    const attestation = attestations.find((entry) => entry.phase === phase) ?? null;
    return buildPhaseExecutionStatusRow(phase, attestation);
  });

  const preferred_without_distinct_session = rows
    .filter((row) => row.execution_policy === 'distinct_session_preferred' && !hasDistinctSessionProof(row))
    .map((row) => ({ phase: row.phase, phase_role_name: row.phase_role_name }));

  const required_without_distinct_session = rows
    .filter((row) => row.execution_policy === 'distinct_session_required' && !hasDistinctSessionProof(row))
    .map((row) => ({ phase: row.phase, phase_role_name: row.phase_role_name }));

  return {
    rows,
    counts: {
      attested: rows.filter((row) => row.proof_status === 'attested').length,
      verified: rows.filter((row) => row.proof_status === 'verified').length,
      subagent_attested: rows.filter((row) => hasDistinctSessionProof(row)).length,
    },
    preferred_without_distinct_session,
    required_without_distinct_session,
  };
}
