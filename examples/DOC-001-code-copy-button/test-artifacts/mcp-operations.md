# MCP Operations Required for DOC-001-code-copy-button

**Feature ID**: DOC-001-code-copy-button
**Agent**: Architect
**Phase**: PHASE_1 (Specification)
**Date**: 2026-01-10

This document records the MCP tool calls that should be executed for this feature.

---

## Operation 1: Create Feature (sdd_state_create_feature)

**Tool**: `sdd_state_create_feature`
**Purpose**: Register the feature in the SDD workflow state database

**Arguments**:
```json
{
  "id": "DOC-001-code-copy-button",
  "name": "Code Copy Button for Documentation",
  "complexity_level": 1,
  "severity": "ROUTINE",
  "requirements_path": "features/DOC-001-code-copy-button/requirements.md"
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "feature_id": "DOC-001-code-copy-button",
    "token_budget": {
      "total": 22000,
      "soft_limit": 17600,
      "hard_limit": 22000
    }
  },
  "message": "Feature DOC-001-code-copy-button created successfully"
}
```

---

## Operation 2: Track Tokens (sdd_state_track_tokens)

**Tool**: `sdd_state_track_tokens`
**Purpose**: Record token usage for PHASE_1 specification drafting

**Arguments**:
```json
{
  "feature_id": "DOC-001-code-copy-button",
  "phase": 1,
  "agent_name": "Architect",
  "input_tokens": 4500,
  "output_tokens": 3800,
  "operation_description": "Draft initial specification with complexity assessment for code copy button feature"
}
```

**Token Budget for Level 1, PHASE_1**: 4,000 tokens
**Actual Usage**: ~8,300 tokens (includes reading requirements + writing spec)
**Note**: This exceeds the PHASE_1 budget but is within total Architect budget (9,000 for Level 1)

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "feature_id": "DOC-001-code-copy-button",
    "tokens_added": 8300,
    "tokens_used": 8300,
    "token_budget": 22000,
    "usage_percent": 37.7,
    "estimated_cost_usd": "0.1245",
    "budget_status": "OK"
  }
}
```

---

## Operation 3: Transition Phase (sdd_state_transition_phase)

**Tool**: `sdd_state_transition_phase`
**Purpose**: Move feature from PHASE_1 (Specification) to PHASE_2 (Iteration/Guardian Review)

**Arguments**:
```json
{
  "feature_id": "DOC-001-code-copy-button",
  "to_phase": 2,
  "agent_name": "Architect",
  "notes": "Spec draft v1 complete. Self-score: 1.92/2.0. Level 1 complexity (weighted score 2.75). Ready for Guardian review."
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "feature_id": "DOC-001-code-copy-button",
    "from_phase": 1,
    "to_phase": 2
  },
  "message": "Transitioned from phase 1 to 2"
}
```

---

## Verification Checklist

- [ ] Feature created in state database
- [ ] Token usage recorded for PHASE_1
- [ ] Phase transitioned to PHASE_2
- [ ] status.json file created in specs directory
- [ ] Audit log entries created for all operations

---

## Files Created by Architect

1. `specs/DOC-001-code-copy-button/spec-draft-v1.md` - Full specification document
2. `specs/DOC-001-code-copy-button/mcp-operations.md` - This file (MCP operation record)

---

## Next Steps (After MCP Operations Complete)

1. Guardian Agent receives notification of PHASE_2 transition
2. Guardian reviews `spec-draft-v1.md`
3. Guardian validates against codebase (if applicable)
4. Guardian approves or requests revisions
5. Upon approval, Architect returns for PHASE_3 (Task Breakdown)
