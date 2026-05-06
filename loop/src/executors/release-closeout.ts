import type { AutonomousSelection, RuntimeToolClient } from '../types.js';

export async function executeReleaseCloseout(
  client: RuntimeToolClient,
  selection: AutonomousSelection,
  supervisor_name: string,
): Promise<void> {
  await client.recordReleaseCloseout({
    feature_id: selection.feature_id,
    summary: `${supervisor_name} closed Release after human merge.`,
    created_by: supervisor_name,
  });
}
