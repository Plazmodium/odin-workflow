import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import { RecordPhaseSkillsAppliedInputSchema } from '../schemas.js';
import { handleRecordPhaseSkillsApplied } from './record-phase-skills-applied.js';

describe('handleRecordPhaseSkillsApplied', () => {
  it('records an audit event for applied skills', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => ({ id: 'FEAT-SKILL', current_phase: '5' })),
      recordAuditEvent: vi.fn(async () => undefined),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPhaseSkillsApplied(adapter, {
      feature_id: 'FEAT-SKILL',
      phase: '5',
      agent_name: 'opencode',
      skills_applied: ['testing/vitest'],
      fallback_used: false,
      no_applicable_skill: false,
      notes: 'Used Vitest guidance.',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordAuditEvent).toHaveBeenCalledWith(
      'FEAT-SKILL',
      'PHASE_SKILLS_APPLIED_RECORDED',
      'builder-agent',
      expect.objectContaining({ skills_applied: ['testing/vitest'] }),
    );
  });

  it('rejects contradictory skill usage states', () => {
    expect(RecordPhaseSkillsAppliedInputSchema.safeParse({
      feature_id: 'FEAT-SKILL',
      phase: '5',
      skills_applied: ['testing/vitest'],
      fallback_used: false,
      no_applicable_skill: true,
    }).success).toBe(false);

    expect(RecordPhaseSkillsAppliedInputSchema.safeParse({
      feature_id: 'FEAT-SKILL',
      phase: '5',
      skills_applied: ['testing/vitest'],
      fallback_used: true,
      no_applicable_skill: false,
    }).success).toBe(false);
  });
});
