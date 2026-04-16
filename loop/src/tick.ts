import { randomUUID } from 'node:crypto';

import { executeReleaseHandoff, type GitHubCommandRunner } from './executors/release-handoff.js';
import { executeReleaseCloseout } from './executors/release-closeout.js';
import type { AutonomousSelection, RuntimeToolClient, SubagentExecutionArtifact, SubagentExecutor, TickOutcome } from './types.js';

/**
 * Selects the explanation to report when no autonomous phase was chosen.
 *
 * @param skipped_summary - An ordered list of skip entries, each containing a `detail` message to explain why a phase was skipped.
 * @returns The `detail` from the first entry in `skipped_summary` if present, otherwise the default message "No autonomous phase is eligible right now."
 */
function deriveNoopReason(skipped_summary: Array<{ detail: string }>): string {
  return skipped_summary[0]?.detail ?? 'No autonomous phase is eligible right now.';
}

/**
 * Builds a structured context object containing the requested prompt sections from a selection's prepared_context.
 *
 * @param selection - The autonomous selection whose `prepared_context.execution.prompt_sections` and `prepared_context.raw` supply the requested data
 * @returns An object mapping each requested prompt section name to its corresponding value. Optional sections (e.g., `development_evals`, `automation`, `verification`, `workflow`, `artifacts`, `skills`, `learnings`) are included only when their `prepared_context.raw` values are defined.
 */
function buildPromptSectionContext(selection: AutonomousSelection): Record<string, unknown> {
  const { prepared_context } = selection;
  const entries: Array<[string, unknown]> = [];

  for (const section of prepared_context.execution.prompt_sections) {
    switch (section) {
      case 'phase':
        entries.push(['phase', prepared_context.raw.phase]);
        break;
      case 'role_summary':
        entries.push(['role_summary', prepared_context.agent.role_summary]);
        break;
      case 'constraints':
        entries.push(['constraints', prepared_context.agent.constraints]);
        break;
      case 'development_evals':
        if (prepared_context.raw.development_evals !== undefined) {
          entries.push(['development_evals', prepared_context.raw.development_evals]);
        }
        break;
      case 'automation':
        if (prepared_context.raw.automation !== undefined) {
          entries.push(['automation', prepared_context.raw.automation]);
        }
        break;
      case 'verification':
        if (prepared_context.raw.verification !== undefined) {
          entries.push(['verification', prepared_context.raw.verification]);
        }
        break;
      case 'workflow':
        if (prepared_context.raw.workflow !== undefined) {
          entries.push(['workflow', prepared_context.raw.workflow]);
        }
        break;
      case 'artifacts':
        if (prepared_context.raw.artifacts !== undefined) {
          entries.push(['artifacts', prepared_context.raw.artifacts]);
        }
        break;
      case 'skills':
        if (prepared_context.raw.skills !== undefined) {
          entries.push(['skills', prepared_context.raw.skills]);
        }
        break;
      case 'learnings':
        if (prepared_context.raw.learnings !== undefined) {
          entries.push(['learnings', prepared_context.raw.learnings]);
        }
        break;
    }
  }

  return Object.fromEntries(entries);
}

function buildResponseStyleInstructions(selection: AutonomousSelection): string[] {
  if (selection.prepared_context.execution.response_style !== 'terse_execution') {
    return [];
  }

  return [
    'Use terse execution style for operational chatter and summaries:',
    '- no pleasantries',
    '- no question restatement',
    '- short, direct technical wording',
    '- preserve exact code, commands, identifiers, and evidence',
    '- when producing final workflow artifacts, follow the normal template and readable prose expected by the phase',
  ];
}

function buildExecutionAttestationIds(supervisor_name: string) {
  const harness_run_id = randomUUID();
  const supervisor_session_id = `${supervisor_name}:${harness_run_id}`;

  return {
    harness_run_id,
    supervisor_session_id,
  };
}

/**
 * Constructs the text prompt sent to a subagent for executing an autonomous phase.
 *
 * @param selection - The selected autonomous decision, including `prepared_context` (agent info, phase details, execution guidance, and prompt sections) used to populate the prompt.
 * @returns The multi-line prompt string containing the acting identity, role summary, definition of done, constraints, execution guidance (recommended mode, acting agent name, and prompt sections), and a formatted JSON block of structured context.
 */
function buildSubagentPrompt(selection: AutonomousSelection): string {
  const { prepared_context } = selection;
  const prompt_context = buildPromptSectionContext(selection);
  const response_style_instructions = buildResponseStyleInstructions(selection);
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
    `- Response style: ${prepared_context.execution.response_style}`,
    `- Prompt sections: ${prepared_context.execution.prompt_sections.join(', ')}`,
    ...(response_style_instructions.length === 0 ? [] : ['', ...response_style_instructions]),
    '',
    'Structured context JSON:',
    JSON.stringify(prompt_context, null, 2),
  ];

  return lines.join('\n');
}

/**
 * Deduplicates a list of subagent artifacts, keeping the latest artifact for each (phase, output_type) slot.
 *
 * @param selection - The autonomous selection whose `phase` is used when an artifact lacks its own `phase`
 * @param artifacts - Artifacts to collapse; later items in the array overwrite earlier ones for the same slot
 * @returns An array of artifacts where each element is the most recent artifact for a given `phase` and `output_type`; each returned artifact always includes a `phase` property
 */
function collapseArtifactsForProxy(
  selection: AutonomousSelection,
  artifacts: SubagentExecutionArtifact[],
): Array<SubagentExecutionArtifact & { phase: string }> {
  const latest_by_slot = new Map<string, SubagentExecutionArtifact & { phase: string }>();

  for (const artifact of artifacts) {
    const phase = artifact.phase ?? selection.phase;
    latest_by_slot.set(`${phase}:${artifact.output_type}`, {
      ...artifact,
      phase,
    });
  }

  return [...latest_by_slot.values()];
}

/**
 * Performs inline execution for release-related autonomous selections (phase '9').
 *
 * Executes a release closeout when `selection.reason` is `'merged_and_ready_to_close_release'`; otherwise prepares a release handoff and records the pull request.
 *
 * @param selection - The autonomous selection to execute; must have `phase === '9'`.
 * @returns An object with `phase_outcome: 'completed'` and a `summary` describing the performed action.
 * @throws Error if `selection.phase` is not `'9'`.
 */
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

/**
 * Execute an autonomous selection by running a subagent, persist any returned artifacts, and record the phase result.
 *
 * This delegates execution to the provided subagent executor using a generated prompt, collapses and records returned artifacts, and records the phase result (including outcome, next phase, summary, created_by, and blockers).
 *
 * @param selection - The autonomous selection to execute
 * @param supervisor_name - The supervisor identity used for the subagent execution context
 * @param project_root - Filesystem path of the project workspace passed to the subagent
 * @returns An object containing `phase_outcome` (`'completed'`, `'blocked'`, or `'needs_rework'`) and the phase `summary`
 */
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
  const artifacts = collapseArtifactsForProxy(selection, result.artifacts ?? []);

  for (const artifact of artifacts) {
    await client.recordPhaseArtifact({
      feature_id: selection.feature_id,
      phase: artifact.phase,
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

/**
 * Runs a single supervisor tick: selects the next eligible autonomous phase, executes it
 * (either inline or via a configured subagent), persists execution artifacts and results,
 * records supervisor events, and returns the tick outcome.
 *
 * @param client - Runtime tool client used to pick phases and record events/results
 * @param supervisor_name - Identifier of the supervisor performing the tick
 * @param project_root - Filesystem path to the project root used for executions
 * @param runner - Optional GitHub command runner used for inline release handoff execution
 * @param subagent_executor - Optional executor used to run recommended subagent executions
 * @returns An object describing the tick result:
 *          - `outcome`: one of `'noop'`, `'completed'`, `'blocked'`, `'needs_rework'`, or `'failed'`
 *          - `summary`: human-readable summary of what happened
 *          - `selection`: the phase selection that was executed, or `null` when no selection was processed
 */
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
  let registered_execution: { feature_id: string; phase: string } | null = null;

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
        execution_policy: pick.selection.prepared_context.execution.execution_policy,
        acting_agent_name: pick.selection.prepared_context.execution.acting_agent_name,
      },
    });

    let execution_result:
      | { phase_outcome: 'completed'; summary: string }
      | { phase_outcome: 'blocked' | 'needs_rework'; summary: string };

    if (pick.selection.prepared_context.execution.recommended_mode === 'inline') {
      const attestation = buildExecutionAttestationIds(supervisor_name);
      await client.registerPhaseExecution({
        feature_id: pick.selection.feature_id,
        phase: pick.selection.phase,
        actual_mode: 'inline',
        supervisor_session_id: attestation.supervisor_session_id,
        harness_run_id: attestation.harness_run_id,
        attested_by: supervisor_name,
      });
      registered_execution = {
        feature_id: pick.selection.feature_id,
        phase: pick.selection.phase,
      };
      execution_attempted = true;
      execution_route = 'inline_release';
      execution_result = await executeInlineSelection(client, pick.selection, supervisor_name, project_root, runner);
    } else {
      if (subagent_executor == null) {
        throw new Error(
          `Subagent execution is recommended for ${pick.selection.feature_id} phase ${pick.selection.phase}, but Ralph Loop has no child executor configured.`
        );
      }

      const attestation = buildExecutionAttestationIds(supervisor_name);
      await client.registerPhaseExecution({
        feature_id: pick.selection.feature_id,
        phase: pick.selection.phase,
        actual_mode: 'subagent',
        supervisor_session_id: attestation.supervisor_session_id,
        worker_session_id: `${attestation.supervisor_session_id}:worker:${randomUUID()}`,
        harness_run_id: attestation.harness_run_id,
        attested_by: supervisor_name,
      });
      registered_execution = {
        feature_id: pick.selection.feature_id,
        phase: pick.selection.phase,
      };
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
    if (execution_attempted && !execution_succeeded && registered_execution != null) {
      try {
        await client.clearPhaseExecution(registered_execution);
      } catch (cleanup_error) {
        const cleanup_message = cleanup_error instanceof Error ? cleanup_error.message : 'Unknown phase execution cleanup failure';
        console.error(`[Ralph Loop] Failed to clear phase execution attestation: ${cleanup_message}`);
      }
    }
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
