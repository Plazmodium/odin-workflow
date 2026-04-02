import { describe, expect, it, vi } from 'vitest';

import type {
  ArchiveFeatureReleaseInput,
  PickNextAutonomousPhaseOptions,
  PickNextAutonomousPhaseResult,
  RecordPhaseResultInput,
  RecordPullRequestInput,
  RecordReleaseCloseoutFailureInput,
  RecordReleaseHandoffFailureInput,
  RecordReleaseHandoffInput,
  RecordSupervisorEventInput,
  RuntimeToolClient,
} from './types.js';
import type { GitHubCommandRunner } from './executors/release-handoff.js';
import { runTick } from './tick.js';

type Stage = 'handoff' | 'closeout' | 'noop';

class FakeRuntimeToolClient implements RuntimeToolClient {
  stage: Stage = 'handoff';
  readonly supervisor_events: RecordSupervisorEventInput[] = [];
  readonly archived_releases: ArchiveFeatureReleaseInput[] = [];
  readonly recorded_prs: RecordPullRequestInput[] = [];
  readonly release_handoffs: RecordReleaseHandoffInput[] = [];
  readonly release_handoff_failures: RecordReleaseHandoffFailureInput[] = [];
  readonly release_closeout_failures: RecordReleaseCloseoutFailureInput[] = [];
  readonly phase_results: RecordPhaseResultInput[] = [];

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

    client.stage = 'closeout';

    const closeout = await runTick(client, 'ralph-loop', '/tmp/project', runner);

    expect(closeout.outcome).toBe('completed');
    expect(client.phase_results).toEqual([
      {
        feature_id: 'FEAT-RALPH',
        phase: '9',
        outcome: 'completed',
        next_phase: '10',
        summary: 'ralph-loop closed Release after human merge.',
        created_by: 'ralph-loop',
        blockers: [],
      },
    ]);
  });

  it('simulates a handoff failure and records cleanup telemetry', async () => {
    const client = new FakeRuntimeToolClient();
    const runner: GitHubCommandRunner = {
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
  });
});
