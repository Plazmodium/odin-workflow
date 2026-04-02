import type { AutonomousSelection, RuntimeToolClient } from '../types.js';

export async function executeReleaseCloseout(
  client: RuntimeToolClient,
  selection: AutonomousSelection,
  supervisor_name: string,
): Promise<void> {
  await client.recordPhaseResult({
    feature_id: selection.feature_id,
    phase: '9',
    outcome: 'completed',
    next_phase: '10',
    summary: `${supervisor_name} closed Release after human merge.`,
    created_by: supervisor_name,
    blockers: [],
  });
}
