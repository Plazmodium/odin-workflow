/**
 * Odin Runtime Tool Schemas
 * Version: 0.1.0
 */

import * as z from 'zod/v4';

import {
  ARTIFACT_OUTPUT_TYPES,
  CLAIM_TYPES,
  LEARNING_CATEGORIES,
  PHASE_IDS,
  PHASE_OUTCOMES,
  RISK_LEVELS,
  REVIEW_TOOLS,
  WATCHER_REVIEW_VERDICTS,
} from './types.js';

const phase_id_schema = z.enum(PHASE_IDS);

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

export const GetDevelopmentEvalStatusInputSchema = z.object({
  feature_id: z.string().min(1),
});

export const VerifyClaimsInputSchema = z.object({
  feature_id: z.string().min(1),
});

export const SubmitClaimInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: phase_id_schema,
  agent_name: z.string().optional(),
  claim_type: z.enum(CLAIM_TYPES),
  description: z.string().min(1),
  evidence_refs: z.record(z.string(), z.unknown()).default({}),
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

export const RecordPhaseArtifactInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: phase_id_schema,
  output_type: z.union([z.enum(ARTIFACT_OUTPUT_TYPES), z.string().min(1)]),
  content: z.unknown(),
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
});

export const RunReviewChecksInputSchema = z.object({
  feature_id: z.string().min(1),
  phase: phase_id_schema.default('6'),
  tool: z.enum(REVIEW_TOOLS).default('semgrep'),
  changed_files: z.array(z.string()).default([]),
  initiated_by: z.string().min(1),
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
export type RecordMergeInput = z.infer<typeof RecordMergeInputSchema>;
export type RecordQualityGateInput = z.infer<typeof RecordQualityGateInputSchema>;
export type RecordEvalPlanInput = z.infer<typeof RecordEvalPlanInputSchema>;
export type RecordEvalRunInput = z.infer<typeof RecordEvalRunInputSchema>;
export type GetNextPhaseInput = z.infer<typeof GetNextPhaseInputSchema>;
export type GetFeatureStatusInput = z.infer<typeof GetFeatureStatusInputSchema>;
export type GetDevelopmentEvalStatusInput = z.infer<typeof GetDevelopmentEvalStatusInputSchema>;
export type VerifyClaimsInput = z.infer<typeof VerifyClaimsInputSchema>;
export type SubmitClaimInput = z.infer<typeof SubmitClaimInputSchema>;
export type RunPolicyChecksInput = z.infer<typeof RunPolicyChecksInputSchema>;
export type GetClaimsNeedingReviewInput = z.infer<typeof GetClaimsNeedingReviewInputSchema>;
export type RecordWatcherReviewInput = z.infer<typeof RecordWatcherReviewInputSchema>;
export type ArchiveFeatureReleaseInput = z.infer<typeof ArchiveFeatureReleaseInputSchema>;
export type PreparePhaseContextInput = z.infer<typeof PreparePhaseContextInputSchema>;
export type RecordPhaseArtifactInput = z.infer<typeof RecordPhaseArtifactInputSchema>;
export type RecordPhaseResultInput = z.infer<typeof RecordPhaseResultInputSchema>;
export type RunReviewChecksInput = z.infer<typeof RunReviewChecksInputSchema>;
export type CaptureLearningInput = z.infer<typeof CaptureLearningInputSchema>;
export const ApplyMigrationsInputSchema = z.object({
  dry_run: z.boolean().default(false),
});

export type ExploreKnowledgeInput = z.infer<typeof ExploreKnowledgeInputSchema>;
export type ApplyMigrationsInput = z.infer<typeof ApplyMigrationsInputSchema>;
