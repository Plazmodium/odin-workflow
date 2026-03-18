/**
 * TLA+ PreCheck Adapter Contract Tests
 * Version: 0.1.0
 *
 * Uses frozen CLI output fixtures to detect upstream API drift.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { extractLastJson, parseCliOutput } from './tla-precheck.js';
import { TlaPreCheckAdapter } from './tla-precheck.js';
import { handleVerifyDesign } from '../../tools/verify-design.js';

// ================================================================
// Frozen CLI Fixtures
// ================================================================

/** Successful proof — estimate + verification result (two JSON blobs separated by text) */
const FIXTURE_VERIFIED = `{
  "tier": "pr",
  "totalStateCount": "1_296",
  "totalBranching": "12",
  "variables": [
    { "name": "state", "formula": "3 states", "value": "3" }
  ],
  "actions": [
    { "name": "Start", "formula": "1 action", "value": "1" }
  ],
  "withinBudget": true,
  "budgetViolations": []
}

Estimate passed. Running TLC verification...

{
  "generated": {
    "outputDir": "/tmp/tla-precheck/AgentRuns",
    "tlaPath": "/tmp/tla-precheck/AgentRuns/AgentRuns.tla",
    "cfgPath": "/tmp/tla-precheck/AgentRuns/AgentRuns.cfg",
    "actionLabelsPath": "/tmp/tla-precheck/AgentRuns/actionLabels.json"
  },
  "certificatePath": "/tmp/tla-precheck/AgentRuns/.certificate.json",
  "estimate": {
    "tier": "pr",
    "totalStateCount": "1_296",
    "withinBudget": true,
    "budgetViolations": []
  },
  "certificate": {
    "certificateVersion": 2,
    "machine": "AgentRuns",
    "tier": "pr",
    "machineSha256": "abc123def456",
    "checkedAt": "2026-03-18T10:00:00.000Z",
    "proofPassed": true,
    "proofSpecification": "Spec",
    "graphEquivalenceAttempted": true,
    "graphEquivalenceSpecification": "EquivalenceSpec",
    "invariantsChecked": ["NoDoubleActive", "AlwaysTerminates"],
    "propertiesChecked": [],
    "deadlockChecked": true,
    "symmetryUsedInProof": false,
    "equivalent": true,
    "graphHash": "def789abc012",
    "tsStateCount": 42,
    "tlcStateCount": 42,
    "tsEdgeCount": 99,
    "tlcEdgeCount": 99
  }
}`;

/** Proof failure — certificate with proofPassed: false */
const FIXTURE_VIOLATION = `{
  "tier": "pr",
  "totalStateCount": "500",
  "withinBudget": true,
  "budgetViolations": []
}

Estimate passed. Running TLC verification...

{
  "generated": {
    "outputDir": "/tmp/tla-precheck/Billing",
    "tlaPath": "/tmp/tla-precheck/Billing/Billing.tla",
    "cfgPath": "/tmp/tla-precheck/Billing/Billing.cfg",
    "actionLabelsPath": "/tmp/tla-precheck/Billing/actionLabels.json"
  },
  "certificatePath": "/tmp/tla-precheck/Billing/.certificate.json",
  "estimate": {
    "tier": "pr",
    "totalStateCount": "500",
    "withinBudget": true,
    "budgetViolations": []
  },
  "certificate": {
    "certificateVersion": 2,
    "machine": "Billing",
    "tier": "pr",
    "machineSha256": "xyz789",
    "checkedAt": "2026-03-18T10:01:00.000Z",
    "proofPassed": false,
    "proofSpecification": "Spec",
    "graphEquivalenceAttempted": false,
    "invariantsChecked": ["NoDuplicateCharge"],
    "propertiesChecked": [],
    "deadlockChecked": true,
    "symmetryUsedInProof": false,
    "equivalent": null,
    "tlcStateCount": 150,
    "proofOutput": "Error: Invariant NoDuplicateCharge is violated. State 42: user u1 charged twice for order o1."
  }
}`;

/** Budget exceeded — estimate-only, no certificate */
const FIXTURE_BUDGET_EXCEEDED = `{
  "tier": "pr",
  "totalStateCount": "999_999_999_999",
  "totalBranching": "50000",
  "variables": [],
  "actions": [],
  "withinBudget": false,
  "budgetViolations": [
    { "name": "totalStateCount", "message": "exceeds pr budget of 10_000_000" }
  ]
}`;

/** Equivalence failure — proof passed but not equivalent */
const FIXTURE_NOT_EQUIVALENT = `{
  "tier": "pr",
  "totalStateCount": "200",
  "withinBudget": true,
  "budgetViolations": []
}

Estimate passed. Running TLC verification...

{
  "generated": {
    "outputDir": "/tmp/tla-precheck/Workflow",
    "tlaPath": "/tmp/tla-precheck/Workflow/Workflow.tla",
    "cfgPath": "/tmp/tla-precheck/Workflow/Workflow.cfg",
    "actionLabelsPath": "/tmp/tla-precheck/Workflow/actionLabels.json"
  },
  "certificatePath": "/tmp/tla-precheck/Workflow/.certificate.json",
  "estimate": {
    "tier": "pr",
    "totalStateCount": "200",
    "withinBudget": true,
    "budgetViolations": []
  },
  "certificate": {
    "certificateVersion": 2,
    "machine": "Workflow",
    "tier": "pr",
    "machineSha256": "aaa111",
    "checkedAt": "2026-03-18T10:02:00.000Z",
    "proofPassed": true,
    "proofSpecification": "Spec",
    "graphEquivalenceAttempted": true,
    "graphEquivalenceSpecification": "EquivalenceSpec",
    "invariantsChecked": ["AllPhasesReachable"],
    "propertiesChecked": [],
    "deadlockChecked": true,
    "symmetryUsedInProof": false,
    "equivalent": false,
    "graphHash": "bbb222",
    "tsStateCount": 20,
    "tlcStateCount": 22,
    "tsEdgeCount": 30,
    "tlcEdgeCount": 35
  }
}`;

// ================================================================
// extractLastJson
// ================================================================

describe('extractLastJson', () => {
  it('extracts the last JSON block from multi-block output', () => {
    const result = extractLastJson(FIXTURE_VERIFIED);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.certificate).toBeDefined();
    expect(parsed.certificate.machine).toBe('AgentRuns');
  });

  it('extracts single JSON block', () => {
    const result = extractLastJson('{"key": "value"}');
    expect(result).toBe('{"key": "value"}');
  });

  it('returns null for empty input', () => {
    expect(extractLastJson('')).toBeNull();
  });

  it('returns null for non-JSON input', () => {
    expect(extractLastJson('just text\nno json here')).toBeNull();
  });

  it('extracts estimate-only block (budget exceeded)', () => {
    const result = extractLastJson(FIXTURE_BUDGET_EXCEEDED);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.withinBudget).toBe(false);
  });
});

// ================================================================
// parseCliOutput — contract tests with frozen fixtures
// ================================================================

describe('parseCliOutput', () => {
  it('parses VERIFIED result with certificate', () => {
    const result = parseCliOutput(FIXTURE_VERIFIED, 'machines/agent-runs.machine.ts');

    expect(result.machine_name).toBe('AgentRuns');
    expect(result.status).toBe('VERIFIED');
    expect(result.proof_passed).toBe(true);
    expect(result.equivalent).toBe(true);
    expect(result.states_checked).toBe(42);
    expect(result.invariant_violations).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('parses VIOLATION result with proof failure', () => {
    const result = parseCliOutput(FIXTURE_VIOLATION, 'machines/billing.machine.ts');

    expect(result.machine_name).toBe('Billing');
    expect(result.status).toBe('VIOLATION');
    expect(result.proof_passed).toBe(false);
    expect(result.equivalent).toBeNull();
    expect(result.states_checked).toBe(150);
    expect(result.invariant_violations).toHaveLength(1);
    expect(result.invariant_violations[0]?.invariant_name).toBe('proof');
    expect(result.invariant_violations[0]?.counter_example_summary).toContain('NoDuplicateCharge');
  });

  it('parses budget exceeded as VIOLATION', () => {
    const result = parseCliOutput(FIXTURE_BUDGET_EXCEEDED, 'machines/huge.machine.ts');

    expect(result.status).toBe('VIOLATION');
    expect(result.proof_passed).toBe(false);
    expect(result.equivalent).toBeNull();
    expect(result.states_checked).toBe(0);
    expect(result.error).toContain('budget');
    expect(result.invariant_violations).toHaveLength(1);
    expect(result.invariant_violations[0]?.invariant_name).toBe('budget');
  });

  it('parses NOT EQUIVALENT as VIOLATION', () => {
    const result = parseCliOutput(FIXTURE_NOT_EQUIVALENT, 'machines/workflow.machine.ts');

    expect(result.machine_name).toBe('Workflow');
    expect(result.status).toBe('VIOLATION');
    expect(result.proof_passed).toBe(true);
    expect(result.equivalent).toBe(false);
    expect(result.states_checked).toBe(22);
    expect(result.invariant_violations).toHaveLength(0);
  });

  it('uses machine_path as fallback name when certificate has no machine field', () => {
    const fixture = `{
      "certificate": {
        "certificateVersion": 2,
        "proofPassed": true,
        "equivalent": true,
        "tlcStateCount": 10,
        "invariantsChecked": [],
        "propertiesChecked": [],
        "deadlockChecked": true,
        "symmetryUsedInProof": false
      }
    }`;
    const result = parseCliOutput(fixture, 'my/path.machine.ts');
    expect(result.machine_name).toBe('my/path.machine.ts');
    expect(result.status).toBe('VERIFIED');
  });

  it('throws on empty output', () => {
    expect(() => parseCliOutput('', 'test.machine.ts')).toThrow('No JSON object');
  });

  it('throws on output with no certificate and within-budget estimate', () => {
    const fixture = `{
      "tier": "pr",
      "withinBudget": true,
      "budgetViolations": []
    }`;
    expect(() => parseCliOutput(fixture, 'test.machine.ts')).toThrow('No certificate');
  });

  it('truncates long proofOutput to 500 chars', () => {
    const long_output = 'X'.repeat(1000);
    const fixture = `{
      "certificate": {
        "certificateVersion": 2,
        "machine": "LongTrace",
        "proofPassed": false,
        "equivalent": null,
        "tlcStateCount": 5,
        "invariantsChecked": [],
        "propertiesChecked": [],
        "deadlockChecked": true,
        "symmetryUsedInProof": false,
        "proofOutput": "${long_output}"
      }
    }`;
    const result = parseCliOutput(fixture, 'test.machine.ts');
    expect(result.invariant_violations).toHaveLength(1);
    const summary = result.invariant_violations[0]?.counter_example_summary ?? '';
    expect(summary.length).toBeLessThanOrEqual(500);
    expect(summary).toMatch(/\.\.\.$/);
  });
});

// ================================================================
// TlaPreCheckAdapter integration tests
// ================================================================

describe('TlaPreCheckAdapter', () => {
  let tmp_dir: string;

  beforeEach(() => {
    tmp_dir = join(tmpdir(), `odin-tla-test-${randomUUID()}`);
    mkdirSync(tmp_dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp_dir, { recursive: true, force: true });
  });

  it('rejects path traversal', async () => {
    const adapter = new TlaPreCheckAdapter(tmp_dir, 10);
    const result = await adapter.verifyDesign({
      feature_id: 'TEST-001',
      machine_path: '../../etc/passwd',
    });

    expect(result.status).toBe('INTERNAL_ERROR');
    expect(result.error).toContain('Path traversal rejected');
  });

  it('returns INVALID_MODEL for missing machine file', async () => {
    const adapter = new TlaPreCheckAdapter(tmp_dir, 10);
    const result = await adapter.verifyDesign({
      feature_id: 'TEST-001',
      machine_path: 'nonexistent.machine.ts',
    });

    expect(result.status).toBe('INVALID_MODEL');
    expect(result.error).toContain('not found');
  });

  it('isAvailable returns false when no tla-precheck binary exists', async () => {
    const adapter = new TlaPreCheckAdapter(tmp_dir, 10);
    const available = await adapter.isAvailable();
    expect(available).toBe(false);
  });
});

// ================================================================
// handleVerifyDesign tool handler tests
// ================================================================

describe('handleVerifyDesign', () => {
  it('returns NOT_CONFIGURED when adapter is null', async () => {
    const result = await handleVerifyDesign(null, {
      feature_id: 'TEST-001',
      machine_path: 'test.machine.ts',
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.status).toBe('NOT_CONFIGURED');
    expect(result.content[0]?.text).toContain('not configured');
  });

  it('returns UNAVAILABLE when adapter says not available', async () => {
    const mock_adapter = {
      async isAvailable() { return false; },
      async verifyDesign() {
        throw new Error('should not be called');
      },
    };

    const result = await handleVerifyDesign(mock_adapter, {
      feature_id: 'TEST-001',
      machine_path: 'test.machine.ts',
    });

    expect(result.structuredContent?.status).toBe('UNAVAILABLE');
    expect(result.content[0]?.text).toContain('not available');
  });

  it('returns VERIFIED result from adapter', async () => {
    const mock_adapter = {
      async isAvailable() { return true; },
      async verifyDesign() {
        return {
          machine_name: 'TestMachine',
          status: 'VERIFIED' as const,
          proof_passed: true,
          equivalent: true,
          states_checked: 100,
          invariant_violations: [],
          duration_ms: 500,
        };
      },
    };

    const result = await handleVerifyDesign(mock_adapter, {
      feature_id: 'TEST-001',
      machine_path: 'test.machine.ts',
    });

    expect(result.structuredContent?.status).toBe('VERIFIED');
    expect(result.content[0]?.text).toContain('PASSED');
    expect(result.content[0]?.text).toContain('TestMachine');
  });

  it('returns VIOLATION result from adapter', async () => {
    const mock_adapter = {
      async isAvailable() { return true; },
      async verifyDesign() {
        return {
          machine_name: 'BrokenMachine',
          status: 'VIOLATION' as const,
          proof_passed: false,
          equivalent: null,
          states_checked: 50,
          invariant_violations: [{
            invariant_name: 'NoDeadlock',
            description: 'Deadlock found',
          }],
          duration_ms: 200,
        };
      },
    };

    const result = await handleVerifyDesign(mock_adapter, {
      feature_id: 'TEST-001',
      machine_path: 'test.machine.ts',
    });

    expect(result.structuredContent?.status).toBe('VIOLATION');
    expect(result.content[0]?.text).toContain('FAILED');
    expect(result.content[0]?.text).toContain('1 violation');
  });
});
