import { describe, expect, it, vi } from 'vitest';

import type {
  ArchiveFeatureReleaseInput,
  PickNextAutonomousPhaseOptions,
  PickNextAutonomousPhaseResult,
  RecordPhaseResultInput,
  RecordPullRequestInput,
  RecordReleaseCloseoutInput,
  RecordReleaseCloseoutFailureInput,
  RecordReleaseHandoffFailureInput,
  RecordReleaseHandoffInput,
  RecordSupervisorEventInput,
  RuntimeToolClient,
} from './types.js';
import type { GitHubCommandRunner } from './executors/release-handoff.js';
import { runTick } from './tick.js';

type Stage = 'handoff' | 'closeout' | 'noop';

function createPreparedContext(phase: string, recommended_mode: 'inline' | 'subagent', acting_agent_name: string) {
  const phase_name = phase === '9' ? 'Release' : 'Builder';
  const role_name = phase === '9' ? 'release-agent' : 'builder-agent';
  const prompt_realization_policy = phase === '5' || phase === '6' || phase === '7'
    ? 'phase_bundle_preferred'
    : 'phase_bundle_optional';
  const phase_prompt_manifest = {
    manifest_id: `manifest-${phase}`,
    phase,
    phase_role_name: role_name,
    shared_context_hash: 'a'.repeat(64),
    phase_definition_hash: 'b'.repeat(64),
    resolved_skill_hashes: ['c'.repeat(64)],
    required_prompt_sections: ['phase', 'role_summary', 'constraints'] as const,
    context_bundle_hash: 'd'.repeat(64),
    manifest_version: '1',
    nonce: `nonce-${phase}`,
  };

  return {
    raw: {
      phase: { id: phase, name: phase_name },
      agent: { name: role_name },
      execution: { recommended_mode, acting_agent_name, prompt_realization_policy, phase_prompt_manifest },
    },
    phase: {
      id: phase,
      name: phase_name,
      purpose: `Purpose for ${phase_name}.`,
      definition_of_done: [`${phase_name} complete`],
    },
    agent: {
      name: role_name,
      role_summary: `Role summary for ${phase_name}.`,
      constraints: ['Follow the prepared context.'],
    },
    execution: {
      phase_role_name: role_name,
      acting_agent_name,
      supported_modes: ['inline', 'subagent'] as const,
      recommended_mode,
      execution_policy: (phase === '5' || phase === '6' || phase === '7')
        ? 'distinct_session_preferred' as const
        : 'inline_allowed' as const,
      prompt_realization_policy,
      child_state_strategy: recommended_mode === 'subagent' ? 'direct_odin_tools_if_available' as const : 'return_intent_to_parent' as const,
      response_style: 'terse_execution' as const,
      phase_prompt_manifest,
      prompt_sections: ['phase', 'role_summary', 'constraints'] as const,
    },
  };
}

class FakeRuntimeToolClient implements RuntimeToolClient {
  stage: Stage = 'handoff';
  readonly supervisor_events: RecordSupervisorEventInput[] = [];
  readonly archived_releases: ArchiveFeatureReleaseInput[] = [];
  readonly recorded_prs: RecordPullRequestInput[] = [];
  readonly release_handoffs: RecordReleaseHandoffInput[] = [];
  readonly release_closeouts: RecordReleaseCloseoutInput[] = [];
  readonly release_handoff_failures: RecordReleaseHandoffFailureInput[] = [];
  readonly release_closeout_failures: RecordReleaseCloseoutFailureInput[] = [];
  readonly phase_results: RecordPhaseResultInput[] = [];
  readonly phase_executions: Array<{ feature_id: string; phase: string; actual_mode: string }> = [];
  readonly cleared_phase_executions: Array<{ feature_id: string; phase: string }> = [];
  readonly phase_realizations: Array<{ feature_id: string; phase: string; proof_status: string }> = [];

  async pickNextAutonomousPhase(_supervisor_name: string, options?: PickNextAutonomousPhaseOptions): Promise<PickNextAutonomousPhaseResult> {
    const allow_reason = (reason: string): boolean =>
      options?.allowed_selection_reasons == null || options.allowed_selection_reasons.includes(reason);
    const allow_phase_9 = options?.allowed_phases == null || options.allowed_phases.includes('9');

    if (!allow_phase_9) {
      return {
        selection: null,
        skipped_summary: [],
      };
    }

    if (this.stage === 'handoff' && allow_reason('ready_for_phase')) {
      return {
        selection: {
          feature_id: 'FEAT-RALPH',
          feature_name: 'Ralph Release Feature',
          phase: '9',
          reason: 'ready_for_phase',
          branch_name: 'gr/feature/FEAT-RALPH',
          base_branch: 'main',
          release_notes: 'Added Ralph Loop release handoff support.',
          prepared_context: createPreparedContext('9', 'inline', 'ralph-loop'),
        },
        skipped_summary: [],
      };
    }

    if (this.stage === 'closeout' && allow_reason('merged_and_ready_to_close_release')) {
      return {
        selection: {
          feature_id: 'FEAT-RALPH',
          feature_name: 'Ralph Release Feature',
          phase: '9',
          reason: 'merged_and_ready_to_close_release',
          branch_name: 'gr/feature/FEAT-RALPH',
          base_branch: 'main',
          release_notes: 'Added Ralph Loop release handoff support.',
          prepared_context: createPreparedContext('9', 'inline', 'ralph-loop'),
        },
        skipped_summary: [],
      };
    }

    return {
      selection: null,
      skipped_summary: [
        {
          feature_id: 'FEAT-RALPH',
          feature_name: 'Ralph Release Feature',
          current_phase: '9',
          status: 'waiting_on_human_merge',
          detail: 'Pull request is recorded and waiting for a human merge.',
        },
      ],
    };
  }

  async recordSupervisorEvent(input: RecordSupervisorEventInput): Promise<void> {
    this.supervisor_events.push(input);
  }

  async registerPhaseExecution(input: { feature_id: string; phase: string; actual_mode: string }): Promise<void> {
    this.phase_executions.push(input);
  }

  async clearPhaseExecution(input: { feature_id: string; phase: string }): Promise<void> {
    this.cleared_phase_executions.push(input);
  }

  async registerPhaseRealization(input: { feature_id: string; phase: string; proof_status: string }): Promise<void> {
    this.phase_realizations.push(input);
  }

  async recordPhaseArtifact(): Promise<void> {}

  async recordPhaseResult(input: RecordPhaseResultInput): Promise<void> {
    this.phase_results.push(input);
    this.stage = 'noop';
  }

  async archiveFeatureRelease(input: ArchiveFeatureReleaseInput): Promise<void> {
    this.archived_releases.push(input);
  }

  async recordPullRequest(input: RecordPullRequestInput): Promise<void> {
    this.recorded_prs.push(input);
  }

  async recordReleaseHandoff(input: RecordReleaseHandoffInput): Promise<void> {
    this.release_handoffs.push(input);
  }

  async recordReleaseCloseout(input: RecordReleaseCloseoutInput): Promise<void> {
    this.release_closeouts.push(input);
    this.stage = 'noop';
  }

  async recordReleaseHandoffFailure(input: RecordReleaseHandoffFailureInput): Promise<void> {
    this.release_handoff_failures.push(input);
  }

  async recordReleaseCloseoutFailure(input: RecordReleaseCloseoutFailureInput): Promise<void> {
    this.release_closeout_failures.push(input);
  }

  async close(): Promise<void> {}
}

function createRunner(): GitHubCommandRunner {
  const findPullRequest = vi
    .fn<GitHubCommandRunner['findPullRequest']>()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({
      url: 'https://github.com/org/repo/pull/42',
      number: 42,
    });

  return {
    ensureFeatureBranchReady: vi.fn(async () => undefined),
    pushBranch: vi.fn(async () => undefined),
    findPullRequest,
    createPullRequest: vi.fn(async () => undefined),
  };
}

describe('Ralph Loop simulated scenarios', () => {
  it('simulates release handoff first, then merged release closeout', async () => {
    const client = new FakeRuntimeToolClient();
    const runner = createRunner();

    const handoff = await runTick(client, 'ralph-loop', '/tmp/project', runner);

    expect(handoff.outcome).toBe('completed');
    expect(client.archived_releases).toEqual([
      {
        feature_id: 'FEAT-RALPH',
        summary: '[FEAT-RALPH] Ralph Release Feature',
        archived_by: 'ralph-loop',
        release_notes: 'Added Ralph Loop release handoff support.',
      },
    ]);
    expect(client.recorded_prs).toEqual([
      {
        feature_id: 'FEAT-RALPH',
        pr_url: 'https://github.com/org/repo/pull/42',
        pr_number: 42,
      },
    ]);
    expect(client.release_handoffs).toEqual([
      {
        feature_id: 'FEAT-RALPH',
        summary: 'Release handoff prepared and PR #42 recorded.',
        created_by: 'ralph-loop',
      },
    ]);
    expect(client.phase_executions[0]).toMatchObject({
      feature_id: 'FEAT-RALPH',
      phase: '9',
      actual_mode: 'inline',
    });

    client.stage = 'closeout';

    const closeout = await runTick(client, 'ralph-loop', '/tmp/project', runner);

    expect(closeout.outcome).toBe('completed');
    expect(client.release_closeouts).toEqual([
      {
        feature_id: 'FEAT-RALPH',
        summary: 'ralph-loop closed Release after human merge.',
        created_by: 'ralph-loop',
      },
    ]);
  });

  it('simulates a handoff failure and records cleanup telemetry', async () => {
    const client = new FakeRuntimeToolClient();
    const runner: GitHubCommandRunner = {
      ensureFeatureBranchReady: vi.fn(async () => undefined),
      pushBranch: vi.fn(async () => undefined),
      findPullRequest: vi.fn(async () => null),
      createPullRequest: vi.fn(async () => {
        throw new Error('gh pr create failed');
      }),
    };

    const result = await runTick(client, 'ralph-loop', '/tmp/project', runner);

    expect(result).toMatchObject({
      outcome: 'failed',
      summary: 'gh pr create failed',
    });
    expect(client.release_handoff_failures).toEqual([
      {
        feature_id: 'FEAT-RALPH',
        summary: 'gh pr create failed',
        created_by: 'ralph-loop',
      },
    ]);
    expect(client.cleared_phase_executions).toEqual([
      {
        feature_id: 'FEAT-RALPH',
        phase: '9',
      },
    ]);
  });
});
