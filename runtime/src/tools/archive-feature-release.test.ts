import { describe, expect, it, vi } from 'vitest';

import type { ArchiveAdapter } from '../adapters/archive/types.js';
import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type {
  ClaimVerificationSummary,
  FeatureArchiveRecord,
  FeatureEvalSummary,
  FeatureRecord,
  LearningRecord,
  PhaseArtifact,
  PhaseResultRecord,
  ReviewCheckRecord,
} from '../types.js';
import { handleArchiveFeatureRelease } from './archive-feature-release.js';

function createFeatureRecord(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    id: 'FEAT-001',
    name: 'Archive Test Feature',
    status: 'IN_PROGRESS',
    current_phase: '9',
    complexity_level: 2,
    severity: 'ROUTINE',
    created_at: '2026-03-13T00:00:00.000Z',
    updated_at: '2026-03-13T00:00:00.000Z',
    ...overrides,
  };
}

function createArtifact(output_type: string, created_at: string, content: unknown): PhaseArtifact {
  return {
    id: `artifact_${output_type}_${created_at}`,
    feature_id: 'FEAT-001',
    phase: output_type === 'prd' ? '1' : output_type === 'spec' ? '3' : '9',
    output_type,
    content,
    created_by: 'tester',
    created_at,
  };
}

function createArchiveRecord(): FeatureArchiveRecord {
  return {
    id: 'archive_1',
    feature_id: 'FEAT-001',
    storage_path: 'workflow-archives/FEAT-001/',
    summary: 'Archive summary',
    files_archived: ['prd.md', 'spec.md'],
    total_size_bytes: 123,
    spec_snapshot: { scope: 'test' },
    archived_at: '2026-03-13T00:00:00.000Z',
    archived_by: 'release-agent',
  };
}

function createWorkflowAdapter(
  feature: FeatureRecord | null,
  artifacts: PhaseArtifact[]
): WorkflowStateAdapter {
  return {
    startFeature: vi.fn(),
    getFeature: vi.fn(async () => feature),
    recordPhaseArtifact: vi.fn(),
    listPhaseArtifacts: vi.fn(async () => artifacts),
    recordPhaseResult: vi.fn(),
    listOpenBlockers: vi.fn(async () => []),
    listOpenGates: vi.fn(async () => []),
    listOpenFindings: vi.fn(async () => []),
    listPendingClaims: vi.fn(async () => []),
    listClaimVerificationStatus: vi.fn(async () => [] as ClaimVerificationSummary[]),
    getLatestFeatureEval: vi.fn(async () => null as FeatureEvalSummary | null),
    recordReviewCheck: vi.fn(),
    listReviewChecks: vi.fn(async () => [] as ReviewCheckRecord[]),
    captureLearning: vi.fn(),
    listLearnings: vi.fn(async () => [] as LearningRecord[]),
  } as unknown as WorkflowStateAdapter;
}

describe('handleArchiveFeatureRelease', () => {
  it('returns an error when no archive adapter is configured', async () => {
    const result = await handleArchiveFeatureRelease(
      createWorkflowAdapter(createFeatureRecord(), []),
      null,
      {
        feature_id: 'FEAT-001',
        summary: 'summary',
        archived_by: 'release-agent',
        include_output_types: ['prd'],
      }
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Archive adapter is unavailable');
  });

  it('selects the latest artifact per output type, uploads markdown files, and records the archive', async () => {
    const artifacts = [
      createArtifact('prd', '2026-03-13T00:00:00.000Z', { problem: 'old' }),
      createArtifact('prd', '2026-03-13T01:00:00.000Z', { problem: 'new' }),
      createArtifact('spec', '2026-03-13T02:00:00.000Z', { approach: ['ship it'] }),
    ];
    const workflow = createWorkflowAdapter(createFeatureRecord(), artifacts);

    const uploadArchive = vi.fn(async () => ({
      success: true,
      storage_path: 'workflow-archives/FEAT-001/',
      files_uploaded: ['prd.md', 'spec.md'],
      total_size_bytes: 456,
    }));
    const recordArchive = vi.fn(async () => createArchiveRecord());
    const archiveAdapter: ArchiveAdapter = {
      uploadArchive,
      recordArchive,
      listArchives: vi.fn(async () => []),
    };

    const result = await handleArchiveFeatureRelease(workflow, archiveAdapter, {
      feature_id: 'FEAT-001',
      summary: 'Archive summary',
      archived_by: 'release-agent',
      release_notes: 'Released',
      release_version: 'v1',
      include_output_types: ['prd', 'spec'],
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain('Archived 2 file(s)');
    expect(uploadArchive).toHaveBeenCalledTimes(1);
    const uploadedFiles = uploadArchive.mock.calls[0]?.[0]?.files;
    expect(uploadedFiles).toHaveLength(2);
    expect(uploadedFiles?.[0]?.name).toBe('prd.md');
    expect(uploadedFiles?.[0]?.content).toContain('new');
    expect(recordArchive).toHaveBeenCalledTimes(1);
    expect(recordArchive.mock.calls[0]?.[0]?.spec_snapshot).toEqual({ approach: ['ship it'] });
  });

  it('fails fast when the upload result is unsuccessful', async () => {
    const workflow = createWorkflowAdapter(createFeatureRecord(), [
      createArtifact('prd', '2026-03-13T00:00:00.000Z', { problem: 'x' }),
    ]);

    const recordArchive = vi.fn(async () => createArchiveRecord());
    const archiveAdapter: ArchiveAdapter = {
      uploadArchive: vi.fn(async () => ({
        success: false,
        storage_path: 'workflow-archives/FEAT-001/',
        files_uploaded: [],
        total_size_bytes: 0,
        errors: ['upload failed'],
      })),
      recordArchive,
      listArchives: vi.fn(async () => []),
    };

    const result = await handleArchiveFeatureRelease(workflow, archiveAdapter, {
      feature_id: 'FEAT-001',
      summary: 'Archive summary',
      archived_by: 'release-agent',
      include_output_types: ['prd'],
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Archive upload failed');
    expect(recordArchive).not.toHaveBeenCalled();
  });
});
