import { getPhaseAgentInstructions, getPhaseExecutionContract } from './phases.js';

import type {
  AttestationPolicyConfig,
  PhaseId,
  PhasePromptManifest,
  PhasePromptRealizationAttestation,
  PromptRealizationPolicy,
  PromptRealizationProofStatus,
} from '../types.js';

export const PROMPT_REALIZATION_AUDIT_PHASES: PhaseId[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export interface PhasePromptRealizationStatusRow {
  phase: PhaseId;
  phase_role_name: string;
  prompt_realization_policy: PromptRealizationPolicy;
  expected_manifest_available: boolean;
  expected_manifest_id: string | null;
  attested_manifest_id: string | null;
  actual_mode: PhasePromptRealizationAttestation['actual_mode'] | null;
  proof_status: PromptRealizationProofStatus;
  manifest_match: boolean;
  child_prompt_hash: string | null;
  wrapper_hash: string | null;
  child_ack_nonce: string | null;
  attested_by: string | null;
  supervisor_session_id: string | null;
  worker_session_id: string | null;
  harness_run_id: string | null;
}

export interface PromptRealizationAssessment {
  row: PhasePromptRealizationStatusRow;
  warning: string | null;
  error: string | null;
}

export interface PromptRealizationStatusSummary {
  rows: PhasePromptRealizationStatusRow[];
  counts: {
    bundle_attested: number;
    bundle_verified: number;
    matching_manifest: number;
    unverified_manifest: number;
  };
  preferred_without_bundle_realization: Array<{ phase: PhaseId; phase_role_name: string }>;
  required_without_bundle_realization: Array<{ phase: PhaseId; phase_role_name: string }>;
  unverified_without_canonical_manifest: Array<{ phase: PhaseId; phase_role_name: string }>;
}

function defaultRow(phase: PhaseId, expected_manifest: PhasePromptManifest | null): PhasePromptRealizationStatusRow {
  const phase_role_name = getPhaseAgentInstructions(phase).name;
  const contract = getPhaseExecutionContract(phase, phase_role_name);

  return {
    phase,
    phase_role_name,
    prompt_realization_policy: contract.prompt_realization_policy,
    expected_manifest_available: expected_manifest != null,
    expected_manifest_id: expected_manifest?.manifest_id ?? null,
    attested_manifest_id: null,
    actual_mode: null,
    proof_status: 'none',
    manifest_match: expected_manifest == null,
    child_prompt_hash: null,
    wrapper_hash: null,
    child_ack_nonce: null,
    attested_by: null,
    supervisor_session_id: null,
    worker_session_id: null,
    harness_run_id: null,
  };
}

function resolveEffectivePromptRealizationPolicy(
  phase: PhaseId,
  base_policy: PromptRealizationPolicy,
  attestation_config?: Partial<AttestationPolicyConfig>,
): PromptRealizationPolicy {
  if (attestation_config?.mode !== 'strict') {
    return base_policy;
  }

  const required_phases = attestation_config.require_prompt_realization_phases ?? ['5', '6', '7', '9'];
  return required_phases.includes(phase) ? 'phase_bundle_required' : base_policy;
}

function hasPromptBundleProof(row: PhasePromptRealizationStatusRow): boolean {
  return (
    row.actual_mode === 'subagent' &&
    row.proof_status !== 'none' &&
    row.attested_manifest_id != null &&
    (row.manifest_match || !row.expected_manifest_available)
  );
}

function hasUnverifiedManifest(row: PhasePromptRealizationStatusRow): boolean {
  return (
    row.attested_manifest_id != null &&
    !row.manifest_match &&
    !row.expected_manifest_available
  );
}

export function buildPromptRealizationStatusRow(
  phase: PhaseId,
  expected_manifest: PhasePromptManifest | null,
  attestation: PhasePromptRealizationAttestation | null,
  attestation_config?: Partial<AttestationPolicyConfig>,
): PhasePromptRealizationStatusRow {
  const row = defaultRow(phase, expected_manifest);
  const prompt_realization_policy = resolveEffectivePromptRealizationPolicy(
    phase,
    row.prompt_realization_policy,
    attestation_config,
  );
  if (attestation == null) {
    return { ...row, prompt_realization_policy };
  }

  return {
    ...row,
    prompt_realization_policy,
    attested_manifest_id: attestation.manifest_id,
    actual_mode: attestation.actual_mode,
    proof_status: attestation.proof_status,
    manifest_match:
      expected_manifest != null && expected_manifest.manifest_id === attestation.manifest_id,
    child_prompt_hash: attestation.child_prompt_hash,
    wrapper_hash: attestation.wrapper_hash,
    child_ack_nonce: attestation.child_ack_nonce,
    attested_by: attestation.attested_by,
    supervisor_session_id: attestation.supervisor_session_id,
    worker_session_id: attestation.worker_session_id,
    harness_run_id: attestation.harness_run_id,
  };
}

export function assessPromptRealizationPolicy(
  phase: PhaseId,
  expected_manifest: PhasePromptManifest | null,
  attestation: PhasePromptRealizationAttestation | null,
  attestation_config?: Partial<AttestationPolicyConfig>,
): PromptRealizationAssessment {
  const row = buildPromptRealizationStatusRow(phase, expected_manifest, attestation, attestation_config);

  if (row.prompt_realization_policy === 'phase_bundle_optional') {
    return { row, warning: null, error: null };
  }

  if (hasPromptBundleProof(row)) {
    return { row, warning: null, error: null };
  }

  const policyVerb = row.prompt_realization_policy === 'phase_bundle_required' ? 'requires' : 'prefers';
  const prefix = `Phase ${phase} (${row.phase_role_name}) ${policyVerb}`;
  let missing_message: string;

  if (row.attested_manifest_id == null) {
    missing_message = `${prefix} attested realization from the Odin phase bundle, but no prompt realization attestation was recorded.`;
  } else if (!row.expected_manifest_available) {
    missing_message = `${prefix} the current Odin phase bundle, but no canonical manifest was available for comparison.`;
  } else if (!row.manifest_match) {
    missing_message = `${prefix} the current Odin phase bundle, but the recorded manifest does not match the expected bundle.`;
  } else if (row.actual_mode !== 'subagent') {
    missing_message = `${prefix} distinct child realization from the Odin phase bundle, but the recorded actual mode was ${row.actual_mode}.`;
  } else {
    missing_message = `${prefix} provable Odin phase-bundle realization, but the recorded proof is incomplete.`;
  }

  if (row.prompt_realization_policy === 'phase_bundle_required') {
    return { row, warning: null, error: missing_message };
  }

  return {
    row,
    warning: missing_message,
    error: null,
  };
}

export function summarizePromptRealizationStatus(
  rows: PhasePromptRealizationStatusRow[],
): PromptRealizationStatusSummary {
  const preferred_without_bundle_realization = rows
    .filter((row) => row.prompt_realization_policy === 'phase_bundle_preferred' && !hasPromptBundleProof(row) && !hasUnverifiedManifest(row))
    .map((row) => ({ phase: row.phase, phase_role_name: row.phase_role_name }));

  const required_without_bundle_realization = rows
    .filter((row) => row.prompt_realization_policy === 'phase_bundle_required' && !hasPromptBundleProof(row) && !hasUnverifiedManifest(row))
    .map((row) => ({ phase: row.phase, phase_role_name: row.phase_role_name }));

  const unverified_without_canonical_manifest = rows
    .filter((row) => hasUnverifiedManifest(row))
    .map((row) => ({ phase: row.phase, phase_role_name: row.phase_role_name }));

  return {
    rows,
    counts: {
      bundle_attested: rows.filter((row) => row.proof_status === 'bundle_attested').length,
      bundle_verified: rows.filter((row) => row.proof_status === 'bundle_verified').length,
      matching_manifest: rows.filter((row) => row.manifest_match && row.attested_manifest_id != null).length,
      unverified_manifest: rows.filter((row) => hasUnverifiedManifest(row)).length,
    },
    preferred_without_bundle_realization,
    required_without_bundle_realization,
    unverified_without_canonical_manifest,
  };
}
