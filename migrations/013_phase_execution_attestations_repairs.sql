-- Migration: 013_phase_execution_attestations_repairs
-- Description: Repair persisted execution attestation storage by backfilling missing indexes, policy, and updated_at trigger.
-- Dependencies:
--   - 012_phase_execution_attestations.sql

CREATE INDEX IF NOT EXISTS idx_phase_execution_attestations_feature_recorded_at
  ON phase_execution_attestations(feature_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_phase_execution_attestations_proof_status
  ON phase_execution_attestations(proof_status);

ALTER TABLE phase_execution_attestations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'phase_execution_attestations'
      AND policyname = 'Service role full access on phase_execution_attestations'
  ) THEN
    CREATE POLICY "Service role full access on phase_execution_attestations"
      ON phase_execution_attestations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION update_phase_execution_attestations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS phase_execution_attestations_updated_at_trigger ON phase_execution_attestations;
CREATE TRIGGER phase_execution_attestations_updated_at_trigger
  BEFORE UPDATE ON phase_execution_attestations
  FOR EACH ROW
  EXECUTE FUNCTION update_phase_execution_attestations_updated_at();
