import { executeReleaseHandoff, type GitHubCommandRunner } from './executors/release-handoff.js';
import { executeReleaseCloseout } from './executors/release-closeout.js';
import type { RuntimeToolClient, TickOutcome } from './types.js';

function deriveNoopReason(skipped_summary: Array<{ detail: string }>): string {
  return skipped_summary[0]?.detail ?? 'No autonomous phase is eligible right now.';
}

export async function runTick(
  client: RuntimeToolClient,
  supervisor_name: string,
  project_root: string,
  runner?: GitHubCommandRunner,
): Promise<TickOutcome> {
  await client.recordSupervisorEvent({
    supervisor_name,
    event_type: 'tick_started',
    summary: 'Ralph Loop tick started.',
  });

  let active_selection: TickOutcome['selection'] = null;
  let execution_attempted = false;
  let execution_succeeded = false;

  try {
    const pick = await client.pickNextAutonomousPhase(supervisor_name, {
      allowed_phases: ['9'],
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
      },
    });

    execution_attempted = true;

    if (pick.selection.reason === 'merged_and_ready_to_close_release') {
      await executeReleaseCloseout(client, pick.selection, supervisor_name);
    } else {
      await executeReleaseHandoff(client, pick.selection, supervisor_name, project_root, runner);
    }
    execution_succeeded = true;

    const summary = `Completed ${pick.selection.feature_id} phase ${pick.selection.phase}.`;
    await client.recordSupervisorEvent({
      supervisor_name,
      event_type: 'tick_completed',
      summary,
      feature_id: pick.selection.feature_id,
      phase: pick.selection.phase,
      details: {
        reason: pick.selection.reason,
      },
    });

    return {
      outcome: 'completed',
      summary,
      selection: pick.selection,
    };
  } catch (error) {
    const summary = error instanceof Error ? error.message : 'Ralph Loop tick failed.';
    if (execution_attempted && !execution_succeeded && active_selection?.phase === '9' && active_selection.reason === 'ready_for_phase') {
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
