/**
 * Odin Runtime Tool Schemas
 * Version: 0.1.0
 */

import * as z from 'zod/v4';

import {
  ARTIFACT_OUTPUT_TYPES,
  LEARNING_CATEGORIES,
  PHASE_IDS,
  PHASE_OUTCOMES,
  REVIEW_TOOLS,
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

export const GetNextPhaseInputSchema = z.object({
  feature_id: z.string().min(1),
});

export const GetFeatureStatusInputSchema = z.object({
  feature_id: z.string().min(1),
});

export const VerifyClaimsInputSchema = z.object({
  feature_id: z.string().min(1),
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
export type GetNextPhaseInput = z.infer<typeof GetNextPhaseInputSchema>;
export type GetFeatureStatusInput = z.infer<typeof GetFeatureStatusInputSchema>;
export type VerifyClaimsInput = z.infer<typeof VerifyClaimsInputSchema>;
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
