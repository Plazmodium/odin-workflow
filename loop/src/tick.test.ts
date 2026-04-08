import { describe, expect, it, vi } from 'vitest';

import type { RuntimeToolClient } from './types.js';
import { runTick } from './tick.js';
import type { GitHubCommandRunner } from './executors/release-handoff.js';

function createClient(overrides: Partial<RuntimeToolClient> = {}): RuntimeToolClient {
  return {
    pickNextAutonomousPhase: vi.fn(async () => ({
      selection: null,
      skipped_summary: [],
    })),
    recordSupervisorEvent: vi.fn(async () => undefined),
    recordPhaseResult: vi.fn(async () => undefined),
    archiveFeatureRelease: vi.fn(async () => undefined),
    recordPullRequest: vi.fn(async () => undefined),
    recordReleaseHandoff: vi.fn(async () => undefined),
    recordReleaseHandoffFailure: vi.fn(async () => undefined),
    recordReleaseCloseoutFailure: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createRunner(): GitHubCommandRunner {
  return {
    ensureFeatureBranchReady: vi.fn(async () => undefined),
    pushBranch: vi.fn(async () => undefined),
    findPullRequest: vi.fn(async () => ({
      url: 'https://github.com/org/repo/pull/42',
      number: 42,
    })),
    createPullRequest: vi.fn(async () => undefined),
  };
}

describe('runTick', () => {
  it('records a noop when no selection is available', async () => {
    const client = createClient({
      pickNextAutonomousPhase: vi.fn(async () => ({
        selection: null,
        skipped_summary: [{
          feature_id: 'FEAT-1',
          feature_name: 'Feature 1',
          current_phase: '9',
          status: 'waiting_on_human_merge',
          detail: 'Pull request is recorded and waiting for a human merge.',
        }],
      })),
    });

    const result = await runTick(client, 'ralph-loop', '/tmp/project');

    expect(result).toMatchObject({
      outcome: 'noop',
      summary: 'Pull request is recorded and waiting for a human merge.',
      selection: null,
    });
    expect(client.recordSupervisorEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'tick_noop' }),
    );
  });

  it('closes a merged release selection and records completion', async () => {
    const client = createClient({
      pickNextAutonomousPhase: vi.fn(async () => ({
        selection: {
          feature_id: 'FEAT-2',
          feature_name: 'Feature 2',
          phase: '9',
          reason: 'merged_and_ready_to_close_release',
          branch_name: null,
          base_branch: null,
          release_notes: null,
        },
        skipped_summary: [],
      })),
    });

    const result = await runTick(client, 'ralph-loop', '/tmp/project');

    expect(result).toMatchObject({
      outcome: 'completed',
      selection: {
        feature_id: 'FEAT-2',
      },
    });
    expect(client.recordPhaseResult).toHaveBeenCalledWith({
      feature_id: 'FEAT-2',
      phase: '9',
      outcome: 'completed',
      next_phase: '10',
      summary: 'ralph-loop closed Release after human merge.',
      created_by: 'ralph-loop',
      blockers: [],
    });
    expect(client.recordSupervisorEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'tick_completed', feature_id: 'FEAT-2' }),
    );
  });

  it('records a failure when release closeout errors', async () => {
    const client = createClient({
      pickNextAutonomousPhase: vi.fn(async () => ({
        selection: {
          feature_id: 'FEAT-3',
          feature_name: 'Feature 3',
          phase: '9',
          reason: 'merged_and_ready_to_close_release',
          branch_name: null,
          base_branch: null,
          release_notes: null,
        },
        skipped_summary: [],
      })),
      recordPhaseResult: vi.fn(async () => {
        throw new Error('runtime completion blocked');
      }),
    });

    const result = await runTick(client, 'ralph-loop', '/tmp/project');

    expect(result).toMatchObject({
      outcome: 'failed',
      summary: 'runtime completion blocked',
    });
    expect(client.recordSupervisorEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'tick_failed', summary: 'runtime completion blocked' }),
    );
    expect(client.recordReleaseCloseoutFailure).toHaveBeenCalledWith({
      feature_id: 'FEAT-3',
      summary: 'runtime completion blocked',
      created_by: 'ralph-loop',
    });
  });

  it('records handoff cleanup when auto-pr release execution fails', async () => {
    const runner = createRunner();
    const client = createClient({
      pickNextAutonomousPhase: vi.fn(async () => ({
        selection: {
          feature_id: 'FEAT-5',
          feature_name: 'Feature 5',
          phase: '9',
          reason: 'ready_for_phase',
          branch_name: 'gr/feature/FEAT-5',
          base_branch: 'main',
          release_notes: 'Release notes',
        },
        skipped_summary: [],
      })),
      archiveFeatureRelease: vi.fn(async () => {
        throw new Error('archive unavailable');
      }),
    });

    const result = await runTick(client, 'ralph-loop', '/tmp/project', runner);

    expect(result).toMatchObject({
      outcome: 'failed',
      summary: 'archive unavailable',
    });
    expect(client.recordReleaseHandoffFailure).toHaveBeenCalledWith({
      feature_id: 'FEAT-5',
      summary: 'archive unavailable',
      created_by: 'ralph-loop',
    });
  });

  it('executes release handoff when auto_pr release work is ready', async () => {
    const runner = createRunner();
    const client = createClient({
      pickNextAutonomousPhase: vi.fn(async () => ({
        selection: {
          feature_id: 'FEAT-4',
          feature_name: 'Feature 4',
          phase: '9',
          reason: 'ready_for_phase',
          branch_name: 'gr/feature/FEAT-4',
          base_branch: 'main',
          release_notes: 'Added the automated release handoff flow.',
        },
        skipped_summary: [],
      })),
    });

    const result = await runTick(client, 'ralph-loop', '/tmp/project', runner);

    expect(result.outcome).toBe('completed');
    expect(client.archiveFeatureRelease).toHaveBeenCalledWith({
      feature_id: 'FEAT-4',
      summary: '[FEAT-4] Feature 4',
      archived_by: 'ralph-loop',
      release_notes: 'Added the automated release handoff flow.',
    });
    expect(runner.pushBranch).toHaveBeenCalledWith('/tmp/project', 'gr/feature/FEAT-4');
    expect(client.recordPullRequest).toHaveBeenCalledWith({
      feature_id: 'FEAT-4',
      pr_url: 'https://github.com/org/repo/pull/42',
      pr_number: 42,
    });
    expect(client.recordReleaseHandoff).toHaveBeenCalledWith({
      feature_id: 'FEAT-4',
      summary: 'Release handoff prepared and PR #42 recorded.',
      created_by: 'ralph-loop',
    });
  });

  it('does not record cleanup failure after execution already succeeded', async () => {
    const runner = createRunner();
    const recordSupervisorEvent = vi
      .fn<RuntimeToolClient['recordSupervisorEvent']>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('dashboard audit write failed'))
      .mockResolvedValue(undefined);
    const client = createClient({
      recordSupervisorEvent,
      pickNextAutonomousPhase: vi.fn(async () => ({
        selection: {
          feature_id: 'FEAT-6',
          feature_name: 'Feature 6',
          phase: '9',
          reason: 'ready_for_phase',
          branch_name: 'gr/feature/FEAT-6',
          base_branch: 'main',
          release_notes: 'Release notes',
        },
        skipped_summary: [],
      })),
    });

    const result = await runTick(client, 'ralph-loop', '/tmp/project', runner);

    expect(result.outcome).toBe('failed');
    expect(client.recordReleaseHandoffFailure).not.toHaveBeenCalled();
  });
});
