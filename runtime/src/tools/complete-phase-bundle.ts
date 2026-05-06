import type { ArchiveAdapter } from '../adapters/archive/types.js';
import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import { assessPhaseExecutionPolicy } from '../domain/execution-policy.js';
import { assessPhaseExpectedArtifacts } from '../domain/phase-artifacts.js';
import { getNextPhaseId, isWatchedPhase } from '../domain/phases.js';
import { assessPromptRealizationPolicy } from '../domain/prompt-realization.js';
import type { CompletePhaseBundleInput } from '../schemas.js';
import type { PhaseArtifact } from '../types.js';
import type { ToolResult } from '../utils.js';
import { createErrorResult, createTextResult } from '../utils.js';
import { buildPhaseContextBundleForFeature } from './prepare-phase-context.js';
import { handleRecordEvalPlan } from './record-eval-plan.js';
import { handleRecordEvalRun } from './record-eval-run.js';
import { handleRecordPhaseArtifact } from './record-phase-artifact.js';
import { handleRecordPhaseResult } from './record-phase-result.js';
import { handleRunPolicyChecks } from './run-policy-checks.js';
import { handleSubmitClaim } from './submit-claim.js';

interface BundleStep {
  name: string;
  status: 'completed' | 'failed' | 'skipped';
  result?: Record<string, unknown>;
  error?: string;
}

function resultText(result: ToolResult): string {
  return result.content.map((item) => item.text).join('\n');
}

function structuredResult(result: ToolResult): Record<string, unknown> {
  return result.structuredContent ?? { text: resultText(result) };
}

function failedBundleResult(
  message: string,
  input: CompletePhaseBundleInput,
  steps: BundleStep[],
  extra: Record<string, unknown> = {},
): ToolResult {
  return createErrorResult(message, {
    feature_id: input.feature_id,
    phase: input.phase,
    partial_failure: true,
    steps,
    ...extra,
  });
}

function applyAttestationOverride<T extends { warning: string | null; error: string | null }>(
  assessment: T,
  override_reason: string | undefined,
): T {
  if (assessment.error == null || override_reason == null) {
    return assessment;
  }

  return {
    ...assessment,
    warning: `${assessment.error} Override accepted: ${override_reason}`,
    error: null,
  };
}

async function recordStep(
  steps: BundleStep[],
  name: string,
  run: () => Promise<ToolResult>,
): Promise<ToolResult> {
  const result = await run();
  steps.push(
    result.isError === true
      ? {
          name,
          status: 'failed',
          error: resultText(result),
          result: structuredResult(result),
        }
      : {
          name,
          status: 'completed',
          result: structuredResult(result),
        },
  );
  return result;
}

async function preflightPhaseResult(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  config: RuntimeConfig,
  input: CompletePhaseBundleInput,
  steps: BundleStep[],
): Promise<ToolResult | null> {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return failedBundleResult(`Feature ${input.feature_id} was not found.`, input, steps);
  }

  const next_phase =
    input.outcome === 'completed' ? input.next_phase ?? getNextPhaseId(input.phase) : input.next_phase ?? null;
  const completing_release = input.phase === '9' && input.outcome === 'completed' && next_phase === '10';
  if (completing_release && feature.merged_at == null) {
    return failedBundleResult(
      `Feature ${input.feature_id} cannot complete Release until a merge has been recorded with odin.record_merge. The phase bundle did not write any records.`,
      input,
      steps,
      { next_phase },
    );
  }

  if (input.claims.length > 0 && !isWatchedPhase(input.phase)) {
    return failedBundleResult(
      `Claims can only be submitted from watched phases (Builder, Integrator, Release). Phase ${input.phase} is not watched. The phase bundle did not write any records.`,
      input,
      steps,
      { allowed_phases: ['5', '7', '9'] },
    );
  }

  if ((config.attestation?.mode ?? 'advisory') === 'strict' && input.outcome === 'completed' && input.claims.length > 0) {
    return failedBundleResult(
      'Strict mode requires watched claims to be submitted, policy-checked, and watcher-resolved before phase completion. Submit claims first, resolve watcher status, then call odin.complete_phase_bundle without claims or odin.record_phase_result.',
      input,
      steps,
    );
  }

  const actor = resolveWorkflowActorName(input.phase, input.created_by);
  const expected_bundle = await buildPhaseContextBundleForFeature(feature, adapter, skill_adapter, config, {
    feature_id: input.feature_id,
    phase: input.phase,
    agent_name: actor,
    include_artifacts: true,
    include_skills: true,
    include_learnings: true,
  }, { open_invocation: false });
  const execution_attestation = await adapter.getPhaseExecutionAttestation(input.feature_id, input.phase);
  const prompt_realization = await adapter.getPhasePromptRealization(input.feature_id, input.phase);
  const execution_assessment = applyAttestationOverride(
    assessPhaseExecutionPolicy(input.phase, execution_attestation, config.attestation),
    input.attestation_override_reason,
  );
  if (execution_assessment.error != null) {
    return failedBundleResult(execution_assessment.error, input, steps, {
      execution: execution_assessment.row,
    });
  }

  const prompt_realization_assessment = applyAttestationOverride(
    assessPromptRealizationPolicy(
      input.phase,
      expected_bundle.execution.phase_prompt_manifest,
      prompt_realization,
      config.attestation,
    ),
    input.attestation_override_reason,
  );
  if (prompt_realization_assessment.error != null) {
    return failedBundleResult(prompt_realization_assessment.error, input, steps, {
      prompt_realization: prompt_realization_assessment.row,
    });
  }

  if (input.outcome === 'completed') {
    const existing_artifacts = await adapter.listPhaseArtifacts(input.feature_id);
    const projected_artifacts: PhaseArtifact[] = [
      ...existing_artifacts,
      ...input.artifacts.map((artifact, index): PhaseArtifact => ({
        id: `bundle_preflight_${index + 1}`,
        feature_id: input.feature_id,
        phase: input.phase,
        output_type: artifact.output_type,
        content: artifact.content,
        artifact_path: artifact.artifact_path ?? null,
        created_by: actor,
        created_at: new Date(0).toISOString(),
      })),
    ];
    const artifact_completion = assessPhaseExpectedArtifacts(input.phase, projected_artifacts, config.attestation);
    if (artifact_completion.error != null) {
      return failedBundleResult(artifact_completion.error, input, steps, { artifact_completion });
    }
  }

  const claims_needing_review = await adapter.listClaimsNeedingReview(input.feature_id);
  if ((config.attestation?.mode ?? 'advisory') === 'strict' && claims_needing_review.length > 0) {
    return failedBundleResult(
      `Phase bundle cannot record the phase result because ${claims_needing_review.length} existing claim(s) still need watcher review in strict mode. The phase bundle did not write any records.`,
      input,
      steps,
      { claims_needing_review },
    );
  }

  return null;
}

export async function handleCompletePhaseBundle(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  config: RuntimeConfig,
  archive_adapter: ArchiveAdapter | null,
  input: CompletePhaseBundleInput,
): Promise<ToolResult> {
  const steps: BundleStep[] = [];
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return failedBundleResult(`Feature ${input.feature_id} was not found.`, input, steps);
  }

  if (feature.current_phase !== input.phase) {
    return failedBundleResult(
      `Feature ${input.feature_id} is currently in phase ${feature.current_phase}, not ${input.phase}. The phase bundle did not write any records.`,
      input,
      steps,
      { expected_phase: feature.current_phase },
    );
  }

  const eval_plan = input.eval_plan;
  const eval_run = input.eval_run;

  if (eval_plan != null && input.phase !== '3') {
    return failedBundleResult('eval_plan can only be recorded from the Architect phase (3).', input, steps);
  }

  if (eval_plan != null && eval_plan.scope == null) {
    return failedBundleResult('eval_plan.scope is required.', input, steps);
  }

  if (eval_run != null && input.phase !== '6' && input.phase !== '7') {
    return failedBundleResult('eval_run can only be recorded from Reviewer (6) or Integrator (7).', input, steps);
  }

  if (eval_run != null && eval_run.status == null) {
    return failedBundleResult('eval_run.status is required.', input, steps);
  }

  const preflight_error = await preflightPhaseResult(adapter, skill_adapter, config, input, steps);
  if (preflight_error != null) {
    return preflight_error;
  }
  steps.push({ name: 'phase_result_preflight', status: 'completed' });

  for (const [index, artifact] of input.artifacts.entries()) {
    const result = await recordStep(steps, `artifact:${index + 1}:${artifact.output_type}`, () =>
      handleRecordPhaseArtifact(adapter, {
        feature_id: input.feature_id,
        phase: input.phase,
        output_type: artifact.output_type,
        content: artifact.content,
        artifact_path: artifact.artifact_path,
        created_by: input.created_by,
      }),
    );
    if (result.isError === true) {
      return failedBundleResult(`Phase bundle stopped while recording artifact ${artifact.output_type}: ${resultText(result)}`, input, steps);
    }
  }

  if (eval_plan != null) {
    const result = await recordStep(steps, 'eval_plan', () =>
      handleRecordEvalPlan(adapter, {
        feature_id: input.feature_id,
        created_by: input.created_by,
        scope: eval_plan.scope,
        success_criteria: eval_plan.success_criteria ?? [],
        non_goals: eval_plan.non_goals ?? [],
        capability_evals: eval_plan.capability_evals ?? [],
        regression_evals: eval_plan.regression_evals ?? [],
        transcript_review_plan: eval_plan.transcript_review_plan ?? [],
        solvability_note: eval_plan.solvability_note,
      }),
    );
    if (result.isError === true) {
      return failedBundleResult(`Phase bundle stopped while recording eval_plan: ${resultText(result)}`, input, steps);
    }
  } else {
    steps.push({ name: 'eval_plan', status: 'skipped' });
  }

  if (eval_run != null) {
    const phase = input.phase;
    if (phase === '6' || phase === '7') {
      const result = await recordStep(steps, 'eval_run', () =>
        handleRecordEvalRun(adapter, {
          feature_id: input.feature_id,
          phase,
          created_by: input.created_by,
          status: eval_run.status,
          cases_run: eval_run.cases_run ?? [],
          important_failures: eval_run.important_failures ?? [],
          manual_review_notes: eval_run.manual_review_notes ?? [],
          transcript_review_observations: eval_run.transcript_review_observations ?? [],
          follow_up: eval_run.follow_up ?? [],
          environment_summary: eval_run.environment_summary ?? [],
        }),
      );
      if (result.isError === true) {
        return failedBundleResult(`Phase bundle stopped while recording eval_run: ${resultText(result)}`, input, steps);
      }
    }
  } else {
    steps.push({ name: 'eval_run', status: 'skipped' });
  }

  for (const [index, claim] of input.claims.entries()) {
    const result = await recordStep(steps, `claim:${index + 1}:${claim.claim_type}`, () =>
      handleSubmitClaim(adapter, {
        feature_id: input.feature_id,
        phase: input.phase,
        agent_name: input.created_by,
        claim_type: claim.claim_type,
        description: claim.description,
        evidence_refs: claim.evidence_refs,
        evidence: claim.evidence,
        risk_level: claim.risk_level,
      }),
    );
    if (result.isError === true) {
      return failedBundleResult(`Phase bundle stopped while submitting claim ${claim.claim_type}: ${resultText(result)}`, input, steps);
    }
  }

  const policy_result = input.run_policy_checks
    ? await recordStep(steps, 'policy_checks', () => handleRunPolicyChecks(adapter, { feature_id: input.feature_id }))
    : null;
  if (policy_result?.isError === true) {
    return failedBundleResult(`Phase bundle stopped while running policy checks: ${resultText(policy_result)}`, input, steps);
  }
  if (policy_result == null) {
    steps.push({ name: 'policy_checks', status: 'skipped' });
  }

  const claims_needing_review = await adapter.listClaimsNeedingReview(input.feature_id);
  const watcher_status = {
    claims_needing_review_count: claims_needing_review.length,
    blocking: (config.attestation?.mode ?? 'advisory') === 'strict' && claims_needing_review.length > 0,
  };
  steps.push({
    name: 'watcher_status',
    status: 'completed',
    result: {
      ...watcher_status,
      claims_needing_review,
    },
  });

  if (watcher_status.blocking) {
    return failedBundleResult(
      `Phase bundle cannot record the phase result because ${claims_needing_review.length} claim(s) still need watcher review in strict mode.`,
      input,
      steps,
      { watcher_status },
    );
  }

  const phase_result = await recordStep(steps, 'phase_result', () =>
    handleRecordPhaseResult(adapter, skill_adapter, config, archive_adapter, {
      feature_id: input.feature_id,
      phase: input.phase,
      outcome: input.outcome,
      summary: input.summary,
      next_phase: input.next_phase,
      blockers: input.blockers,
      created_by: input.created_by,
      attestation_override_reason: input.attestation_override_reason,
    }),
  );
  if (phase_result.isError === true) {
    return failedBundleResult(`Phase bundle stopped while recording phase result: ${resultText(phase_result)}`, input, steps);
  }

  return createTextResult(`Completed phase bundle for feature ${input.feature_id} phase ${input.phase}.`, {
    feature_id: input.feature_id,
    phase: input.phase,
    steps,
    watcher_status,
    phase_result: structuredResult(phase_result),
  });
}
