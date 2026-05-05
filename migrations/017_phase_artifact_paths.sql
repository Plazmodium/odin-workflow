-- Add optional artifact paths for phase completion filename checks.

ALTER TABLE phase_outputs
ADD COLUMN IF NOT EXISTS artifact_path TEXT;

COMMENT ON COLUMN phase_outputs.artifact_path IS 'Optional repository-relative path or filename for artifact completion checks';

DROP FUNCTION IF EXISTS record_phase_output(TEXT, phase, TEXT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION record_phase_output(
  p_feature_id TEXT,
  p_phase phase,
  p_output_type TEXT,
  p_content JSONB,
  p_created_by TEXT DEFAULT 'agent',
  p_artifact_path TEXT DEFAULT NULL
) RETURNS phase_outputs
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_output phase_outputs;
BEGIN
  INSERT INTO phase_outputs (feature_id, phase, output_type, content, artifact_path, created_by)
  VALUES (p_feature_id, p_phase, p_output_type, p_content, p_artifact_path, p_created_by)
  ON CONFLICT (feature_id, phase, output_type)
  DO UPDATE SET
    content = EXCLUDED.content,
    artifact_path = EXCLUDED.artifact_path,
    created_by = EXCLUDED.created_by,
    created_at = now()
  RETURNING * INTO v_output;

  RETURN v_output;
END;
$$;

COMMENT ON FUNCTION record_phase_output(TEXT, phase, TEXT, JSONB, TEXT, TEXT) IS 'Record or update a phase output with optional artifact path metadata';
