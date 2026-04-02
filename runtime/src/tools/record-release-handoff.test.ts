import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { FeatureRecord } from '../types.js';
import { handleRecordReleaseHandoff } from './record-release-handoff.js';

function createFeature(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-RELEASE',
    name: 'Release Feature',
    status: 'IN_PROGRESS',
    current_phase: '9',
    complexity_level: 2,
    severity: 'ROUTINE',
    pr_url: 'https://github.com/org/repo/pull/42',
    pr_number: 42,
    created_at: '2026-04-02T00:00:00.000Z',
    updated_at: '2026-04-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('handleRecordReleaseHandoff', () => {
  it('closes the open release invocation and records an audit event', async () => {
    const feature = createFeature();
    const adapter: WorkflowStateAdapter = {
      getFeature: vi
        .fn()
        .mockResolvedValueOnce(feature)
        .mockResolvedValueOnce(feature),
      findOpenAgentInvocation: vi.fn(async () => ({
        id: 'inv_release',
        feature_id: 'FEAT-RELEASE',
        phase: '9',
        agent_name: 'ralph-loop',
        operation: 'Phase 9: Release',
        skills_used: [],
        started_at: '2026-04-02T00:00:00.000Z',
        ended_at: null,
        duration_ms: null,
      })),
      listAgentInvocations: vi.fn(async () => [
        {
          id: 'inv_release',
          feature_id: 'FEAT-RELEASE',
          phase: '9',
          agent_name: 'ralph-loop',
          operation: 'Phase 9: Release',
          skills_used: [],
          started_at: '2026-04-02T00:00:00.000Z',
          ended_at: null,
          duration_ms: null,
        },
      ]),
      completeAgentInvocation: vi.fn(async () => ({
        id: 'inv_release',
        feature_id: 'FEAT-RELEASE',
        phase: '9',
        agent_name: 'ralph-loop',
        operation: 'Phase 9: Release',
        skills_used: [],
        started_at: '2026-04-02T00:00:00.000Z',
        ended_at: '2026-04-02T00:05:00.000Z',
        duration_ms: 300000,
      })),
      recordAuditEvent: vi.fn(async () => undefined),
    } as unknown as WorkflowStateAdapter;

    const result = await handleReleaseHandoff(adapter);

    expect(result.isError).toBeUndefined();
    expect(adapter.completeAgentInvocation).toHaveBeenCalledWith('inv_release');
    expect(adapter.recordAuditEvent).toHaveBeenCalledWith(
      'FEAT-RELEASE',
      'RELEASE_HANDOFF_RECORDED',
      'ralph-loop',
      expect.objectContaining({ pr_number: 42 }),
    );
  });

  it('falls back to closing any open release invocation when the actor-scoped lookup misses', async () => {
    const feature = createFeature();
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn().mockResolvedValueOnce(feature).mockResolvedValueOnce(feature),
      findOpenAgentInvocation: vi.fn(async () => null),
      listAgentInvocations: vi.fn(async () => [
        {
          id: 'inv_release_default',
          feature_id: 'FEAT-RELEASE',
          phase: '9',
          agent_name: 'release-agent',
          operation: 'Phase 9: Release',
          skills_used: [],
          started_at: '2026-04-02T00:00:00.000Z',
          ended_at: null,
          duration_ms: null,
        },
      ]),
      completeAgentInvocation: vi.fn(async () => ({
        id: 'inv_release_default',
        feature_id: 'FEAT-RELEASE',
        phase: '9',
        agent_name: 'release-agent',
        operation: 'Phase 9: Release',
        skills_used: [],
        started_at: '2026-04-02T00:00:00.000Z',
        ended_at: '2026-04-02T00:05:00.000Z',
        duration_ms: 300000,
      })),
      recordAuditEvent: vi.fn(async () => undefined),
    } as unknown as WorkflowStateAdapter;

    const result = await handleReleaseHandoff(adapter);

    expect(result.isError).toBeUndefined();
    expect(adapter.completeAgentInvocation).toHaveBeenCalledWith('inv_release_default');
  });

  it('rejects release handoff without a recorded pull request', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature({ pr_url: undefined, pr_number: undefined })),
    } as unknown as WorkflowStateAdapter;

    const result = await handleReleaseHandoff(adapter);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('cannot record release handoff until a pull request is recorded');
  });
});

async function handleReleaseHandoff(adapter: WorkflowStateAdapter) {
  return handleRecordReleaseHandoff(adapter, {
    feature_id: 'FEAT-RELEASE',
    summary: 'Release handoff prepared by Ralph Loop.',
    created_by: 'ralph-loop',
  });
}
