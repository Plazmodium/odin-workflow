import { describe, expect, it, vi } from 'vitest';

import type { AutonomousSelection, RuntimeToolClient, SubagentExecutor } from './types.js';
import { runTick } from './tick.js';
import type { GitHubCommandRunner } from './executors/release-handoff.js';

function createPreparedContext(
  phase: string,
  recommended_mode: 'inline' | 'subagent',
  acting_agent_name: string,
  response_style: 'normal' | 'terse_execution',
) {
  const phase_name = phase === '9' ? 'Release' : phase === '5' ? 'Builder' : `Phase ${phase}`;
  const role_name = phase === '9' ? 'release-agent' : phase === '5' ? 'builder-agent' : `${phase_name.toLowerCase()}-agent`;
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
      execution_policy: phase === '5' || phase === '6' || phase === '7'
        ? 'distinct_session_preferred' as const
        : 'inline_allowed' as const,
      prompt_realization_policy,
      child_state_strategy: recommended_mode === 'subagent' ? 'direct_odin_tools_if_available' as const : 'return_intent_to_parent' as const,
      response_style,
      phase_prompt_manifest,
      prompt_sections: ['phase', 'role_summary', 'constraints'] as const,
    },
  };
}

function createSelection(
  phase: string,
  recommended_mode: 'inline' | 'subagent',
  overrides: Partial<AutonomousSelection> = {},
): AutonomousSelection {
  const acting_agent_name = recommended_mode === 'subagent' ? 'builder-agent' : 'ralph-loop';
  const response_style = phase === '5' || phase === '6' || phase === '7' || phase === '9'
    ? 'terse_execution'
    : 'normal';

  return {
    feature_id: 'FEAT-BASE',
    feature_name: 'Base Feature',
    phase,
    reason: 'ready_for_phase',
    branch_name: phase === '9' ? 'gr/feature/FEAT-BASE' : null,
    base_branch: 'main',
    release_notes: phase === '9' ? 'Release notes' : null,
    prepared_context: createPreparedContext(phase, recommended_mode, acting_agent_name, response_style),
    ...overrides,
  };
}

function createClient(overrides: Partial<RuntimeToolClient> = {}): RuntimeToolClient {
  return {
    pickNextAutonomousPhase: vi.fn(async () => ({
      selection: null,
      skipped_summary: [],
    })),
    recordSupervisorEvent: vi.fn(async () => undefined),
    registerPhaseExecution: vi.fn(async () => undefined),
    clearPhaseExecution: vi.fn(async () => undefined),
    registerPhaseRealization: vi.fn(async () => undefined),
    recordPhaseArtifact: vi.fn(async () => undefined),
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
          ...createSelection('9', 'inline', {
            feature_id: 'FEAT-2',
            feature_name: 'Feature 2',
            reason: 'merged_and_ready_to_close_release',
            branch_name: null,
            base_branch: null,
            release_notes: null,
          }),
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
    expect(client.registerPhaseExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_id: 'FEAT-2',
        phase: '9',
        actual_mode: 'inline',
        attested_by: 'ralph-loop',
      }),
    );
    expect(client.recordSupervisorEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'tick_completed', feature_id: 'FEAT-2' }),
    );
  });

  it('records a failure when release closeout errors', async () => {
    const client = createClient({
      pickNextAutonomousPhase: vi.fn(async () => ({
        selection: {
          ...createSelection('9', 'inline', {
            feature_id: 'FEAT-3',
            feature_name: 'Feature 3',
            reason: 'merged_and_ready_to_close_release',
            branch_name: null,
            base_branch: null,
            release_notes: null,
          }),
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
    expect(client.clearPhaseExecution).toHaveBeenCalledWith({
      feature_id: 'FEAT-3',
      phase: '9',
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
          ...createSelection('9', 'inline', {
            feature_id: 'FEAT-5',
            feature_name: 'Feature 5',
            branch_name: 'gr/feature/FEAT-5',
            release_notes: 'Release notes',
          }),
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
    expect(client.clearPhaseExecution).toHaveBeenCalledWith({
      feature_id: 'FEAT-5',
      phase: '9',
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
          ...createSelection('9', 'inline', {
            feature_id: 'FEAT-4',
            feature_name: 'Feature 4',
            branch_name: 'gr/feature/FEAT-4',
            release_notes: 'Added the automated release handoff flow.',
          }),
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
          ...createSelection('9', 'inline', {
            feature_id: 'FEAT-6',
            feature_name: 'Feature 6',
            branch_name: 'gr/feature/FEAT-6',
            release_notes: 'Release notes',
          }),
        },
        skipped_summary: [],
      })),
    });

    const result = await runTick(client, 'ralph-loop', '/tmp/project', runner);

    expect(result.outcome).toBe('failed');
    expect(client.recordReleaseHandoffFailure).not.toHaveBeenCalled();
  });

  it('routes subagent phases through the child executor and proxies artifacts/results with acting attribution', async () => {
    const execute = vi.fn(async () => ({
      summary: 'Builder implementation finished.',
      outcome: 'completed' as const,
      next_phase: '6',
      blockers: [],
      artifacts: [{ output_type: 'documentation', content: { note: 'done' } }],
    }));
    const subagent_executor: SubagentExecutor = {
      execute,
    };
    const client = createClient({
      pickNextAutonomousPhase: vi.fn(async () => ({
        selection: createSelection('5', 'subagent', {
          feature_id: 'FEAT-7',
          feature_name: 'Feature 7',
          branch_name: null,
          release_notes: null,
        }),
        skipped_summary: [],
      })),
    });

    const result = await runTick(client, 'ralph-loop', '/tmp/project', undefined, subagent_executor);

    expect(result).toMatchObject({
      outcome: 'completed',
      summary: 'Completed FEAT-7 phase 5.',
    });
    expect(client.pickNextAutonomousPhase).toHaveBeenCalledWith('ralph-loop', {
      allowed_phases: ['5', '6', '7', '8', '9'],
      allowed_selection_reasons: ['ready_for_phase', 'merged_and_ready_to_close_release'],
    });
    expect(client.recordPhaseArtifact).toHaveBeenCalledWith({
      feature_id: 'FEAT-7',
      phase: '5',
      output_type: 'documentation',
      content: { note: 'done' },
      created_by: 'builder-agent',
    });
    expect(client.registerPhaseExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_id: 'FEAT-7',
        phase: '5',
        actual_mode: 'subagent',
        attested_by: 'ralph-loop',
      }),
    );
    expect(subagent_executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        project_root: '/tmp/project',
        supervisor_name: 'ralph-loop',
        selection: expect.objectContaining({
          feature_id: 'FEAT-7',
          phase: '5',
        }),
        prompt: expect.stringContaining('You are acting as builder-agent for Odin phase 5: Builder.'),
      }),
    );
    expect(execute.mock.calls[0]?.[0]?.prompt).toContain(
      'Use terse execution style for operational chatter and summaries:'
    );
    expect(execute.mock.calls[0]?.[0]?.prompt).toContain(
      'Prompt realization guidance:'
    );
    expect(execute.mock.calls[0]?.[0]?.prompt).toContain(
      '"execution": {'
    );
    expect(client.recordPhaseResult).toHaveBeenCalledWith({
      feature_id: 'FEAT-7',
      phase: '5',
      outcome: 'completed',
      next_phase: '6',
      summary: 'Builder implementation finished.',
      created_by: 'builder-agent',
      blockers: [],
    });
    expect(client.registerPhaseRealization).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_id: 'FEAT-7',
        phase: '5',
        manifest: expect.objectContaining({ manifest_id: 'manifest-5' }),
        proof_status: 'bundle_attested',
      }),
    );
  });

  it('does not inject terse-style instructions for normal-style subagent phases', async () => {
    const subagent_executor: SubagentExecutor = {
      execute: vi.fn(async () => ({
        summary: 'Documentation completed.',
        outcome: 'completed',
        next_phase: '9',
        blockers: [],
      })),
    };
    const client = createClient({
      pickNextAutonomousPhase: vi.fn(async () => ({
        selection: createSelection('8', 'subagent', {
          feature_id: 'FEAT-8A',
          feature_name: 'Feature 8A',
          branch_name: null,
          release_notes: null,
        }),
        skipped_summary: [],
      })),
    });

    await runTick(client, 'ralph-loop', '/tmp/project', undefined, subagent_executor);

    expect((subagent_executor.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.prompt).not.toContain(
      'Use terse execution style for operational chatter and summaries:'
    );
    expect((subagent_executor.execute as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.prompt).toContain(
      'Response style: normal'
    );
    expect(client.registerPhaseExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_id: 'FEAT-8A',
        phase: '8',
        actual_mode: 'subagent',
      }),
    );
    expect(client.registerPhaseRealization).not.toHaveBeenCalled();
  });

  it('collapses duplicate artifact slots before proxying them to the runtime', async () => {
    const subagent_executor: SubagentExecutor = {
      execute: vi.fn(async () => ({
        summary: 'Builder implementation finished.',
        outcome: 'completed',
        next_phase: '6',
        blockers: [],
        artifacts: [
          { output_type: 'documentation', content: { note: 'first' } },
          { output_type: 'documentation', content: { note: 'latest' } },
        ],
      })),
    };
    const client = createClient({
      pickNextAutonomousPhase: vi.fn(async () => ({
        selection: createSelection('5', 'subagent', {
          feature_id: 'FEAT-7B',
          feature_name: 'Feature 7B',
          branch_name: null,
          release_notes: null,
        }),
        skipped_summary: [],
      })),
    });

    await runTick(client, 'ralph-loop', '/tmp/project', undefined, subagent_executor);

    expect(client.recordPhaseArtifact).toHaveBeenCalledTimes(1);
    expect(client.recordPhaseArtifact).toHaveBeenCalledWith({
      feature_id: 'FEAT-7B',
      phase: '5',
      output_type: 'documentation',
      content: { note: 'latest' },
      created_by: 'builder-agent',
    });
  });

  it('records verified prompt realization when the child echoes the manifest nonce', async () => {
    const subagent_executor: SubagentExecutor = {
      execute: vi.fn(async () => ({
        summary: 'Builder implementation finished.',
        outcome: 'completed',
        next_phase: '6',
        blockers: [],
        phase_prompt_nonce_ack: 'nonce-5',
      })),
    };
    const client = createClient({
      pickNextAutonomousPhase: vi.fn(async () => ({
        selection: createSelection('5', 'subagent', {
          feature_id: 'FEAT-7C',
          feature_name: 'Feature 7C',
          branch_name: null,
          release_notes: null,
        }),
        skipped_summary: [],
      })),
    });

    await runTick(client, 'ralph-loop', '/tmp/project', undefined, subagent_executor);

    expect(client.registerPhaseRealization).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_id: 'FEAT-7C',
        phase: '5',
        child_ack_nonce: 'nonce-5',
        proof_status: 'bundle_verified',
      }),
    );
  });

  it('fails without release cleanup when subagent execution is recommended but no child executor is configured', async () => {
    const client = createClient({
      pickNextAutonomousPhase: vi.fn(async () => ({
        selection: createSelection('5', 'subagent', {
          feature_id: 'FEAT-9',
          feature_name: 'Feature 9',
          branch_name: null,
          release_notes: null,
        }),
        skipped_summary: [],
      })),
    });

    const result = await runTick(client, 'ralph-loop', '/tmp/project');

    expect(result).toMatchObject({
      outcome: 'failed',
      summary: 'Subagent execution is recommended for FEAT-9 phase 5, but Ralph Loop has no child executor configured.',
    });
    expect(client.recordReleaseHandoffFailure).not.toHaveBeenCalled();
    expect(client.recordReleaseCloseoutFailure).not.toHaveBeenCalled();
  });

  it('returns the recorded blocked subagent outcome instead of flattening it to completed', async () => {
    const subagent_executor: SubagentExecutor = {
      execute: vi.fn(async () => ({
        summary: 'Builder is blocked on missing credentials.',
        outcome: 'blocked',
        blockers: ['Missing API credentials'],
      })),
    };
    const client = createClient({
      pickNextAutonomousPhase: vi.fn(async () => ({
        selection: createSelection('5', 'subagent', {
          feature_id: 'FEAT-8',
          feature_name: 'Feature 8',
          branch_name: null,
          release_notes: null,
        }),
        skipped_summary: [],
      })),
    });

    const result = await runTick(client, 'ralph-loop', '/tmp/project', undefined, subagent_executor);

    expect(result).toMatchObject({
      outcome: 'blocked',
      summary: 'Recorded blocked result for FEAT-8 phase 5.',
    });
    expect(client.recordPhaseResult).toHaveBeenCalledWith({
      feature_id: 'FEAT-8',
      phase: '5',
      outcome: 'blocked',
      next_phase: undefined,
      summary: 'Builder is blocked on missing credentials.',
      created_by: 'builder-agent',
      blockers: ['Missing API credentials'],
    });
  });

});
