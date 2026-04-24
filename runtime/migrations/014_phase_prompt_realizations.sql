-- Migration: 014_phase_prompt_realizations
-- Description: Add persisted prompt-realization attestations proving a phase worker was launched from the canonical Odin phase bundle.
-- Dependencies:
--   - 012_phase_execution_attestations.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prompt_realization_policy') THEN
    CREATE TYPE prompt_realization_policy AS ENUM ('phase_bundle_optional', 'phase_bundle_preferred', 'phase_bundle_required');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prompt_realization_proof_status') THEN
    CREATE TYPE prompt_realization_proof_status AS ENUM ('none', 'bundle_attested', 'bundle_verified');
  END IF;
END
$$;

CREATE TABLE phase_prompt_realizations (
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  phase phase NOT NULL,
  phase_role_name TEXT NOT NULL,
  prompt_realization_policy prompt_realization_policy NOT NULL,
  manifest_id TEXT NOT NULL,
  manifest_version TEXT NOT NULL,
  shared_context_hash TEXT NOT NULL,
  phase_definition_hash TEXT NOT NULL,
  resolved_skill_hashes TEXT[] NOT NULL DEFAULT '{}',
  required_prompt_sections TEXT[] NOT NULL DEFAULT '{}',
  context_bundle_hash TEXT NOT NULL,
  nonce TEXT NOT NULL,
  actual_mode phase_execution_mode NOT NULL,
  proof_status prompt_realization_proof_status NOT NULL,
  supervisor_session_id TEXT,
  worker_session_id TEXT,
  harness_run_id TEXT,
  attested_by TEXT NOT NULL,
  child_prompt_hash TEXT NOT NULL,
  wrapper_hash TEXT,
  child_ack_nonce TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (feature_id, phase),
  CHECK (proof_status IN ('bundle_attested', 'bundle_verified')),
  CHECK (
    (actual_mode = 'inline' AND (worker_session_id IS NULL OR worker_session_id = supervisor_session_id))
    OR (actual_mode = 'subagent' AND worker_session_id IS NOT NULL AND (supervisor_session_id IS NULL OR worker_session_id <> supervisor_session_id))
  )
);

CREATE INDEX idx_phase_prompt_realizations_feature_recorded_at
  ON phase_prompt_realizations(feature_id, recorded_at DESC);
CREATE INDEX idx_phase_prompt_realizations_manifest_id
  ON phase_prompt_realizations(manifest_id);
CREATE INDEX idx_phase_prompt_realizations_proof_status
  ON phase_prompt_realizations(proof_status);

ALTER TABLE phase_prompt_realizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on phase_prompt_realizations"
  ON phase_prompt_realizations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_phase_prompt_realizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS phase_prompt_realizations_updated_at_trigger ON phase_prompt_realizations;
CREATE TRIGGER phase_prompt_realizations_updated_at_trigger
  BEFORE UPDATE ON phase_prompt_realizations
  FOR EACH ROW
  EXECUTE FUNCTION update_phase_prompt_realizations_updated_at();
