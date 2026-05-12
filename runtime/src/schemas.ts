/**
 * Odin Runtime Tool Schemas
 * Version: 0.1.0
 */

import * as z from 'zod/v4';

import { PHASE_PROMPT_SECTIONS } from './domain/phases.js';
import {
  ARTIFACT_OUTPUT_TYPES,
  CLAIM_TYPES,
  LEARNING_CATEGORIES,
  PHASE_IDS,
  PHASE_OUTCOMES,
  RISK_LEVELS,
  REVIEW_TOOLS,
  SKILL_PROPOSAL_STATUSES,
  SKILL_PROPOSAL_REVIEW_STATUSES,
  SUPERVISOR_EVENT_TYPES,
  AUTONOMY_SELECTION_REASONS,
  WATCHER_REVIEW_VERDICTS,
} from './types.js';

const phase_id_schema = z.enum(PHASE_IDS);
const executable_phase_id_schema = z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
const realizable_phase_id_schema = z.enum(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

export const StartFeatureInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  complexity_level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  severity: z.union([z.literal('ROUTINE'), z.literal('EXPEDITED'), z.literal('CRITICAL')]),
  requirements_path: z.string().optional(),
  dev_initials: z.string().optional(),
  base_branch: z.string().optional(),
  author: z.string().min(1, 'author is required'),
});

export const RecordPullRequestInputSchema = z.object({
  feature_id: z.string().min(1),
  pr_url: z.string().url(),
  pr_number: z.int().positive(),
});

export const RecordReleaseHandoffInputSchema = z.object({
  feature_id: z.string().min(1),
  summary: z.string().min(1),
  created_by: z.string().min(1),
});

export const RecordReleaseHandoffFailureInputSchema = z.object({
  feature_id: z.string().min(1),
  summary: z.string().min(1),
  created_by: z.string().min(1),
});

export const RecordReleaseCloseoutFailureInputSchema = z.object({
  feature_id: z.string().min(1),
  summary: z.string().min(1),
  created_by: z.string().min(1),
});

export const RecordReleaseCloseoutInputSchema = z.object({
  feature_id: z.string().min(1),
  summary: z.string().min(1),
  created_by: z.string().min(1),
});

export const RecordBreakGlassOverrideInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: phase_id_schema,
  reason: z.string().min(1),
  missing_proof: z.array(z.enum(['execution_attestation', 'prompt_realization', 'watcher_independence', 'claim_evidence'])).min(1),
  created_by: z.string().min(1),
  follow_up: z.string().min(1).optional(),
});

export const RecordCommitInputSchema = z.object({
  feature_id: z.string().min(1),
  commit_hash: z.string().min(1),
  phase: phase_id_schema,
  message: z.string().optional(),
  files_changed: z.int().nonnegative().optional(),
  insertions: z.int().nonnegative().optional(),
  deletions: z.int().nonnegative().optional(),
  committed_by: z.string().optional(),
});

export const RecordMergeInputSchema = z.object({
  feature_id: z.string().min(1),
  merged_by: z.string().min(1).default('human'),
});

export const RecordQualityGateInputSchema = z.object({
  feature_id: z.string().min(1),
  gate_name: z.string().min(1),
  status: z.union([z.literal('APPROVED'), z.literal('REJECTED')]),
  approver: z.string().min(1),
  notes: z.string().optional(),
  phase: phase_id_schema.optional(),
});

const DevelopmentEvalCaseInputSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  expected_outcome: z.string().min(1).optional(),
  grader_type: z.string().min(1).optional(),
  pass_rule: z.string().min(1).optional(),
  prior_failure: z.string().min(1).optional(),
});

export const RecordEvalPlanInputSchema = z
  .object({
    feature_id: z.string().min(1),
    created_by: z.string().min(1),
    scope: z.string().min(1),
    success_criteria: z.array(z.string().min(1)).default([]),
    non_goals: z.array(z.string().min(1)).default([]),
    capability_evals: z.array(DevelopmentEvalCaseInputSchema).default([]),
    regression_evals: z.array(DevelopmentEvalCaseInputSchema).default([]),
    transcript_review_plan: z.array(z.string().min(1)).default([]),
    solvability_note: z.string().optional(),
  })
  .refine(
    (value) => value.capability_evals.length > 0 || value.regression_evals.length > 0,
    'At least one capability or regression eval is required.'
  );

export const RecordEvalRunInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: z.union([z.literal('6'), z.literal('7')]).default('6'),
  created_by: z.string().min(1),
  status: z.union([z.literal('passed'), z.literal('failed'), z.literal('partial'), z.literal('blocked')]),
  cases_run: z.array(z.string().min(1)).default([]),
  important_failures: z.array(z.string().min(1)).default([]),
  manual_review_notes: z.array(z.string().min(1)).default([]),
  transcript_review_observations: z.array(z.string().min(1)).default([]),
  follow_up: z.array(z.string().min(1)).default([]),
  environment_summary: z.array(z.string().min(1)).default([]),
});

export const GetNextPhaseInputSchema = z.object({
  feature_id: z.string().min(1),
});

export const GetFeatureStatusInputSchema = z.object({
  feature_id: z.string().min(1),
});

export const GetFeatureHealthInputSchema = z.object({
  feature_id: z.string().min(1),
});

export const PickNextAutonomousPhaseInputSchema = z.object({
  supervisor_name: z.string().min(1).default('ralph-loop'),
  agent_name: z.string().optional(),
  include_artifacts: z.boolean().default(true),
  include_skills: z.boolean().default(true),
  include_learnings: z.boolean().default(true),
  allowed_phases: z.array(phase_id_schema).optional(),
  allowed_selection_reasons: z.array(z.enum(AUTONOMY_SELECTION_REASONS)).optional(),
});

export const RecordSupervisorEventInputSchema = z.object({
  supervisor_name: z.string().min(1),
  event_type: z.enum(SUPERVISOR_EVENT_TYPES),
  summary: z.string().min(1),
  feature_id: z.string().min(1).nullable().optional(),
  phase: phase_id_schema.optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const GetDevelopmentEvalStatusInputSchema = z.object({
  feature_id: z.string().min(1),
});

export const GetSkillProposalQueueInputSchema = z.object({
  statuses: z.array(z.enum(SKILL_PROPOSAL_STATUSES)).default(['DRAFT_READY', 'CANDIDATE']),
  limit: z.int().positive().max(100).default(20),
});

export const SyncSkillProposalCandidatesInputSchema = z.object({});

export const RecordSkillProposalDraftInputSchema = z.object({
  topic_key: z.string().min(1),
  draft_markdown: z.string().min(1),
  drafted_by: z.string().min(1),
});

export const GetSkillProposalsInputSchema = z.object({
  statuses: z.array(z.enum(SKILL_PROPOSAL_REVIEW_STATUSES)).default([
    'DRAFT',
    'APPROVED',
    'REJECTED',
    'PUBLISHED',
  ]),
  limit: z.int().positive().max(100).default(20),
});

export const RecordSkillProposalDecisionInputSchema = z.object({
  topic_key: z.string().min(1),
  status: z.union([z.literal('APPROVED'), z.literal('REJECTED')]),
  decided_by: z.string().min(1),
  notes: z.string().optional(),
});

export const PublishSkillProposalInputSchema = z.object({
  topic_key: z.string().min(1),
  published_by: z.string().min(1),
});

export const VerifyClaimsInputSchema = z.object({
  feature_id: z.string().min(1),
});

const ClaimEvidenceInputSchema = z.object({
  command_outputs: z.array(z.string().min(1)).default([]),
  file_paths: z.array(z.string().min(1)).default([]),
  artifact_ids: z.array(z.string().min(1)).default([]),
  artifact_paths: z.array(z.string().min(1)).default([]),
  commit_hashes: z.array(z.string().min(1)).default([]),
  pr_urls: z.array(z.string().url()).default([]),
  verification_summaries: z.array(z.string().min(1)).default([]),
});

export const SubmitClaimInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: phase_id_schema,
  agent_name: z.string().optional(),
  claim_type: z.enum(CLAIM_TYPES),
  description: z.string().min(1),
  evidence_refs: z.record(z.string(), z.unknown()).default({}),
  evidence: ClaimEvidenceInputSchema.optional(),
  risk_level: z.enum(RISK_LEVELS).default('LOW'),
  invocation_id: z.string().optional(),
});

export const RunPolicyChecksInputSchema = z.object({
  feature_id: z.string().min(1),
});

export const GetClaimsNeedingReviewInputSchema = z.object({
  feature_id: z.string().min(1).optional(),
});

export const RecordWatcherReviewInputSchema = z.object({
  claim_id: z.string().uuid(),
  verdict: z.enum(WATCHER_REVIEW_VERDICTS),
  reasoning: z.string().min(1),
  watcher_agent: z.string().optional(),
  watcher_session_id: z.string().min(1).optional(),
  independence_override_reason: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).default(0.8),
});

export const ArchiveFeatureReleaseInputSchema = z.object({
  feature_id: z.string().min(1),
  summary: z.string().min(1),
  archived_by: z.string().min(1),
  release_notes: z.string().optional(),
  release_version: z.string().optional(),
  include_output_types: z.array(z.string().min(1)).default([
    'prd',
    'requirements',
    'spec',
    'tasks',
    'review',
    'eval_run',
    'documentation',
    'release_notes',
  ]),
});

export const PreparePhaseContextInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: phase_id_schema,
  agent_name: z.string().optional(),
  include_artifacts: z.boolean().default(true),
  include_skills: z.boolean().default(true),
  include_learnings: z.boolean().default(true),
});

export const ClearPhaseExecutionInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: executable_phase_id_schema,
});

export const RegisterPhaseExecutionInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: executable_phase_id_schema,
  actual_mode: z.union([z.literal('inline'), z.literal('subagent')]),
  supervisor_session_id: z.string().min(1),
  worker_session_id: z.string().min(1).optional(),
  harness_run_id: z.string().min(1).optional(),
  attested_by: z.string().min(1),
});

const PhasePromptManifestInputSchema = z.object({
  manifest_id: z.string().min(1),
  phase: realizable_phase_id_schema,
  phase_role_name: z.string().min(1),
  shared_context_hash: z.string().regex(/^[a-f0-9]{64}$/),
  phase_definition_hash: z.string().regex(/^[a-f0-9]{64}$/),
  resolved_skill_hashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)),
  required_prompt_sections: z.array(z.enum(PHASE_PROMPT_SECTIONS)).min(1),
  context_bundle_hash: z.string().regex(/^[a-f0-9]{64}$/),
  manifest_version: z.string().min(1),
  nonce: z.string().min(1),
});

export const RegisterPhaseRealizationInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: realizable_phase_id_schema,
  actual_mode: z.union([z.literal('inline'), z.literal('subagent')]),
  supervisor_session_id: z.string().min(1),
  worker_session_id: z.string().min(1).optional(),
  harness_run_id: z.string().min(1).optional(),
  attested_by: z.string().min(1),
  manifest: PhasePromptManifestInputSchema,
  child_prompt_hash: z.string().regex(/^[a-f0-9]{64}$/),
  wrapper_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  child_ack_nonce: z.string().min(1).optional(),
  proof_status: z.union([z.literal('bundle_attested'), z.literal('bundle_verified')]),
}).refine(
  (value) => value.manifest.phase === value.phase,
  'manifest.phase must match phase.'
).refine(
  (value) => value.proof_status !== 'bundle_verified' || value.child_ack_nonce === value.manifest.nonce,
  'bundle_verified requires child_ack_nonce to match the manifest nonce.'
);

export const RecordPhaseAgentLaunchInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: realizable_phase_id_schema,
  launch_mode: z.enum(['direct_agent', 'subagent', 'inline_reduced_fidelity']),
  launched_by: z.string().min(1),
  agent_name: z.string().optional(),
  supervisor_session_id: z.string().min(1).optional(),
  worker_session_id: z.string().min(1).optional(),
  harness_run_id: z.string().min(1).optional(),
  manifest: PhasePromptManifestInputSchema.optional(),
  reduced_fidelity_reason: z.string().min(1).optional(),
}).refine(
  (value) => value.launch_mode === 'inline_reduced_fidelity' || value.manifest != null,
  'manifest is required for direct_agent and subagent launches.'
).refine(
  (value) => value.launch_mode !== 'inline_reduced_fidelity' || value.reduced_fidelity_reason != null,
  'reduced_fidelity_reason is required for inline_reduced_fidelity launches.'
).refine(
  (value) => value.manifest == null || value.manifest.phase === value.phase,
  'manifest.phase must match phase.'
);

export const RecordPhaseSkillsAppliedInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: phase_id_schema,
  agent_name: z.string().optional(),
  skills_applied: z.array(z.string().min(1)).default([]),
  fallback_used: z.boolean().default(false),
  no_applicable_skill: z.boolean().default(false),
  notes: z.string().optional(),
}).refine(
  (value) => value.skills_applied.length > 0 || value.fallback_used || value.no_applicable_skill,
  'Record at least one applied skill, fallback_used, or no_applicable_skill.'
).refine(
  (value) => !(value.no_applicable_skill && (value.skills_applied.length > 0 || value.fallback_used)),
  'no_applicable_skill cannot be combined with skills_applied or fallback_used.'
).refine(
  (value) => !(value.fallback_used && value.skills_applied.length > 0),
  'fallback_used cannot be combined with skills_applied.'
);

export const RecordPhaseArtifactInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: phase_id_schema,
  output_type: z.union([z.enum(ARTIFACT_OUTPUT_TYPES), z.string().min(1)]),
  content: z.unknown(),
  artifact_path: z.string().min(1).optional(),
  created_by: z.string().min(1),
});

export const RecordPhaseResultInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: phase_id_schema,
  outcome: z.enum(PHASE_OUTCOMES),
  summary: z.string().min(1),
  next_phase: phase_id_schema.optional(),
  blockers: z.array(z.string()).default([]),
  created_by: z.string().min(1),
  attestation_override_reason: z.string().min(1).optional(),
});

const CompletePhaseBundleArtifactInputSchema = z.object({
  output_type: z.union([z.enum(ARTIFACT_OUTPUT_TYPES), z.string().min(1)]),
  content: z.unknown(),
  artifact_path: z.string().min(1).optional(),
});

const CompletePhaseBundleEvalPlanInputSchema = z
  .object({
    scope: z.string().min(1),
    success_criteria: z.array(z.string().min(1)).default([]),
    non_goals: z.array(z.string().min(1)).default([]),
    capability_evals: z.array(DevelopmentEvalCaseInputSchema).default([]),
    regression_evals: z.array(DevelopmentEvalCaseInputSchema).default([]),
    transcript_review_plan: z.array(z.string().min(1)).default([]),
    solvability_note: z.string().optional(),
  })
  .refine(
    (value) => value.capability_evals.length > 0 || value.regression_evals.length > 0,
    'At least one capability or regression eval is required.'
  );

const CompletePhaseBundleEvalRunInputSchema = z.object({
  status: z.union([z.literal('passed'), z.literal('failed'), z.literal('partial'), z.literal('blocked')]),
  cases_run: z.array(z.string().min(1)).default([]),
  important_failures: z.array(z.string().min(1)).default([]),
  manual_review_notes: z.array(z.string().min(1)).default([]),
  transcript_review_observations: z.array(z.string().min(1)).default([]),
  follow_up: z.array(z.string().min(1)).default([]),
  environment_summary: z.array(z.string().min(1)).default([]),
});

const CompletePhaseBundleClaimInputSchema = z.object({
  claim_type: z.enum(CLAIM_TYPES),
  description: z.string().min(1),
  evidence_refs: z.record(z.string(), z.unknown()).default({}),
  evidence: ClaimEvidenceInputSchema.optional(),
  risk_level: z.enum(RISK_LEVELS).default('LOW'),
});

export const CompletePhaseBundleInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: phase_id_schema,
  created_by: z.string().min(1),
  summary: z.string().min(1),
  outcome: z.enum(PHASE_OUTCOMES).default('completed'),
  next_phase: phase_id_schema.optional(),
  blockers: z.array(z.string()).default([]),
  artifacts: z.array(CompletePhaseBundleArtifactInputSchema).default([]),
  eval_plan: CompletePhaseBundleEvalPlanInputSchema.optional(),
  eval_run: CompletePhaseBundleEvalRunInputSchema.optional(),
  claims: z.array(CompletePhaseBundleClaimInputSchema).default([]),
  run_policy_checks: z.boolean().default(true),
  attestation_override_reason: z.string().min(1).optional(),
});

export const RunReviewChecksInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: phase_id_schema.default('6'),
  tool: z.enum(REVIEW_TOOLS).default('semgrep'),
  changed_files: z.array(z.string()).default([]),
  initiated_by: z.string().min(1),
});

export const ExportLocalArtifactsInputSchema = z.object({
  feature_id: z.string().min(1),
  output_dir: z.string().min(1).optional(),
  include: z.array(z.enum(['prd', 'eval_plan', 'eval_run', 'release_handoff', 'release_closeout'])).default([
    'prd',
    'eval_plan',
    'eval_run',
    'release_handoff',
    'release_closeout',
  ]),
});

export const CaptureLearningInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: phase_id_schema,
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.enum(LEARNING_CATEGORIES).default('PATTERN'),
  domain_tags: z.array(z.string().min(1)).default([]),
  created_by: z.string().min(1),
});

export const VerifyDesignInputSchema = z.object({
  feature_id: z.string().min(1),
  machine_path: z.string().min(1),
});

export const ExploreKnowledgeInputSchema = z.object({
  tags: z.array(z.string().min(1)).default([]),
  feature_id: z.string().min(1).optional(),
  category: z.enum(LEARNING_CATEGORIES).optional(),
  min_confidence: z.number().min(0).max(1).optional(),
});

export type VerifyDesignInput = z.infer<typeof VerifyDesignInputSchema>;
export type StartFeatureInput = z.infer<typeof StartFeatureInputSchema>;
export type RecordPullRequestInput = z.infer<typeof RecordPullRequestInputSchema>;
export type RecordCommitInput = z.infer<typeof RecordCommitInputSchema>;
export type RecordReleaseHandoffInput = z.infer<typeof RecordReleaseHandoffInputSchema>;
export type RecordReleaseHandoffFailureInput = z.infer<typeof RecordReleaseHandoffFailureInputSchema>;
export type RecordReleaseCloseoutFailureInput = z.infer<typeof RecordReleaseCloseoutFailureInputSchema>;
export type RecordReleaseCloseoutInput = z.infer<typeof RecordReleaseCloseoutInputSchema>;
export type RecordBreakGlassOverrideInput = z.infer<typeof RecordBreakGlassOverrideInputSchema>;
export type RecordMergeInput = z.infer<typeof RecordMergeInputSchema>;
export type RecordQualityGateInput = z.infer<typeof RecordQualityGateInputSchema>;
export type RecordEvalPlanInput = z.infer<typeof RecordEvalPlanInputSchema>;
export type RecordEvalRunInput = z.infer<typeof RecordEvalRunInputSchema>;
export type GetNextPhaseInput = z.infer<typeof GetNextPhaseInputSchema>;
export type GetFeatureStatusInput = z.infer<typeof GetFeatureStatusInputSchema>;
export type GetFeatureHealthInput = z.infer<typeof GetFeatureHealthInputSchema>;
export type PickNextAutonomousPhaseInput = z.infer<typeof PickNextAutonomousPhaseInputSchema>;
export type RecordSupervisorEventInput = z.infer<typeof RecordSupervisorEventInputSchema>;
export type GetDevelopmentEvalStatusInput = z.infer<typeof GetDevelopmentEvalStatusInputSchema>;
export type GetSkillProposalQueueInput = z.infer<typeof GetSkillProposalQueueInputSchema>;
export type SyncSkillProposalCandidatesInput = z.infer<typeof SyncSkillProposalCandidatesInputSchema>;
export type RecordSkillProposalDraftInput = z.infer<typeof RecordSkillProposalDraftInputSchema>;
export type GetSkillProposalsInput = z.infer<typeof GetSkillProposalsInputSchema>;
export type RecordSkillProposalDecisionInput = z.infer<typeof RecordSkillProposalDecisionInputSchema>;
export type PublishSkillProposalInput = z.infer<typeof PublishSkillProposalInputSchema>;
export type VerifyClaimsInput = z.infer<typeof VerifyClaimsInputSchema>;
export type SubmitClaimInput = z.infer<typeof SubmitClaimInputSchema>;
export type RunPolicyChecksInput = z.infer<typeof RunPolicyChecksInputSchema>;
export type GetClaimsNeedingReviewInput = z.infer<typeof GetClaimsNeedingReviewInputSchema>;
export type RecordWatcherReviewInput = z.infer<typeof RecordWatcherReviewInputSchema>;
export type ArchiveFeatureReleaseInput = z.infer<typeof ArchiveFeatureReleaseInputSchema>;
export type PreparePhaseContextInput = z.infer<typeof PreparePhaseContextInputSchema>;
export type ClearPhaseExecutionInput = z.infer<typeof ClearPhaseExecutionInputSchema>;
export type RegisterPhaseExecutionInput = z.infer<typeof RegisterPhaseExecutionInputSchema>;
export type RegisterPhaseRealizationInput = z.infer<typeof RegisterPhaseRealizationInputSchema>;
export type RecordPhaseAgentLaunchInput = z.infer<typeof RecordPhaseAgentLaunchInputSchema>;
export type RecordPhaseSkillsAppliedInput = z.infer<typeof RecordPhaseSkillsAppliedInputSchema>;
export type RecordPhaseArtifactInput = z.infer<typeof RecordPhaseArtifactInputSchema>;
export type RecordPhaseResultInput = z.infer<typeof RecordPhaseResultInputSchema>;
export type CompletePhaseBundleInput = z.infer<typeof CompletePhaseBundleInputSchema>;
export type RunReviewChecksInput = z.infer<typeof RunReviewChecksInputSchema>;
export type ExportLocalArtifactsInput = z.infer<typeof ExportLocalArtifactsInputSchema>;
export type CaptureLearningInput = z.infer<typeof CaptureLearningInputSchema>;
export const ApplyMigrationsInputSchema = z.object({
  dry_run: z.boolean().default(false),
});

export type ExploreKnowledgeInput = z.infer<typeof ExploreKnowledgeInputSchema>;
export type ApplyMigrationsInput = z.infer<typeof ApplyMigrationsInputSchema>;
