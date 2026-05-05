import { describe, expect, it } from 'vitest';

import type { PhaseArtifact } from '../types.js';
import { assessPhaseExpectedArtifacts } from './phase-artifacts.js';

describe('assessPhaseExpectedArtifacts', () => {
  it('does not satisfy current phase requirements with artifacts from another phase', () => {
    const guardian_review: PhaseArtifact = {
      id: 'artifact_review_phase_4',
      feature_id: 'FEAT-ARTIFACTS',
      phase: '4',
      output_type: 'review',
      content: { summary: 'Guardian approved' },
      artifact_path: null,
      created_by: 'guardian-agent',
      created_at: '2026-03-20T00:00:00.000Z',
    };

    const assessment = assessPhaseExpectedArtifacts('6', [guardian_review], { mode: 'strict' });

    expect(assessment.error).toContain('Phase 6 is missing expected completion artifact');
    expect(assessment.missing).toEqual([
      expect.objectContaining({
        output_type: 'review',
        status: 'missing',
      }),
    ]);
  });
});
