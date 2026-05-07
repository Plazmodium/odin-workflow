/**
 * Prepare Phase Context Tool
 * Version: 0.1.0
 */

import type { SkillAdapter } from '../adapters/skills/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RuntimeConfig } from '../config.js';
import { resolveWorkflowActorName } from '../domain/actors.js';
import { resolveAutomationDecision } from '../domain/automation-policy.js';
import { appendDevelopmentEvalChecks, buildDevelopmentEvalContext } from '../domain/development-evals.js';
import { assessPhaseExecutionPolicy } from '../domain/execution-policy.js';
import { buildPhasePromptManifest } from '../domain/phase-prompt-manifest.js';
import { getPhaseAgentInstructions, getPhaseContract, getPhaseExecutionContract, isWatchedPhase } from '../domain/phases.js';
import { assessPromptRealizationPolicy } from '../domain/prompt-realization.js';
import { formatOpenGateSummary } from '../domain/quality-gates.js';
import { computeResonance, type ResonanceInput } from '../domain/resonance.js';
import type { PreparePhaseContextInput } from '../schemas.js';
import type { ArtifactOutputType, FeatureRecord, LearningCategory, PhaseAgentReadiness, PhaseArtifact, PhaseContextBundle, PhaseExecutionContract, PhaseId, PhasePromptManifest } from '../types.js';
import { createErrorResult, createTextResult } from '../utils.js';

const ARTIFACT_KEYS: ArtifactOutputType[] = [
  'prd',
  'requirements',
  'spec',
  'tasks',
  'review',
  'documentation',
  'release_notes',
  'design_verification',
  'eval_plan',
  'eval_run',
];

function buildArtifactLineage(artifacts: PhaseArtifact[]): PhaseContextBundle['artifacts'] {
  const lineage: PhaseContextBundle['artifacts'] = {};

  for (const output_type of ARTIFACT_KEYS) {
    const matching = artifacts.filter((artifact) => artifact.output_type === output_type);
    const latest = matching.at(-1);
    if (latest != null) {
      lineage[output_type] = latest;
    }
  }

  return lineage;
}

function applyEffectiveAttestationPolicy(
  phase: PhaseId,
  execution: PhaseExecutionContract,
  config: RuntimeConfig,
): PhaseExecutionContract {
  if (config.attestation?.mode !== 'strict') {
    return execution;
  }

  const required_execution_phases = config.attestation.require_execution_phases ?? ['5', '6', '7', '9'];
  const required_prompt_realization_phases = config.attestation.require_prompt_realization_phases ?? ['5', '6', '7', '9'];

  return {
    ...execution,
    execution_policy: required_execution_phases.includes(phase)
      ? 'distinct_session_required'
      : execution.execution_policy,
    prompt_realization_policy: required_prompt_realization_phases.includes(phase)
      ? 'phase_bundle_required'
      : execution.prompt_realization_policy,
  };
}

interface BuildPhaseContextOptions {
  open_invocation?: boolean;
}

function isFullOdinRequired(config: RuntimeConfig, phase: PhaseId): boolean {
  if (config.attestation?.mode !== 'strict') {
    return false;
  }

  const execution_phases = config.attestation.require_execution_phases ?? ['5', '6', '7', '9'];
  const prompt_phases = config.attestation.require_prompt_realization_phases ?? ['5', '6', '7', '9'];
  return execution_phases.includes(phase) || prompt_phases.includes(phase);
}

function defaultPhaseAgentReadiness(config: RuntimeConfig, phase: PhaseId): PhaseAgentReadiness {
  const full_odin_required = isFullOdinRequired(config, phase);

  return {
    attestation_mode: config.attestation?.mode ?? 'advisory',
    status: full_odin_required ? 'blocked_missing_agent_proof' : 'not_required',
    full_odin_required,
    can_record_phase_work: !full_odin_required,
    missing: full_odin_required ? ['execution_attestation', 'prompt_realization'] : [],
    next_actions: full_odin_required
      ? [
          'Invoke the canonical Odin phase agent directly, or spawn a subagent whose prompt includes the canonical phase definition, prepared phase context, and resolved skills.',
          'Record odin.register_phase_execution with distinct supervisor and worker sessions.',
          'Record odin.register_phase_realization with the phase_prompt_manifest returned in this context before recording phase artifacts or claims.',
        ]
      : [],
    execution: null,
    prompt_realization: null,
  };
}

async function buildPhaseAgentReadiness(
  adapter: WorkflowStateAdapter,
  config: RuntimeConfig,
  feature: FeatureRecord,
  phase: PhaseId,
  expected_manifest: PhasePromptManifest | null,
): Promise<PhaseAgentReadiness> {
  const full_odin_required = isFullOdinRequired(config, phase);
  if (!full_odin_required) {
    return defaultPhaseAgentReadiness(config, phase);
  }

  const [execution_attestation, prompt_realization] = await Promise.all([
    adapter.getPhaseExecutionAttestation(feature.id, phase),
    adapter.getPhasePromptRealization(feature.id, phase),
  ]);
  const execution_assessment = assessPhaseExecutionPolicy(phase, execution_attestation, config.attestation);
  const prompt_realization_assessment = assessPromptRealizationPolicy(
    phase,
    expected_manifest,
    prompt_realization,
    config.attestation,
  );
  const missing: PhaseAgentReadiness['missing'] = [
    ...(execution_assessment.error == null ? [] : ['execution_attestation' as const]),
    ...(prompt_realization_assessment.error == null ? [] : ['prompt_realization' as const]),
  ];
  const next_actions = [
    ...(missing.includes('execution_attestation')
      ? ['Record odin.register_phase_execution with actual_mode subagent and distinct supervisor_session_id / worker_session_id before phase work starts.']
      : []),
    ...(missing.includes('prompt_realization')
      ? ['Record odin.register_phase_realization using this context phase_prompt_manifest after launching the canonical phase agent prompt.']
      : []),
  ];

  return {
    attestation_mode: 'strict',
    status: missing.length === 0 ? 'ready_for_full_odin' : 'blocked_missing_agent_proof',
    full_odin_required,
    can_record_phase_work: missing.length === 0,
    missing,
    next_actions,
    execution: {
      actual_mode: execution_assessment.row.actual_mode,
      proof_status: execution_assessment.row.proof_status,
      supervisor_session_id: execution_assessment.row.supervisor_session_id,
      worker_session_id: execution_assessment.row.worker_session_id,
      warning: execution_assessment.warning,
      error: execution_assessment.error,
    },
    prompt_realization: {
      actual_mode: prompt_realization_assessment.row.actual_mode,
      proof_status: prompt_realization_assessment.row.proof_status,
      manifest_match: prompt_realization_assessment.row.manifest_match,
      attested_manifest_id: prompt_realization_assessment.row.attested_manifest_id,
      expected_manifest_id: prompt_realization_assessment.row.expected_manifest_id,
      warning: prompt_realization_assessment.warning,
      error: prompt_realization_assessment.error,
    },
  };
}

export async function buildPhaseContextBundleForFeature(
  feature: FeatureRecord,
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  config: RuntimeConfig,
  input: PreparePhaseContextInput,
  options: BuildPhaseContextOptions = {},
): Promise<PhaseContextBundle> {
  const open_invocation = options.open_invocation ?? true;
  const all_artifacts = await adapter.listPhaseArtifacts(input.feature_id);
  const artifacts = input.include_artifacts ? all_artifacts : [];
  const [feature_learnings, related_learnings] = input.include_learnings
    ? await Promise.all([
        adapter.listLearnings(input.feature_id),
        adapter.listRelatedLearnings(input.feature_id, 5),
      ])
    : [[], []];
  const [open_blockers, open_gate_records, open_findings, pending_claims, claim_verification, claims_needing_review] = await Promise.all([
    adapter.listOpenBlockers(input.feature_id),
    adapter.listOpenGateRecords(input.feature_id),
    adapter.listOpenFindings(input.feature_id),
    adapter.listPendingClaims(input.feature_id),
    adapter.listClaimVerificationStatus(input.feature_id),
    adapter.listClaimsNeedingReview(input.feature_id),
  ]);
  const open_gates = open_gate_records.map(formatOpenGateSummary);
  const phase = getPhaseContract(input.phase);
  const agent = getPhaseAgentInstructions(input.phase);
  const actor_name = resolveWorkflowActorName(input.phase, input.agent_name ?? agent.name);
  const execution = applyEffectiveAttestationPolicy(input.phase, getPhaseExecutionContract(input.phase, actor_name), config);
  const development_evals = buildDevelopmentEvalContext(feature, input.phase, all_artifacts, open_gate_records);
  const automation = resolveAutomationDecision({
    config,
    feature,
    open_blockers,
    open_gate_records,
    open_findings,
    pending_claims,
    claim_verification,
    claims_needing_review_count: claims_needing_review.length,
  });
  const watcher_constraints =
    isWatchedPhase(input.phase) && claims_needing_review.length > 0
      ? [
          'Outstanding claims need watcher review: call odin.get_claims_needing_review, have watcher-agent review each claim, record results with odin.record_watcher_review, then re-run odin.verify_claims before closing the watched phase.',
        ]
      : [];
  const resolved_skills = input.include_skills
    ? await skill_adapter.resolveSkills({ feature, artifacts: all_artifacts, phase: input.phase })
    : { resolved: [], fallback_used: false };
  const skill_paths = resolved_skills.resolved.map((skill) => `${skill.category}/${skill.name}`);
  const existing_invocation = open_invocation
    ? await adapter.findOpenAgentInvocation(feature.id, input.phase, actor_name)
    : null;
  const invocation =
    existing_invocation ??
    (open_invocation && input.phase !== '10'
      ? await adapter.startAgentInvocation(
          feature.id,
          input.phase,
          actor_name,
          `Phase ${input.phase}: ${phase.name}`,
          skill_paths.length > 0 ? skill_paths : undefined,
        )
      : null);

  const bundle: PhaseContextBundle = {
    feature,
    phase,
    agent: {
      ...agent,
      constraints: [...new Set([...agent.constraints, ...development_evals.harness_prompt_block, ...watcher_constraints])],
    },
    execution,
    automation,
    invocation:
      invocation == null
        ? null
        : {
            id: invocation.id,
            agent_name: invocation.agent_name,
            started_at: invocation.started_at,
            skills_used: invocation.skills_used,
          },
    phase_agent_readiness: defaultPhaseAgentReadiness(config, input.phase),
    workflow: {
      open_blockers,
      open_gates,
      open_gate_records,
      open_findings,
      pending_claims,
      claims_needing_review_count: claims_needing_review.length,
    },
    artifacts: buildArtifactLineage(artifacts),
    development_evals,
    skills: {
      resolved: resolved_skills.resolved,
      fallback_used: resolved_skills.fallback_used,
    },
    verification: {
      watched_phase: isWatchedPhase(input.phase),
      required_claims: isWatchedPhase(input.phase) ? ['CODE_MODIFIED'] : [],
      required_checks: appendDevelopmentEvalChecks(
        input.phase === '6'
          ? ['security review', 'unit test evaluation']
          : isWatchedPhase(input.phase)
            ? ['build', 'tests', 'policy checks', ...(claims_needing_review.length > 0 ? ['watcher review resolution'] : [])]
            : [],
        input.phase
      ),
      review_mode: input.phase === '6' ? 'security' : isWatchedPhase(input.phase) ? 'watched_phase' : 'none',
    },
    learnings: [
      ...feature_learnings.map((learning) => ({
        id: learning.id,
        title: learning.title,
        category: learning.category,
        summary: learning.content.slice(0, 200),
        source: 'feature' as const,
      })),
      ...(() => {
        const resonance_inputs: ResonanceInput[] = related_learnings.map((l) => ({
          id: l.id,
          category: l.category,
          confidence_score: l.confidence_score,
          source_feature_id: l.source_feature_id,
          shared_domains: l.shared_domains,
          created_at: new Date().toISOString(),
        }));
        const scores = computeResonance(resonance_inputs);
        const score_map = new Map(scores.map((s) => [s.learning_id, s.combined]));

        return related_learnings
          .slice()
          .sort((a, b) => (score_map.get(b.id) ?? 0) - (score_map.get(a.id) ?? 0))
          .map((learning) => ({
            id: learning.id,
            title: learning.title,
            category: learning.category as LearningCategory,
            summary: learning.content.slice(0, 200),
            source: 'related' as const,
            source_feature_id: learning.source_feature_id,
            shared_domains: learning.shared_domains,
          }));
      })(),
    ],
  };

  bundle.execution.phase_prompt_manifest = await buildPhasePromptManifest(bundle);
  bundle.phase_agent_readiness = await buildPhaseAgentReadiness(
    adapter,
    config,
    feature,
    input.phase,
    bundle.execution.phase_prompt_manifest,
  );
  return bundle;
}

export async function handlePreparePhaseContext(
  adapter: WorkflowStateAdapter,
  skill_adapter: SkillAdapter,
  config: RuntimeConfig,
  input: PreparePhaseContextInput,
) {
  const feature = await adapter.getFeature(input.feature_id);
  if (feature == null) {
    return createErrorResult(`Feature ${input.feature_id} was not found.`, {
      feature_id: input.feature_id,
    });
  }

  const bundle = await buildPhaseContextBundleForFeature(feature, adapter, skill_adapter, config, input, {
    open_invocation: true,
  });

  return createTextResult(
    `Prepared ${bundle.phase.name} context for feature ${feature.id}.`,
    { context: bundle },
  );
}
