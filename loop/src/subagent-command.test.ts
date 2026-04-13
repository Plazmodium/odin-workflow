import { describe, expect, it } from 'vitest';

import { createCommandSubagentExecutor } from './subagent-command.js';
import type { AutonomousSelection, SubagentExecutionRequest } from './types.js';

function createSelection(): AutonomousSelection {
  return {
    feature_id: 'FEAT-SUB',
    feature_name: 'Subagent Feature',
    phase: '5',
    reason: 'ready_for_phase',
    branch_name: null,
    base_branch: 'main',
    release_notes: null,
    prepared_context: {
      raw: {
        phase: { id: '5', name: 'Builder' },
        agent: { name: 'builder-agent' },
      },
      phase: {
        id: '5',
        name: 'Builder',
        purpose: 'Implement the approved specification.',
        definition_of_done: ['Implementation completed'],
      },
      agent: {
        name: 'builder-agent',
        role_summary: 'Implement the approved plan with high code quality.',
        constraints: ['Emit watched-phase claims when required.'],
      },
      execution: {
        phase_role_name: 'builder-agent',
        acting_agent_name: 'builder-agent',
        supported_modes: ['inline', 'subagent'],
        recommended_mode: 'subagent',
        child_state_strategy: 'direct_odin_tools_if_available',
        prompt_sections: ['phase', 'role_summary', 'constraints'],
      },
    },
  };
}

function createRequest(): SubagentExecutionRequest {
  return {
    project_root: process.cwd(),
    supervisor_name: 'ralph-loop',
    selection: createSelection(),
    prompt: 'Build the feature.',
  };
}

describe('createCommandSubagentExecutor', () => {
  it('parses a successful child result from stdout', async () => {
    const script = [
      process.execPath,
      '-e',
      [
        "let input='';",
        "process.stdin.on('data', chunk => input += String(chunk));",
        "process.stdin.on('end', () => {",
        '  const payload = JSON.parse(input);',
        "  process.stdout.write(JSON.stringify({",
        "    summary: `Executed ${payload.request.selection.feature_id}` ,",
        "    outcome: 'completed',",
        "    next_phase: '6',",
        "    blockers: [],",
        "    artifacts: [{ output_type: 'documentation', content: { ok: true } }]",
        '  }));',
        '});',
      ].join(' '),
    ];

    const executor = createCommandSubagentExecutor(script);
    const result = await executor.execute(createRequest());

    expect(result).toEqual({
      summary: 'Executed FEAT-SUB',
      outcome: 'completed',
      next_phase: '6',
      blockers: [],
      artifacts: [{ output_type: 'documentation', content: { ok: true } }],
    });
  });

  it('rejects malformed stdout payloads', async () => {
    const executor = createCommandSubagentExecutor([
      process.execPath,
      '-e',
      "process.stdout.write('not-json');",
    ]);

    await expect(executor.execute(createRequest())).rejects.toThrow(
      'Subagent executor returned invalid JSON on stdout.',
    );
  });

  it('rejects valid JSON with a malformed result shape', async () => {
    const executor = createCommandSubagentExecutor([
      process.execPath,
      '-e',
      "process.stdout.write(JSON.stringify({ outcome: 'completed' }));",
    ]);

    await expect(executor.execute(createRequest())).rejects.toThrow(
      'Subagent executor returned an incomplete result payload.',
    );
  });

  it('surfaces child-process failures with stderr', async () => {
    const executor = createCommandSubagentExecutor([
      process.execPath,
      '-e',
      "process.stderr.write('child failed'); process.exit(3);",
    ]);

    await expect(executor.execute(createRequest())).rejects.toThrow(
      'child failed',
    );
  });
});
