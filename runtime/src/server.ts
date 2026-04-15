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
import { CONFIG_RESTART_NOTE, loadRuntimeConfig, summarizeRuntimeConfig } from './config.js';
import {
  ApplyMigrationsInputSchema,
  ArchiveFeatureReleaseInputSchema,
  CaptureLearningInputSchema,
  ExploreKnowledgeInputSchema,
  GetClaimsNeedingReviewInputSchema,
  GetDevelopmentEvalStatusInputSchema,
  GetFeatureStatusInputSchema,
  GetNextPhaseInputSchema,
  PickNextAutonomousPhaseInputSchema,
  GetSkillProposalQueueInputSchema,
  GetSkillProposalsInputSchema,
  PreparePhaseContextInputSchema,
  PublishSkillProposalInputSchema,
  RecordCommitInputSchema,
  RecordEvalPlanInputSchema,
  RecordEvalRunInputSchema,
  RecordMergeInputSchema,
  RecordReleaseCloseoutFailureInputSchema,
  RecordReleaseHandoffFailureInputSchema,
  RecordReleaseHandoffInputSchema,
  RecordPhaseArtifactInputSchema,
  RecordQualityGateInputSchema,
  RecordPullRequestInputSchema,
  RecordPhaseResultInputSchema,
  RecordSupervisorEventInputSchema,
  RecordSkillProposalDecisionInputSchema,
  RecordSkillProposalDraftInputSchema,
  RecordWatcherReviewInputSchema,
  RunReviewChecksInputSchema,
  RunPolicyChecksInputSchema,
  StartFeatureInputSchema,
  SubmitClaimInputSchema,
  SyncSkillProposalCandidatesInputSchema,
  VerifyClaimsInputSchema,
  VerifyDesignInputSchema,
} from './schemas.js';
import { handleApplyMigrations } from './tools/apply-migrations.js';
import { handleArchiveFeatureRelease } from './tools/archive-feature-release.js';
import { handleCaptureLearning } from './tools/capture-learning.js';
import { handleExploreKnowledge } from './tools/explore-knowledge.js';
import { handleGetClaimsNeedingReview } from './tools/get-claims-needing-review.js';
import { handleGetDevelopmentEvalStatus } from './tools/get-development-eval-status.js';
import { handleGetFeatureStatus } from './tools/get-feature-status.js';
import { handleGetNextPhase } from './tools/get-next-phase.js';
import { handleGetSkillProposalQueue } from './tools/get-skill-proposal-queue.js';
import { handleGetSkillProposals } from './tools/get-skill-proposals.js';
import { handlePickNextAutonomousPhase } from './tools/pick-next-autonomous-phase.js';
import { handlePreparePhaseContext } from './tools/prepare-phase-context.js';
import { handlePublishSkillProposal } from './tools/publish-skill-proposal.js';
import { handleRecordCommit } from './tools/record-commit.js';
import { handleRecordEvalPlan } from './tools/record-eval-plan.js';
import { handleRecordEvalRun } from './tools/record-eval-run.js';
import { handleRecordMerge } from './tools/record-merge.js';
import { handleRecordReleaseCloseoutFailure } from './tools/record-release-closeout-failure.js';
import { handleRecordReleaseHandoffFailure } from './tools/record-release-handoff-failure.js';
import { handleRecordReleaseHandoff } from './tools/record-release-handoff.js';
import { handleRecordPhaseArtifact } from './tools/record-phase-artifact.js';
import { handleRecordPullRequest } from './tools/record-pull-request.js';
import { handleRecordQualityGate } from './tools/record-quality-gate.js';
import { handleRecordPhaseResult } from './tools/record-phase-result.js';
import { handleRecordSupervisorEvent } from './tools/record-supervisor-event.js';
import { handleRecordSkillProposalDecision } from './tools/record-skill-proposal-decision.js';
import { handleRecordSkillProposalDraft } from './tools/record-skill-proposal-draft.js';
import { handleRecordWatcherReview } from './tools/record-watcher-review.js';
import { handleRunReviewChecks } from './tools/run-review-checks.js';
import { handleRunPolicyChecks } from './tools/run-policy-checks.js';
import { handleStartFeature } from './tools/start-feature.js';
import { handleSubmitClaim } from './tools/submit-claim.js';
import { handleSyncSkillProposalCandidates } from './tools/sync-skill-proposal-candidates.js';
import { handleVerifyClaims } from './tools/verify-claims.js';
import { handleVerifyDesign } from './tools/verify-design.js';
import { safeToolHandler } from './utils.js';

const project_root = process.env.ODIN_PROJECT_ROOT ?? process.cwd();
const runtime_config = loadRuntimeConfig(project_root);
const runtime_summary = summarizeRuntimeConfig(project_root, runtime_config);

console.error(`[Odin Runtime] Project root: ${runtime_summary.project_root}`);
console.error(`[Odin Runtime] Runtime mode: ${runtime_summary.runtime_mode}`);
console.error(`[Odin Runtime] Review adapter: ${runtime_summary.review_provider}`);
console.error(`[Odin Runtime] Skills auto-detect: ${runtime_summary.skills_auto_detect ? 'enabled' : 'disabled'}`);
console.error(
  `[Odin Runtime] Automation mode: ${runtime_summary.automation_mode}` +
    `${runtime_summary.automation_paused ? ' (paused)' : ''}` +
    `${runtime_summary.automation_kill_switch ? ' (kill-switch active)' : ''}`
);
console.error(`[Odin Runtime] ${CONFIG_RESTART_NOTE}`);

function createWorkflowStateAdapter(): WorkflowStateAdapter {
  const config = runtime_config;

  if (config.runtime.mode === 'supabase') {
    if (!config.supabase?.url || !config.supabase?.secret_key) {
      console.error(
        '[Odin Runtime] FATAL: runtime.mode is "supabase" but SUPABASE_URL and/or SUPABASE_SECRET_KEY are missing.\n' +
        '  → Set them in .env or .odin/config.yaml, or change runtime.mode to "in_memory".\n' +
        '  → Run `odin init` (or `odin-runtime-init`) to generate config scaffolding.'
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
  const provider = runtime_config.archive?.provider ?? 'none';
  if (provider !== 'supabase') {
    console.error('[Odin Runtime] Archive adapter: disabled (provider: none)');
    return null;
  }

  if (!runtime_config.supabase?.url || !runtime_config.supabase?.secret_key) {
    console.error(
      '[Odin Runtime] Archive adapter: disabled (SUPABASE_URL and SUPABASE_SECRET_KEY are required when archive.provider is "supabase")'
    );
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
    version: '0.6.1-beta',
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
    description: 'Record a feature inside the Odin runtime after the feature branch already exists locally.',
    inputSchema: StartFeatureInputSchema,
  },
  safeToolHandler(async (input) => handleStartFeature(workflow_state, input))
);

server.registerTool(
  'odin.get_feature_status',
  {
    title: 'Get Feature Status',
    description: 'Return a richer feature status bundle with workflow counts, invocation coverage, recent activity, and the current automation snapshot.',
    inputSchema: GetFeatureStatusInputSchema,
  },
  safeToolHandler(async (input) => handleGetFeatureStatus(workflow_state, runtime_config, input))
);

server.registerTool(
  'odin.get_development_eval_status',
  {
    title: 'Get Development Eval Status',
    description: 'Inspect focused development eval state, latest artifacts, and recent history for a feature.',
    inputSchema: GetDevelopmentEvalStatusInputSchema,
  },
  safeToolHandler(async (input) => handleGetDevelopmentEvalStatus(workflow_state, input))
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
  'odin.pick_next_autonomous_phase',
  {
    title: 'Pick Next Autonomous Phase',
    description: 'Select the next feature phase that Ralph Loop can pick up safely and return prepared context.',
    inputSchema: PickNextAutonomousPhaseInputSchema,
  },
  safeToolHandler(async (input) => handlePickNextAutonomousPhase(workflow_state, skill_adapter, runtime_config, input))
);

server.registerTool(
  'odin.prepare_phase_context',
  {
    title: 'Prepare Phase Context',
    description: 'Assemble the working bundle an agent needs for a feature phase.',
    inputSchema: PreparePhaseContextInputSchema,
  },
  safeToolHandler(async (input) => handlePreparePhaseContext(workflow_state, skill_adapter, runtime_config, input))
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
  'odin.submit_claim',
  {
    title: 'Submit Claim',
    description: 'Submit a watched agent claim for policy and watcher verification.',
    inputSchema: SubmitClaimInputSchema,
  },
  safeToolHandler(async (input) => handleSubmitClaim(workflow_state, input))
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
    description: 'Record the GitHub pull request created for a feature and return the current automation snapshot.',
    inputSchema: RecordPullRequestInputSchema,
  },
  safeToolHandler(async (input) => handleRecordPullRequest(workflow_state, runtime_config, input))
);

server.registerTool(
  'odin.record_merge',
  {
    title: 'Record Merge',
    description: 'Record that a human merged the feature pull request and return the current automation snapshot.',
    inputSchema: RecordMergeInputSchema,
  },
  safeToolHandler(async (input) => handleRecordMerge(workflow_state, runtime_config, input))
);

server.registerTool(
  'odin.record_release_handoff',
  {
    title: 'Record Release Handoff',
    description: 'Close the active Release invocation after PR handoff while keeping the feature in phase 9.',
    inputSchema: RecordReleaseHandoffInputSchema,
  },
  safeToolHandler(async (input) => handleRecordReleaseHandoff(workflow_state, input))
);

server.registerTool(
  'odin.record_release_handoff_failure',
  {
    title: 'Record Release Handoff Failure',
    description: 'Close the active Release invocation after a failed PR handoff attempt so Ralph Loop can retry later.',
    inputSchema: RecordReleaseHandoffFailureInputSchema,
  },
  safeToolHandler(async (input) => handleRecordReleaseHandoffFailure(workflow_state, input))
);

server.registerTool(
  'odin.record_release_closeout_failure',
  {
    title: 'Record Release Closeout Failure',
    description: 'Close the active Release invocation after a failed release closeout attempt so Ralph Loop can retry later.',
    inputSchema: RecordReleaseCloseoutFailureInputSchema,
  },
  safeToolHandler(async (input) => handleRecordReleaseCloseoutFailure(workflow_state, input))
);

server.registerTool(
  'odin.record_quality_gate',
  {
    title: 'Record Quality Gate',
    description: 'Record a workflow quality gate decision for a feature.',
    inputSchema: RecordQualityGateInputSchema,
  },
  safeToolHandler(async (input) => handleRecordQualityGate(workflow_state, input))
);

server.registerTool(
  'odin.record_supervisor_event',
  {
    title: 'Record Supervisor Event',
    description: 'Persist Ralph Loop tick/no-op/failure/completion events for operator visibility.',
    inputSchema: RecordSupervisorEventInputSchema,
  },
  safeToolHandler(async (input) => handleRecordSupervisorEvent(workflow_state, input))
);

server.registerTool(
  'odin.record_eval_plan',
  {
    title: 'Record Eval Plan',
    description: 'Record a structured development eval plan for the Architect phase.',
    inputSchema: RecordEvalPlanInputSchema,
  },
  safeToolHandler(async (input) => handleRecordEvalPlan(workflow_state, input))
);

server.registerTool(
  'odin.record_eval_run',
  {
    title: 'Record Eval Run',
    description: 'Record a structured development eval run for Reviewer or Integrator.',
    inputSchema: RecordEvalRunInputSchema,
  },
  safeToolHandler(async (input) => handleRecordEvalRun(workflow_state, input))
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
  'odin.run_policy_checks',
  {
    title: 'Run Policy Checks',
    description: 'Run deterministic policy checks for submitted claims on a feature.',
    inputSchema: RunPolicyChecksInputSchema,
  },
  safeToolHandler(async (input) => handleRunPolicyChecks(workflow_state, input))
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
  'odin.get_skill_proposal_queue',
  {
    title: 'Get Skill Proposal Queue',
    description: 'Inspect repeated unresolved learning topics that may warrant a generated skill draft.',
    inputSchema: GetSkillProposalQueueInputSchema,
  },
  safeToolHandler(async (input) => handleGetSkillProposalQueue(workflow_state, skill_adapter, input))
);

server.registerTool(
  'odin.get_skill_proposals',
  {
    title: 'Get Skill Proposals',
    description: 'List drafted, approved, rejected, or published skill proposal records.',
    inputSchema: GetSkillProposalsInputSchema,
  },
  safeToolHandler(async (input) => handleGetSkillProposals(workflow_state, input))
);

server.registerTool(
  'odin.record_skill_proposal_draft',
  {
    title: 'Record Skill Proposal Draft',
    description: 'Persist a drafted generated-skill proposal and run deterministic validation on it.',
    inputSchema: RecordSkillProposalDraftInputSchema,
  },
  safeToolHandler(async (input) => handleRecordSkillProposalDraft(workflow_state, skill_adapter, input))
);

server.registerTool(
  'odin.record_skill_proposal_decision',
  {
    title: 'Record Skill Proposal Decision',
    description: 'Approve or reject a drafted skill proposal after validation review.',
    inputSchema: RecordSkillProposalDecisionInputSchema,
  },
  safeToolHandler(async (input) => handleRecordSkillProposalDecision(workflow_state, input))
);

server.registerTool(
  'odin.publish_skill_proposal',
  {
    title: 'Publish Skill Proposal',
    description: 'Publish an approved skill proposal into .odin/skills/generated and refresh proposal state.',
    inputSchema: PublishSkillProposalInputSchema,
  },
  safeToolHandler(async (input) => handlePublishSkillProposal(workflow_state, skill_adapter, project_root, input))
);

server.registerTool(
  'odin.sync_skill_proposal_candidates',
  {
    title: 'Sync Skill Proposal Candidates',
    description: 'Persist the current deterministic skill proposal candidate queue into workflow state for later review.',
    inputSchema: SyncSkillProposalCandidatesInputSchema,
  },
  safeToolHandler(async (input) => handleSyncSkillProposalCandidates(workflow_state, skill_adapter, input))
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
  'odin.get_claims_needing_review',
  {
    title: 'Get Claims Needing Review',
    description: 'List claims currently waiting for watcher review.',
    inputSchema: GetClaimsNeedingReviewInputSchema,
  },
  safeToolHandler(async (input) => handleGetClaimsNeedingReview(workflow_state, input))
);

server.registerTool(
  'odin.record_watcher_review',
  {
    title: 'Record Watcher Review',
    description: 'Record the watcher verdict for an escalated claim.',
    inputSchema: RecordWatcherReviewInputSchema,
  },
  safeToolHandler(async (input) => handleRecordWatcherReview(workflow_state, input))
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
