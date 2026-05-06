import { describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { FeatureRecord, PhaseArtifact } from '../types.js';
import { handleRecordPhaseArtifact } from './record-phase-artifact.js';

function createFeature(): FeatureRecord {
  return {
    id: 'FEAT-ARTIFACT',
    name: 'Artifact Feature',
    status: 'IN_PROGRESS',
    current_phase: '8',
    complexity_level: 2,
    severity: 'ROUTINE',
    created_at: '2026-03-20T00:00:00.000Z',
    updated_at: '2026-03-20T00:00:00.000Z',
  };
}

describe('handleRecordPhaseArtifact', () => {
  it('records optional artifact path metadata', async () => {
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => createFeature()),
      recordPhaseArtifact: vi.fn(async (artifact: PhaseArtifact) => artifact),
    } as unknown as WorkflowStateAdapter;

    const result = await handleRecordPhaseArtifact(adapter, {
      feature_id: 'FEAT-ARTIFACT',
      phase: '8',
      output_type: 'documentation',
      content: { summary: 'Docs updated' },
      artifact_path: 'specs/FEAT-ARTIFACT/documentation-report.md',
      created_by: 'opencode',
    });

    expect(result.isError).toBeUndefined();
    expect(adapter.recordPhaseArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact_path: 'specs/FEAT-ARTIFACT/documentation-report.md',
        created_by: 'documenter-agent',
      }),
    );
    expect(result.structuredContent?.artifact).toMatchObject({
      artifact_path: 'specs/FEAT-ARTIFACT/documentation-report.md',
    });
  });
});
