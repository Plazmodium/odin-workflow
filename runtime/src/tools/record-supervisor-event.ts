/**
 * Record Supervisor Event Tool
 * Version: 0.1.0
 */

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { RecordSupervisorEventInput } from '../schemas.js';
import { createTextResult } from '../utils.js';

export async function handleRecordSupervisorEvent(
  adapter: WorkflowStateAdapter,
  input: RecordSupervisorEventInput,
) {
  const operation = `SUPERVISOR_${input.event_type.toUpperCase()}`;
  const details = {
    ...(input.details == null ? {} : input.details),
    summary: input.summary,
    ...(input.phase == null ? {} : { phase: input.phase }),
  };

  await adapter.recordAuditEvent(input.feature_id ?? null, operation, input.supervisor_name, details);

  return createTextResult(
    `Recorded ${input.event_type} supervisor event for ${input.supervisor_name}.`,
    {
      supervisor_name: input.supervisor_name,
      event_type: input.event_type,
      feature_id: input.feature_id ?? null,
      phase: input.phase ?? null,
      details,
    },
  );
}
