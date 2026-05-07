# Odin Agent Definitions

This directory contains the prompt definitions for all Odin agents. Each agent is a specialized prompt that handles a specific phase of the 11-phase SDD workflow.

This is internal workflow reference material. You do not need to read this README to install Odin or start your first feature.

## Agent Overview (v2)

| Agent | Phase | File | Description |
|-------|-------|------|-------------|
| Planning | 0 | `planning.md` | Epic decomposition into features (L3 only) |
| **Product** | 1 | `product.md` | User value, success criteria, non-goals, and failure shape |
| Discovery | 2 | `discovery.md` | Technical requirements, constraints, context, unknowns, and scenarios |
| Architect | 3 | `architect.md` | Technical specification drafting + opt-in formal design verification |
| Guardian | 4 | `guardian.md` | Multi-perspective review of PRD + spec + proof results |
| Builder | 5 | `builder.md` | Code implementation (emits claims, watched) |
| **Reviewer** | 6 | `reviewer.md` | Review checks: Semgrep for code, `docs_process` for docs/process-only changes |
| Integrator | 7 | `integrator.md` | Build verification and integration (emits claims, watched) |
| Documenter | 8 | `documenter.md` | Documentation updates |
| Release | 9 | `release.md` | PR creation and archival (emits claims, watched) |

### Support Agents

| Agent | File | Description |
|-------|------|-------------|
| **Watcher** | `watcher.md` | LLM escalation for claim verification (NEW in v2) |
| Shared Context | `_shared-context.md` | Common context injected into all agents |

### Development Agents (Not Part of Workflow)

| Agent | File | Description |
|-------|------|-------------|
| Consultant | `spec-driven-dev-consultant.md` | For analyzing/improving Odin itself |
| MCP Test | `mcp-test.md` | For testing MCP server functionality |

## Workflow Diagram (v2)

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
    │ WATCHED  │    │  Review  │    │ WATCHED  │    │   Docs   │    │ WATCHED  │
   └──────────┘    └──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                                        │
                                                                        ▼
                                                                   ┌──────────┐
                                                                   │ COMPLETE │
                                                                   │   (10)   │
                                                                   └──────────┘
```

## New Agents in v2

### Product Agent (Phase 1)

The Product agent generates a Product Requirements Document (PRD) **before** technical discovery and specification. It owns user value, target users, success criteria, non-goals, and user-visible failure shape.

**Key Features:**
- **Complexity-gated templates:**
  - L1 (Bug Fix): PRD_EXEMPTION — 8-line template
  - L2 (Feature): PRD_LITE — 1-page template
  - L3 (Epic): PRD_FULL — Complete PRD with user journeys, NFRs, rollout plan
- **Max 1 clarification round** — if unresolved, creates blocker
- **No implementation details** — PRD focuses on "why", "who", success boundaries, and failure shape
- **Discovery handoff** — technical constraints, existing-system context, and unknowns are deferred to Phase 2

### Discovery Agent (Phase 2)

The Discovery agent converts Product intent into technical requirements, constraints, existing-system context, unknowns, and eval-relevant should/should-not scenarios. It does not choose the architecture or create the task breakdown; those are Architect responsibilities.

### Reviewer Agent (Phase 6)

The Reviewer agent runs review checks after Builder completes implementation. Code changes use Semgrep; documentation/process-only changes use the lightweight `docs_process` review profile through `odin.run_review_checks`.

**Key Features:**
- **Default code scan:** `semgrep scan --config=auto`
- **Docs/process profile:** `odin.run_review_checks({ tool: "docs_process", ... })`
- **Severity-based gating:** HIGH/CRITICAL must be resolved or deferred with justification
- **Findings recorded** to `security_findings` table
- **Output format:** Summary table with blocking/deferred sections

### Watcher Agent (Support)

The Watcher agent is called via LLM escalation when the Policy Engine cannot make a deterministic decision.

**Key Features:**
- **Only invoked for:**
  - HIGH risk claims
  - Claims with missing evidence in advisory mode; strict mode can reject evidence-free watched claims before Watcher escalation
  - Policy Engine inconclusive results
- **Returns:** PASS/FAIL with reasoning and confidence; the Policy Engine may emit NEEDS_REVIEW before Watcher escalation
- **Not a phase agent** — runs as a sub-agent when needed

## Watched Agents (v2)

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
- Strict phase-agent proof and skills-applied recording guidance
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
3. Executing MCP calls directly, or proxying calls for child agents without MCP access
4. Recording phase-agent launch/execution/realization proof when strict mode requires it
5. Submitting claims, running policy checks, and recording skills actually applied
6. Recording phase transitions

## Version History

- **v2.1** (2026-03-18): Added TLA+ formal design verification (Architect Step A3a + Guardian proof review); fixed all agent phase headers to v2 numbering
- **v2.0** (2026-03-06): Added Product, Reviewer, Watcher agents; 11-phase workflow; claim verification
- **v1.4** (2026-02-17): Added step-level enforcement checklists
- **v1.3** (2026-02-09): Added git branch tracking
- **v1.0** (2026-02-04): Initial 8-agent system
