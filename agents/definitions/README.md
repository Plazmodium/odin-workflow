# Odin Agent Definitions

This directory contains the prompt definitions for all Odin agents. Each agent is a specialized prompt that handles a specific phase of the 11-phase SDD workflow.

## Agent Overview

| Agent | Phase | File | Description |
|-------|-------|------|-------------|
| Planning | 0 | `planning.md` | Epic decomposition into features (L3 only) |
| **Product** | 1 | `product.md` | PRD generation with complexity-gated templates |
| Discovery | 2 | `discovery.md` | Requirements gathering via stakeholder interviews |
| Architect | 3 | `architect.md` | Technical specification drafting |
| Guardian | 4 | `guardian.md` | Multi-perspective review of PRD + spec |
| Builder | 5 | `builder.md` | Code implementation (emits claims, watched) |
| **Reviewer** | 6 | `reviewer.md` | SAST/security scanning via Semgrep |
| Integrator | 7 | `integrator.md` | Build verification and integration (emits claims, watched) |
| Documenter | 8 | `documenter.md` | Documentation updates |
| Release | 9 | `release.md` | PR creation and archival (emits claims, watched) |

### Support Agents

| Agent | File | Description |
|-------|------|-------------|
| **Watcher** | `watcher.md` | LLM escalation for claim verification |
| Shared Context | `_shared-context.md` | Common context injected into all agents |

### Development Agents (Not Part of Workflow)

| Agent | File | Description |
|-------|------|-------------|
| Consultant | `spec-driven-dev-consultant.md` | For analyzing/improving Odin itself |
| MCP Test | `mcp-test.md` | For testing MCP server functionality |

## Workflow Diagram

```
                              ┌─────────────────────────────────────────────────────┐
                              │                  11-PHASE WORKFLOW                  │
                              └─────────────────────────────────────────────────────┘

   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ PLANNING │───▶│ PRODUCT  │───▶│ DISCOVERY│───▶│ ARCHITECT│───▶│ GUARDIAN │
   │  (0)     │    │  (1) NEW │    │   (2)    │    │   (3)    │    │   (4)    │
   │ L3 only  │    │   PRD    │    │   Reqs   │    │   Spec   │    │  Review  │
   └──────────┘    └──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                                        │
        ┌───────────────────────────────────────────────────────────────┘
        │
        ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ BUILDER  │───▶│ REVIEWER │───▶│INTEGRATOR│───▶│DOCUMENTER│───▶│ RELEASE  │
   │  (5)     │    │  (6) NEW │    │   (7)    │    │   (8)    │    │   (9)    │
   │ WATCHED  │    │   SAST   │    │ WATCHED  │    │   Docs   │    │ WATCHED  │
   └──────────┘    └──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                                        │
                                                                        ▼
                                                                   ┌──────────┐
                                                                   │ COMPLETE │
                                                                   │   (10)   │
                                                                   └──────────┘
```

## Added Agents

### Product Agent (Phase 1)

The Product agent generates a Product Requirements Document (PRD) **before** the technical spec. This ensures business requirements are captured before diving into technical details.

**Key Features:**
- **Complexity-gated templates:**
  - L1 (Bug Fix): PRD_EXEMPTION — 8-line template
  - L2 (Feature): PRD_LITE — 1-page template
  - L3 (Epic): PRD_FULL — Complete PRD with user journeys, NFRs, rollout plan
- **Max 1 clarification round** — if unresolved, creates blocker
- **No implementation details** — PRD focuses on "what", not "how"

### Reviewer Agent (Phase 6)

The Reviewer agent runs SAST (Static Application Security Testing) using Semgrep after the Builder completes implementation.

**Key Features:**
- **Default scan:** `semgrep scan --config=auto`
- **Severity-based gating:** HIGH/CRITICAL must be resolved or deferred with justification
- **Findings recorded** to `security_findings` table
- **Output format:** Summary table with blocking/deferred sections

### Watcher Agent (Support)

The Watcher agent is called via LLM escalation when the Policy Engine cannot make a deterministic decision.

**Key Features:**
- **Only invoked for:**
  - HIGH risk claims
  - Claims with missing evidence
  - Policy Engine inconclusive results
- **Returns:** PASS/FAIL/NEEDS_REVIEW with reasoning and confidence
- **Not a phase agent** — runs as a sub-agent when needed

## Watched Agents

Three agents emit structured **claims** that are verified by the Hybrid Watcher Architecture:

| Agent | Claims Emitted |
|-------|---------------|
| Builder | CODE_ADDED, CODE_MODIFIED, TEST_PASSED, BUILD_SUCCEEDED |
| Integrator | INTEGRATION_VERIFIED |
| Release | PR_CREATED, ARCHIVE_CREATED |

### Verification Flow

```
Agent emits claim
       │
       ▼
┌─────────────────┐
│  agent_claims   │ ─────────────────────────────────┐
│    (Supabase)   │                                  │
└────────┬────────┘                                  │
         │                                           │
         ▼                                           ▼
┌─────────────────┐                        ┌─────────────────┐
│  Policy Engine  │   NEEDS_REVIEW ──────▶ │   LLM Watcher   │
│ (SQL Functions) │                        │   (Sub-Agent)   │
└────────┬────────┘                        └────────┬────────┘
         │                                          │
         │ PASS/FAIL                                │ PASS/FAIL
         │                                          │
         ▼                                          ▼
┌─────────────────┐                        ┌─────────────────┐
│ policy_verdicts │                        │ watcher_reviews │
│    (Supabase)   │                        │    (Supabase)   │
└─────────────────┘                        └─────────────────┘
```

## Shared Context

All agents receive the `_shared-context.md` file which includes:
- 11-phase workflow table
- Critical workflow rules (spec-first, never skip phases, agents never merge)
- Watcher verification protocol
- Skills injection block
- Recovery mechanisms

## Usage

Agents are invoked via the Task tool in the main orchestrator session:

```typescript
// Example: Invoke the Product agent
Task({
  subagent_type: "product",
  prompt: "Generate PRD for FEAT-001: User authentication flow",
  description: "Generate PRD"
});
```

The orchestrator is responsible for:
1. Reading agent definitions before each phase
2. Injecting relevant skills
3. Executing MCP calls (agents can't access MCP directly)
4. Submitting claims and running policy checks
5. Recording phase transitions

## Version History

- **2026-03-06**: Added Product, Reviewer, Watcher agents; 11-phase workflow; claim verification
- **v1.4** (2026-02-17): Added step-level enforcement checklists
- **v1.3** (2026-02-09): Added git branch tracking
- **v1.0** (2026-02-04): Initial 8-agent system
