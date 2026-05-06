import type { AttestationPolicyConfig } from '../types.js';
import type { PhaseArtifact, PhaseExpectedArtifact, PhaseId } from '../types.js';
import { getPhaseContract } from './phases.js';

export interface ExpectedArtifactCheck {
  output_type: PhaseExpectedArtifact['output_type'];
  artifact_path_pattern: string | null;
  description: string;
  required_in_strict: boolean;
  status: 'present' | 'missing';
  artifact_id: string | null;
  artifact_path: string | null;
}

export interface PhaseArtifactCompletionAssessment {
  mode: 'advisory' | 'strict';
  phase: PhaseId;
  expected_artifacts: ExpectedArtifactCheck[];
  missing: ExpectedArtifactCheck[];
  warning: string | null;
  error: string | null;
}

function matchesExpectedArtifact(phase: PhaseId, artifact: PhaseArtifact, expected: PhaseExpectedArtifact): boolean {
  if (artifact.phase !== phase) {
    return false;
  }

  if (artifact.output_type !== expected.output_type) {
    return false;
  }

  if (expected.artifact_path_pattern == null) {
    return true;
  }

  const artifact_path = artifact.artifact_path;
  if (artifact_path == null) {
    return false;
  }

  return new RegExp(expected.artifact_path_pattern).test(artifact_path);
}

function describeMissingArtifact(missing: ExpectedArtifactCheck): string {
  if (missing.artifact_path_pattern == null) {
    return `${missing.output_type} (${missing.description})`;
  }

  return `${missing.output_type} with artifact_path matching /${missing.artifact_path_pattern}/ (${missing.description})`;
}

function buildMissingArtifactMessage(phase: PhaseId, missing: ExpectedArtifactCheck[]): string {
  return `Phase ${phase} is missing expected completion artifact(s): ${missing.map(describeMissingArtifact).join(', ')}. Record them with odin.record_phase_artifact; include artifact_path when a filename pattern is required.`;
}

export function assessPhaseExpectedArtifacts(
  phase: PhaseId,
  artifacts: PhaseArtifact[],
  attestation_config: Partial<AttestationPolicyConfig> | undefined,
): PhaseArtifactCompletionAssessment {
  const mode = attestation_config?.mode ?? 'advisory';
  const expected_artifacts = getPhaseContract(phase).expected_artifacts.map((expected): ExpectedArtifactCheck => {
    const matching = artifacts.filter((artifact) => matchesExpectedArtifact(phase, artifact, expected)).at(-1);

    return {
      output_type: expected.output_type,
      artifact_path_pattern: expected.artifact_path_pattern,
      description: expected.description,
      required_in_strict: expected.required_in_strict,
      status: matching == null ? 'missing' : 'present',
      artifact_id: matching?.id ?? null,
      artifact_path: matching?.artifact_path ?? null,
    };
  });
  const missing = expected_artifacts.filter((artifact) => artifact.status === 'missing');
  const strict_missing = missing.filter((artifact) => artifact.required_in_strict);
  const message = missing.length === 0 ? null : buildMissingArtifactMessage(phase, missing);

  return {
    mode,
    phase,
    expected_artifacts,
    missing,
    warning: mode === 'strict' ? null : message,
    error: mode === 'strict' && strict_missing.length > 0 ? buildMissingArtifactMessage(phase, strict_missing) : null,
  };
}
