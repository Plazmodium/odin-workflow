import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkflowStateAdapter } from '../adapters/workflow-state/types.js';
import type { FeatureRecord, PhaseArtifact } from '../types.js';
import { handleExportLocalArtifacts } from './export-local-artifacts.js';

let tempDir: string | null = null;

async function createTempDir(): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), 'odin-export-'));
  return tempDir;
}

afterEach(async () => {
  if (tempDir != null) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('handleExportLocalArtifacts', () => {
  it('writes stable local markdown artifacts', async () => {
    const projectRoot = await createTempDir();
    const feature: FeatureRecord = {
      id: 'FEAT-EXPORT',
      name: 'Export Feature',
      status: 'COMPLETED',
      current_phase: '10',
      complexity_level: 2,
      severity: 'ROUTINE',
      release_handoff_summary: 'PR opened.',
      release_closeout_summary: 'Merged and archived.',
      created_at: '2026-03-20T00:00:00.000Z',
      updated_at: '2026-03-20T00:00:00.000Z',
    };
    const artifacts: PhaseArtifact[] = [
      {
        id: 'artifact_prd',
        feature_id: 'FEAT-EXPORT',
        phase: '1',
        output_type: 'prd',
        content: { goal: 'User value' },
        created_by: 'product-agent',
        created_at: '2026-03-20T00:00:00.000Z',
      },
    ];
    const adapter: WorkflowStateAdapter = {
      getFeature: vi.fn(async () => feature),
      listPhaseArtifacts: vi.fn(async () => artifacts),
      recordAuditEvent: vi.fn(async () => undefined),
    } as unknown as WorkflowStateAdapter;

    const result = await handleExportLocalArtifacts(adapter, projectRoot, {
      feature_id: 'FEAT-EXPORT',
      include: ['prd', 'release_handoff', 'release_closeout'],
    });

    expect(result.isError).toBeUndefined();
    expect(await readFile(join(projectRoot, '.odin/exports/FEAT-EXPORT/prd.md'), 'utf8')).toContain('# PRD');
    expect(await readFile(join(projectRoot, '.odin/exports/FEAT-EXPORT/release-handoff.md'), 'utf8')).toContain('PR opened.');
    expect(await readFile(join(projectRoot, '.odin/exports/FEAT-EXPORT/release-closeout.md'), 'utf8')).toContain('Merged and archived.');
  });
});
