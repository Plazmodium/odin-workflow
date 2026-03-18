-- ============================================================================
-- Odin v2 Schema Extensions
-- Version: 2.0.0
-- Created: 2026-03-05
-- Description: Extends Odin schema for v2 features:
--   - 11-phase workflow (adds Product and Reviewer phases)
--   - Agent claims and watcher verification
--   - Security findings from SAST tools (Semgrep)
--
-- Dependencies: Requires 001_schema.sql to be run first
--
-- IMPORTANT: DO NOT RUN ON SUPABASE UNTIL READY FOR DEPLOYMENT
-- ============================================================================

-- ============================================================================
-- PHASE ENUM EXTENSION
-- ============================================================================

-- Add new phase values for 11-phase workflow
-- Current: 0=Planning, 1=Discovery, 2=Architect, 3=Guardian, 4=Builder, 
--          5=Integrator, 6=Documenter, 7=Release, 8=Complete
-- 
-- New: 0=Planning, 1=Product, 2=Discovery, 3=Architect, 4=Guardian, 
--      5=Builder, 6=Reviewer, 7=Integrator, 8=Documenter, 9=Release, 10=Complete
--
-- NOTE: PostgreSQL enums cannot be reordered. We add '9' and '10' at the end.
-- The phase numbers retain their VALUES but the MEANINGS change:
--   - Old phase 1 (Discovery) -> New phase 2
--   - Old phase 5 (Integrator) -> New phase 7
--   - etc.
--
-- MIGRATION STRATEGY: Existing features will need phase value remapping.
-- The follow-up migration 007_odin_v2_phase_alignment.sql handles this.

ALTER TYPE phase ADD VALUE IF NOT EXISTS '9';
ALTER TYPE phase ADD VALUE IF NOT EXISTS '10';

-- Update phase comment to reflect new meanings
COMMENT ON TYPE phase IS 'Workflow phases (v2): 0=Planning, 1=Product, 2=Discovery, 3=Architect, 4=Guardian, 5=Builder, 6=Reviewer, 7=Integrator, 8=Documenter, 9=Release, 10=Complete';

-- ============================================================================
-- NEW ENUMS
-- ============================================================================

-- Claim types emitted by agents
CREATE TYPE claim_type AS ENUM (
  'CODE_ADDED',
  'CODE_MODIFIED',
  'CODE_DELETED',
  'TEST_ADDED',
  'TEST_PASSED',
  'TEST_FAILED',
  'BUILD_SUCCEEDED',
  'BUILD_FAILED',
  'SECURITY_CHECKED',
  'SECURITY_FINDING_RESOLVED',
  'INTEGRATION_VERIFIED',
  'ARCHIVE_CREATED',
  'PR_CREATED'
);
COMMENT ON TYPE claim_type IS 'Types of claims agents can make about their work';

-- Verification status for policy engine and watcher verdicts
CREATE TYPE verification_status AS ENUM (
  'PENDING',
  'PASS',
  'FAIL',
  'NEEDS_REVIEW'
);
COMMENT ON TYPE verification_status IS 'Status of claim verification: PENDING (not yet checked), PASS (verified), FAIL (verification failed), NEEDS_REVIEW (escalate to LLM watcher)';

-- Security finding severity levels
CREATE TYPE finding_severity AS ENUM (
  'INFO',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);
COMMENT ON TYPE finding_severity IS 'Severity levels for security findings from SAST tools';

-- ============================================================================
-- NEW TABLES: WATCHER SYSTEM
-- ============================================================================

-- Agent claims: structured assertions about work performed
CREATE TABLE agent_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  phase phase NOT NULL,
  agent_name TEXT NOT NULL,
  invocation_id UUID REFERENCES agent_invocations(id) ON DELETE SET NULL,
  claim_type claim_type NOT NULL,
  claim_description TEXT NOT NULL,
  evidence_refs JSONB DEFAULT '{}'::jsonb,
  risk_level TEXT NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE agent_claims IS 'Structured claims emitted by agents (Builder, Integrator, Release) for verification by Policy Engine and Watchers';
COMMENT ON COLUMN agent_claims.evidence_refs IS 'JSON object with evidence references: {commit_sha, file_paths, test_output_hash, etc.}';
COMMENT ON COLUMN agent_claims.risk_level IS 'Risk level determines escalation: HIGH always goes to LLM watcher';

CREATE INDEX idx_agent_claims_feature ON agent_claims(feature_id);
CREATE INDEX idx_agent_claims_phase ON agent_claims(phase);
CREATE INDEX idx_agent_claims_created ON agent_claims(created_at DESC);
CREATE INDEX idx_agent_claims_risk ON agent_claims(risk_level) WHERE risk_level = 'HIGH';

-- Policy verdicts: deterministic verification results
CREATE TABLE policy_verdicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES agent_claims(id) ON DELETE CASCADE,
  verdict verification_status NOT NULL,
  rule_name TEXT NOT NULL,
  reason TEXT,
  evidence_checked JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE policy_verdicts IS 'Results from deterministic Policy Engine checks on agent claims';
COMMENT ON COLUMN policy_verdicts.rule_name IS 'Name of the policy rule that was applied';
COMMENT ON COLUMN policy_verdicts.evidence_checked IS 'Evidence that was examined during verification';

CREATE INDEX idx_policy_verdicts_claim ON policy_verdicts(claim_id);
CREATE INDEX idx_policy_verdicts_verdict ON policy_verdicts(verdict);
CREATE INDEX idx_policy_verdicts_needs_review ON policy_verdicts(claim_id) WHERE verdict = 'NEEDS_REVIEW';

-- Watcher reviews: LLM-based escalation results
CREATE TABLE watcher_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES agent_claims(id) ON DELETE CASCADE,
  verdict verification_status NOT NULL,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  reasoning TEXT NOT NULL,
  watcher_agent TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE watcher_reviews IS 'Results from LLM Watcher reviews on escalated claims';
COMMENT ON COLUMN watcher_reviews.confidence IS 'Confidence score from 0.00 to 1.00';
COMMENT ON COLUMN watcher_reviews.reasoning IS 'Explanation of the watcher verdict';
COMMENT ON COLUMN watcher_reviews.watcher_agent IS 'Name of the watcher agent that performed the review';

CREATE INDEX idx_watcher_reviews_claim ON watcher_reviews(claim_id);
CREATE INDEX idx_watcher_reviews_verdict ON watcher_reviews(verdict);
CREATE INDEX idx_watcher_reviews_date ON watcher_reviews(reviewed_at DESC);

-- ============================================================================
-- NEW TABLES: SECURITY FINDINGS
-- ============================================================================

-- Security findings: results from SAST tools (Semgrep, etc.)
CREATE TABLE security_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  phase phase NOT NULL DEFAULT '6',  -- Reviewer phase
  tool TEXT NOT NULL,
  rule_id TEXT,
  severity finding_severity NOT NULL,
  file_path TEXT,
  line_number INTEGER,
  column_number INTEGER,
  end_line INTEGER,
  end_column INTEGER,
  message TEXT NOT NULL,
  snippet TEXT,
  fix_suggestion TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE security_findings IS 'Security findings from SAST tools (Semgrep). HIGH/CRITICAL block progression to Integrator.';
COMMENT ON COLUMN security_findings.tool IS 'SAST tool that generated the finding (e.g., semgrep, bandit)';
COMMENT ON COLUMN security_findings.rule_id IS 'Identifier of the security rule that triggered';
COMMENT ON COLUMN security_findings.snippet IS 'Code snippet showing the vulnerable code';
COMMENT ON COLUMN security_findings.fix_suggestion IS 'Suggested fix from the SAST tool (if available)';

CREATE INDEX idx_security_findings_feature ON security_findings(feature_id);
CREATE INDEX idx_security_findings_severity ON security_findings(severity);
CREATE INDEX idx_security_findings_resolved ON security_findings(resolved);
CREATE INDEX idx_security_findings_blocking ON security_findings(feature_id) 
  WHERE resolved = false AND severity IN ('HIGH', 'CRITICAL');
CREATE INDEX idx_security_findings_tool ON security_findings(tool);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE agent_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on agent_claims"
  ON agent_claims FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE policy_verdicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on policy_verdicts"
  ON policy_verdicts FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE watcher_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on watcher_reviews"
  ON watcher_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE security_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on security_findings"
  ON security_findings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- AUDIT LOG SUPPORT
-- ============================================================================

-- Add claim-related operations to audit log (uses existing audit_log table)
-- These will be logged via functions, not triggers, to maintain control

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
