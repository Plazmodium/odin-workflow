import { executeReleaseHandoff, type GitHubCommandRunner } from './executors/release-handoff.js';
import { executeReleaseCloseout } from './executors/release-closeout.js';
import type { AutonomousSelection, RuntimeToolClient, SubagentExecutor, TickOutcome } from './types.js';

function deriveNoopReason(skipped_summary: Array<{ detail: string }>): string {
  return skipped_summary[0]?.detail ?? 'No autonomous phase is eligible right now.';
}

function buildSubagentPrompt(selection: AutonomousSelection): string {
  const { prepared_context } = selection;
  const lines = [
    `You are acting as ${prepared_context.agent.name} for Odin phase ${prepared_context.phase.id}: ${prepared_context.phase.name}.`,
    '',
    'Role:',
    prepared_context.agent.role_summary,
    '',
    'Definition of done:',
    ...prepared_context.phase.definition_of_done.map((item) => `- ${item}`),
    '',
    'Constraints:',
    ...prepared_context.agent.constraints.map((item) => `- ${item}`),
    '',
    'Execution guidance:',
    `- Recommended mode: ${prepared_context.execution.recommended_mode}`,
    `- Acting agent name for proxied odin.* calls: ${prepared_context.execution.acting_agent_name}`,
    `- Prompt sections: ${prepared_context.execution.prompt_sections.join(', ')}`,
    '',
    'Structured context JSON:',
    JSON.stringify(prepared_context.raw, null, 2),
  ];

  return lines.join('\n');
}

async function executeInlineSelection(
  client: RuntimeToolClient,
  selection: AutonomousSelection,
  supervisor_name: string,
  project_root: string,
  runner?: GitHubCommandRunner,
): Promise<{ phase_outcome: 'completed'; summary: string }> {
  if (selection.phase !== '9') {
    throw new Error(`Inline execution is not implemented for phase ${selection.phase} in Ralph Loop.`);
  }

  if (selection.reason === 'merged_and_ready_to_close_release') {
    await executeReleaseCloseout(client, selection, supervisor_name);
    return {
      phase_outcome: 'completed',
      summary: `${supervisor_name} closed Release after human merge.`,
    };
  }

  await executeReleaseHandoff(client, selection, supervisor_name, project_root, runner);
  return {
    phase_outcome: 'completed',
    summary: 'Release handoff prepared and pull request recorded.',
  };
}

async function executeSubagentSelection(
  client: RuntimeToolClient,
  selection: AutonomousSelection,
  supervisor_name: string,
  project_root: string,
  subagent_executor: SubagentExecutor,
): Promise<{ phase_outcome: 'completed' | 'blocked' | 'needs_rework'; summary: string }> {
  const result = await subagent_executor.execute({
    project_root,
    supervisor_name,
    selection,
    prompt: buildSubagentPrompt(selection),
  });
  const created_by = selection.prepared_context.execution.acting_agent_name;

  for (const artifact of result.artifacts ?? []) {
    await client.recordPhaseArtifact({
      feature_id: selection.feature_id,
      phase: artifact.phase ?? selection.phase,
      output_type: artifact.output_type,
      content: artifact.content,
      created_by,
    });
  }

  await client.recordPhaseResult({
    feature_id: selection.feature_id,
    phase: selection.phase,
    outcome: result.outcome,
    next_phase: result.next_phase,
    summary: result.summary,
    created_by,
    blockers: result.blockers ?? [],
  });

  return {
    phase_outcome: result.outcome,
    summary: result.summary,
  };
}

export async function runTick(
  client: RuntimeToolClient,
  supervisor_name: string,
  project_root: string,
  runner?: GitHubCommandRunner,
  subagent_executor?: SubagentExecutor,
): Promise<TickOutcome> {
  await client.recordSupervisorEvent({
    supervisor_name,
    event_type: 'tick_started',
    summary: 'Ralph Loop tick started.',
  });

  let active_selection: TickOutcome['selection'] = null;
  let execution_attempted = false;
  let execution_succeeded = false;
  let execution_route: 'inline_release' | 'subagent' | null = null;

  try {
    const allowed_phases = subagent_executor == null ? ['9'] : ['5', '6', '7', '8', '9'];
    const pick = await client.pickNextAutonomousPhase(supervisor_name, {
      allowed_phases,
      allowed_selection_reasons: ['ready_for_phase', 'merged_and_ready_to_close_release'],
    });
    if (pick.selection == null) {
      const summary = deriveNoopReason(pick.skipped_summary);
      await client.recordSupervisorEvent({
        supervisor_name,
        event_type: 'tick_noop',
        summary,
        details: {
          skipped_count: pick.skipped_summary.length,
        },
      });

      return {
        outcome: 'noop',
        summary,
        selection: null,
      };
    }

    active_selection = pick.selection;

    await client.recordSupervisorEvent({
      supervisor_name,
      event_type: 'tick_selected',
      summary: `Selected ${pick.selection.feature_id} phase ${pick.selection.phase} for execution.`,
      feature_id: pick.selection.feature_id,
      phase: pick.selection.phase,
      details: {
        reason: pick.selection.reason,
        recommended_mode: pick.selection.prepared_context.execution.recommended_mode,
        acting_agent_name: pick.selection.prepared_context.execution.acting_agent_name,
      },
    });

    let execution_result:
      | { phase_outcome: 'completed'; summary: string }
      | { phase_outcome: 'blocked' | 'needs_rework'; summary: string };

    if (pick.selection.prepared_context.execution.recommended_mode === 'inline') {
      execution_attempted = true;
      execution_route = 'inline_release';
      execution_result = await executeInlineSelection(client, pick.selection, supervisor_name, project_root, runner);
    } else {
      if (subagent_executor == null) {
        throw new Error(
          `Subagent execution is recommended for ${pick.selection.feature_id} phase ${pick.selection.phase}, but Ralph Loop has no child executor configured.`
        );
      }

      execution_attempted = true;
      execution_route = 'subagent';
      execution_result = await executeSubagentSelection(client, pick.selection, supervisor_name, project_root, subagent_executor);
    }
    execution_succeeded = true;

    const summary =
      execution_result.phase_outcome === 'completed'
        ? `Completed ${pick.selection.feature_id} phase ${pick.selection.phase}.`
        : `Recorded ${execution_result.phase_outcome} result for ${pick.selection.feature_id} phase ${pick.selection.phase}.`;
    await client.recordSupervisorEvent({
      supervisor_name,
      event_type: 'tick_completed',
      summary,
      feature_id: pick.selection.feature_id,
      phase: pick.selection.phase,
      details: {
        reason: pick.selection.reason,
        phase_outcome: execution_result.phase_outcome,
        phase_summary: execution_result.summary,
      },
    });

    return {
      outcome: execution_result.phase_outcome,
      summary,
      selection: pick.selection,
    };
  } catch (error) {
    const summary = error instanceof Error ? error.message : 'Ralph Loop tick failed.';
    if (
      execution_route === 'inline_release' &&
      execution_attempted &&
      !execution_succeeded &&
      active_selection?.phase === '9' &&
      active_selection.reason === 'ready_for_phase'
    ) {
      try {
        await client.recordReleaseHandoffFailure({
          feature_id: active_selection.feature_id,
          summary,
          created_by: supervisor_name,
        });
      } catch (cleanup_error) {
        const cleanup_message = cleanup_error instanceof Error ? cleanup_error.message : 'Unknown release handoff cleanup failure';
        console.error(`[Ralph Loop] Failed to record release handoff failure cleanup: ${cleanup_message}`);
      }
    } else if (
      execution_route === 'inline_release' &&
      execution_attempted &&
      !execution_succeeded &&
      active_selection?.phase === '9' &&
      active_selection.reason === 'merged_and_ready_to_close_release'
    ) {
      try {
        await client.recordReleaseCloseoutFailure({
          feature_id: active_selection.feature_id,
          summary,
          created_by: supervisor_name,
        });
      } catch (cleanup_error) {
        const cleanup_message = cleanup_error instanceof Error ? cleanup_error.message : 'Unknown release closeout cleanup failure';
        console.error(`[Ralph Loop] Failed to record release closeout failure cleanup: ${cleanup_message}`);
      }
    }

    try {
      await client.recordSupervisorEvent({
        supervisor_name,
        event_type: 'tick_failed',
        summary,
      });
    } catch (audit_error) {
      const audit_message = audit_error instanceof Error ? audit_error.message : 'Unknown supervisor audit failure';
      console.error(`[Ralph Loop] Failed to record tick failure event: ${audit_message}`);
    }

    return {
      outcome: 'failed',
      summary,
      selection: null,
    };
  }
}
