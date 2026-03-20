#!/usr/bin/env node

/**
 * Odin MCP Runtime
 * Version: 0.1.0
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { SupabaseArchiveAdapter } from './adapters/archive/supabase.js';
import type { ArchiveAdapter } from './adapters/archive/types.js';
import { TlaPreCheckAdapter } from './adapters/formal-verification/tla-precheck.js';
import type { FormalVerificationAdapter } from './adapters/formal-verification/types.js';
import { FilesystemSkillAdapter } from './adapters/skills/filesystem.js';
import type { SkillAdapter } from './adapters/skills/types.js';
import { SemgrepReviewAdapter } from './adapters/review/semgrep.js';
import type { ReviewAdapter } from './adapters/review/types.js';
import { InMemoryWorkflowStateAdapter } from './adapters/workflow-state/in-memory.js';
import { SupabaseWorkflowStateAdapter } from './adapters/workflow-state/supabase.js';
import type { WorkflowStateAdapter } from './adapters/workflow-state/types.js';
import { loadRuntimeConfig } from './config.js';
import {
  ApplyMigrationsInputSchema,
  ArchiveFeatureReleaseInputSchema,
  CaptureLearningInputSchema,
  ExploreKnowledgeInputSchema,
  GetFeatureStatusInputSchema,
  GetNextPhaseInputSchema,
  PreparePhaseContextInputSchema,
  RecordCommitInputSchema,
  RecordMergeInputSchema,
  RecordPhaseArtifactInputSchema,
  RecordPullRequestInputSchema,
  RecordPhaseResultInputSchema,
  RunReviewChecksInputSchema,
  StartFeatureInputSchema,
  VerifyClaimsInputSchema,
  VerifyDesignInputSchema,
} from './schemas.js';
import { handleApplyMigrations } from './tools/apply-migrations.js';
import { handleArchiveFeatureRelease } from './tools/archive-feature-release.js';
import { handleCaptureLearning } from './tools/capture-learning.js';
import { handleExploreKnowledge } from './tools/explore-knowledge.js';
import { handleGetFeatureStatus } from './tools/get-feature-status.js';
import { handleGetNextPhase } from './tools/get-next-phase.js';
import { handlePreparePhaseContext } from './tools/prepare-phase-context.js';
import { handleRecordCommit } from './tools/record-commit.js';
import { handleRecordMerge } from './tools/record-merge.js';
import { handleRecordPhaseArtifact } from './tools/record-phase-artifact.js';
import { handleRecordPullRequest } from './tools/record-pull-request.js';
import { handleRecordPhaseResult } from './tools/record-phase-result.js';
import { handleRunReviewChecks } from './tools/run-review-checks.js';
import { handleStartFeature } from './tools/start-feature.js';
import { handleVerifyClaims } from './tools/verify-claims.js';
import { handleVerifyDesign } from './tools/verify-design.js';
import { safeToolHandler } from './utils.js';

const project_root = process.env.ODIN_PROJECT_ROOT ?? process.cwd();
const runtime_config = loadRuntimeConfig(project_root);

function createWorkflowStateAdapter(): WorkflowStateAdapter {
  const config = runtime_config;

  if (config.runtime.mode === 'supabase') {
    if (!config.supabase?.url || !config.supabase?.secret_key) {
      console.error(
        '[Odin Runtime] FATAL: runtime.mode is "supabase" but SUPABASE_URL and/or SUPABASE_SECRET_KEY are missing.\n' +
        '  → Set them in .env or .odin/config.yaml, or change runtime.mode to "in_memory".\n' +
        '  → Run `odin-runtime-init` to generate config scaffolding.'
      );
      process.exit(1);
    }

    const adapter = new SupabaseWorkflowStateAdapter(config);
    console.error('[Odin Runtime] Workflow state adapter: supabase');
    return adapter;
  }

  if (config.runtime.mode !== 'in_memory') {
    console.error(
      `[Odin Runtime] FATAL: unknown runtime.mode "${config.runtime.mode}". Supported: "supabase", "in_memory".`
    );
    process.exit(1);
  }

  console.error('[Odin Runtime] Workflow state adapter: in-memory');
  return new InMemoryWorkflowStateAdapter();
}

const workflow_state = createWorkflowStateAdapter();

function createArchiveAdapter(): ArchiveAdapter | null {
  if (runtime_config.archive?.provider !== 'supabase') {
    console.error('[Odin Runtime] Archive adapter: disabled (no archive provider configured)');
    return null;
  }

  const adapter = new SupabaseArchiveAdapter(runtime_config);
  console.error('[Odin Runtime] Archive adapter: supabase');
  return adapter;
}

function createReviewAdapter(project_root: string): ReviewAdapter {
  console.error('[Odin Runtime] Review adapter: semgrep');
  return new SemgrepReviewAdapter(project_root);
}

function createSkillAdapter(project_root: string): SkillAdapter {
  console.error('[Odin Runtime] Skill adapter: filesystem');
  return new FilesystemSkillAdapter(project_root, runtime_config);
}

function createFormalVerificationAdapter(project_root: string): FormalVerificationAdapter | null {
  const provider = runtime_config.formal_verification?.provider;
  if (provider == null || provider === 'none') {
    console.error('[Odin Runtime] Formal verification adapter: disabled (provider: none)');
    return null;
  }

  const timeout = runtime_config.formal_verification?.timeout_seconds ?? 120;
  console.error(`[Odin Runtime] Formal verification adapter: tla-precheck (timeout: ${timeout}s)`);
  return new TlaPreCheckAdapter(project_root, timeout);
}

const review_adapter = createReviewAdapter(project_root);
const skill_adapter = createSkillAdapter(project_root);
const archive_adapter = createArchiveAdapter();
const formal_verification_adapter = createFormalVerificationAdapter(project_root);

const server = new McpServer(
  {
    name: 'odin',
    version: '0.1.0',
  },
  {
    capabilities: {
      logging: {},
    },
  }
);

server.registerTool(
  'odin.archive_feature_release',
  {
    title: 'Archive Feature Release',
    description: 'Upload and record the release archive for a feature using Odin runtime semantics.',
    inputSchema: ArchiveFeatureReleaseInputSchema,
  },
  safeToolHandler(async (input) => handleArchiveFeatureRelease(workflow_state, archive_adapter, input))
);

server.registerTool(
  'odin.start_feature',
  {
    title: 'Start Feature',
    description: 'Create a feature inside the Odin runtime control plane.',
    inputSchema: StartFeatureInputSchema,
  },
  safeToolHandler(async (input) => handleStartFeature(workflow_state, input))
);

server.registerTool(
  'odin.get_feature_status',
  {
    title: 'Get Feature Status',
    description: 'Return a richer feature status bundle with workflow counts and recent activity.',
    inputSchema: GetFeatureStatusInputSchema,
  },
  safeToolHandler(async (input) => handleGetFeatureStatus(workflow_state, input))
);

server.registerTool(
  'odin.get_next_phase',
  {
    title: 'Get Next Phase',
    description: 'Return the current phase and next allowed phase for a feature.',
    inputSchema: GetNextPhaseInputSchema,
  },
  safeToolHandler(async (input) => handleGetNextPhase(workflow_state, input))
);

server.registerTool(
  'odin.prepare_phase_context',
  {
    title: 'Prepare Phase Context',
    description: 'Assemble the working bundle an agent needs for a feature phase.',
    inputSchema: PreparePhaseContextInputSchema,
  },
  safeToolHandler(async (input) => handlePreparePhaseContext(workflow_state, skill_adapter, input))
);

server.registerTool(
  'odin.record_phase_artifact',
  {
    title: 'Record Phase Artifact',
    description: 'Record an artifact produced during a workflow phase.',
    inputSchema: RecordPhaseArtifactInputSchema,
  },
  safeToolHandler(async (input) => handleRecordPhaseArtifact(workflow_state, input))
);

server.registerTool(
  'odin.record_commit',
  {
    title: 'Record Commit',
    description: 'Record git commit metadata for a feature.',
    inputSchema: RecordCommitInputSchema,
  },
  safeToolHandler(async (input) => handleRecordCommit(workflow_state, input))
);

server.registerTool(
  'odin.record_pr',
  {
    title: 'Record Pull Request',
    description: 'Record the GitHub pull request created for a feature.',
    inputSchema: RecordPullRequestInputSchema,
  },
  safeToolHandler(async (input) => handleRecordPullRequest(workflow_state, input))
);

server.registerTool(
  'odin.record_merge',
  {
    title: 'Record Merge',
    description: 'Record that a human merged the feature pull request.',
    inputSchema: RecordMergeInputSchema,
  },
  safeToolHandler(async (input) => handleRecordMerge(workflow_state, input))
);

server.registerTool(
  'odin.record_phase_result',
  {
    title: 'Record Phase Result',
    description: 'Record the outcome of a workflow phase and update workflow state.',
    inputSchema: RecordPhaseResultInputSchema,
  },
  safeToolHandler(async (input) => handleRecordPhaseResult(workflow_state, archive_adapter, input))
);

server.registerTool(
  'odin.run_review_checks',
  {
    title: 'Run Review Checks',
    description: 'Queue or execute review checks for a feature phase.',
    inputSchema: RunReviewChecksInputSchema,
  },
  safeToolHandler(async (input) => handleRunReviewChecks(workflow_state, review_adapter, input))
);

server.registerTool(
  'odin.capture_learning',
  {
    title: 'Capture Learning',
    description: 'Capture a learning candidate from workflow execution.',
    inputSchema: CaptureLearningInputSchema,
  },
  safeToolHandler(async (input) => handleCaptureLearning(workflow_state, skill_adapter, input))
);

server.registerTool(
  'odin.explore_knowledge',
  {
    title: 'Explore Knowledge',
    description: 'Explore knowledge clusters across features, grouped by domain with cross-domain bridges and resonance ranking.',
    inputSchema: ExploreKnowledgeInputSchema,
  },
  safeToolHandler(async (input) => handleExploreKnowledge(workflow_state, skill_adapter, input))
);

server.registerTool(
  'odin.verify_claims',
  {
    title: 'Verify Claims',
    description: 'Inspect claim verification status for a feature.',
    inputSchema: VerifyClaimsInputSchema,
  },
  safeToolHandler(async (input) => handleVerifyClaims(workflow_state, input))
);

server.registerTool(
  'odin.verify_design',
  {
    title: 'Verify Design',
    description: 'Run formal design verification (TLA+ model checking) on a .machine.ts DSL file. Opt-in via formal_verification.provider in .odin/config.yaml.',
    inputSchema: VerifyDesignInputSchema,
  },
  safeToolHandler(async (input) => handleVerifyDesign(formal_verification_adapter, input))
);

server.registerTool(
  'odin.apply_migrations',
  {
    title: 'Apply Migrations',
    description:
      'Apply pending PostgreSQL database migrations. Supports DATABASE_URL (any PostgreSQL provider) or SUPABASE_URL + SUPABASE_ACCESS_TOKEN (Supabase Management API). Auto-detects existing schema on first run.',
    inputSchema: ApplyMigrationsInputSchema,
  },
  safeToolHandler(async (input) => handleApplyMigrations(runtime_config, input))
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Odin Runtime] MCP server running on stdio');
}

main().catch((error) => {
  console.error('[Odin Runtime] Fatal startup error:', error);
  process.exit(1);
});
