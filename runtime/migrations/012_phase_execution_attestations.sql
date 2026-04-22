-- Migration: 012_phase_execution_attestations
-- Description: Add persisted execution attestation records for actual phase execution mode and distinct-session proof.
-- Dependencies:
--   - 011_complete_feature_phase_coverage.sql
-- Rollback:
--   DROP TABLE IF EXISTS phase_execution_attestations;
--   DROP TYPE IF EXISTS phase_execution_attestation_source;
--   DROP TYPE IF EXISTS phase_execution_proof_status;
--   DROP TYPE IF EXISTS phase_execution_mode;
--   DROP TYPE IF EXISTS phase_execution_policy;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'phase_execution_policy') THEN
    CREATE TYPE phase_execution_policy AS ENUM ('inline_allowed', 'distinct_session_preferred', 'distinct_session_required');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'phase_execution_mode') THEN
    CREATE TYPE phase_execution_mode AS ENUM ('inline', 'subagent');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'phase_execution_proof_status') THEN
    CREATE TYPE phase_execution_proof_status AS ENUM ('none', 'attested', 'verified');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'phase_execution_attestation_source') THEN
    CREATE TYPE phase_execution_attestation_source AS ENUM ('harness', 'runtime_inferred');
  END IF;
END
$$;

CREATE TABLE phase_execution_attestations (
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  phase phase NOT NULL,
  execution_policy phase_execution_policy NOT NULL,
  recommended_mode phase_execution_mode NOT NULL,
  actual_mode phase_execution_mode NOT NULL,
  proof_status phase_execution_proof_status NOT NULL DEFAULT 'attested',
  supervisor_session_id TEXT,
  worker_session_id TEXT,
  harness_run_id TEXT,
  attested_by TEXT,
  attestation_source phase_execution_attestation_source,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (feature_id, phase),
  CHECK (
    (proof_status = 'none' AND attested_by IS NULL AND attestation_source IS NULL)
    OR (proof_status IN ('attested', 'verified') AND attested_by IS NOT NULL AND attestation_source IS NOT NULL)
  ),
  CHECK (
    (actual_mode = 'inline' AND (worker_session_id IS NULL OR worker_session_id = supervisor_session_id))
    OR (actual_mode = 'subagent' AND worker_session_id IS NOT NULL AND (supervisor_session_id IS NULL OR worker_session_id <> supervisor_session_id))
  )
);

COMMENT ON TABLE phase_execution_attestations IS 'Actual execution mode and attested session linkage for feature phases.';

CREATE INDEX idx_phase_execution_attestations_feature_recorded_at
  ON phase_execution_attestations(feature_id, recorded_at DESC);
CREATE INDEX idx_phase_execution_attestations_proof_status
  ON phase_execution_attestations(proof_status);

ALTER TABLE phase_execution_attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on phase_execution_attestations"
  ON phase_execution_attestations FOR ALL TO service_role USING (true) WITH CHECK (true);
