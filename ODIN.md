# ODIN.md

> **Odin** is a Specification-Driven Development (SDD) framework for AI-assisted development.
> It provides 12 specialized agents, adaptive complexity levels, a learnings system with
> confidence scoring, EVALS for health monitoring, and Watcher verification for critical phases.

---

## For Users of Odin

> **⚠️ WARNING: Do not modify ODIN.md unless you are developing Odin itself.**
>
> This file describes how the Odin workflow works. Modifying it can break agent behavior,
> phase transitions, and quality gates. If you need to customize Odin, use the configuration
> options in your project setup instead.

### Where Learnings Go

When using Odin in your project, learnings propagate to different targets:

| Learning Type | Target Location |
|---------------|-----------------|
| **Technology gotchas** (Next.js, Supabase, etc.) | `agents/skills/{category}/{skill}/SKILL.md` |
| **Project-specific patterns** | Your AI provider's file: `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, etc. |
| **Workflow improvements** | `agents/definitions/{agent}.md` (for Odin developers only) |

**Your AI provider's file** is where project-specific learnings accumulate:
- **OpenCode**: `AGENTS.md`
- **Claude Code**: `CLAUDE.md` 
- **Cursor**: `.cursorrules` or `.cursor/rules`
- **Windsurf**: `.windsurfrules`
- **Other tools**: Check your tool's documentation for the custom instructions file

**ODIN.md is NOT a target for learnings.** It defines the framework mechanics and should remain stable.

---

## What is Odin?

### The Problem

When developers use AI coding assistants without proper specifications:
- AI hallucinates business logic and data structures
- Code contradicts requirements within the same session
- Developers spend more time fixing AI mistakes than coding
- No single source of truth exists between spec and implementation

**Odin fixes that** by establishing clear phases, quality gates, and recovery mechanisms.

### Core Philosophy

1. **Spec-First, Always**: Implementation code is never written without an approved specification. The spec is the contract.

2. **Context Pulling > Context Pushing**: AI agents autonomously fetch what they need (via MCP) instead of developers manually copy-pasting files, schemas, and tickets.

3. **Adaptive Complexity**: Not every task needs a 10-page specification. Match the spec depth to the task complexity.

### Key Innovations

- **Adaptive complexity** (L1/L2/L3) - specs scale to match task size
- **Learnings system** with confidence scoring and multi-target propagation
- **EVALS** for health monitoring and performance diagnostics
- **11-phase workflow** with 12 specialized agents
- **Watcher verification** - Policy Engine + LLM escalation for critical phases
- **Skills system** with 36+ domain-specific knowledge modules

---

## The 11-Phase Workflow

| Phase | Name | Agent | Watched? | Description |
|-------|------|-------|----------|-------------|
| 0 | Planning | Planner | No | Epic decomposition (L3 only) |
| 1 | Product | Product | No | PRD generation (complexity-gated) |
| 2 | Discovery | Discovery | No | Requirements gathering |
| 3 | Architect | Architect | No | Specification drafting |
| 4 | Guardian | Guardian | No | PRD + Spec review |
| 5 | Builder | Builder | **YES** | Implementation |
| 6 | Reviewer | Reviewer | No | SAST/security scan (Semgrep) |
| 7 | Integrator | Integrator | **YES** | Build verification |
| 8 | Documenter | Documenter | No | Documentation generation |
| 9 | Release | Release | **YES** | PR creation and archival |
| 10 | Complete | - | No | Feature done |

```
All features: PLANNING -> PRODUCT -> DISCOVERY -> ARCHITECT -> GUARDIAN -> BUILDER -> REVIEWER -> INTEGRATOR -> DOCUMENTER -> RELEASE -> COMPLETE
```

> **Note**: L1/L2 features still execute all phases — they're just brief.
> Complexity level affects **depth** within each phase, not which phases run.

> **Watched agents** (Builder, Integrator, Release) emit structured claims that are verified by the Policy Engine and optionally the LLM Watcher. See [Watcher Verification](#watcher-verification).

> **Detailed Documentation**: See [multi-agent-protocol.md](docs/framework/multi-agent-protocol.md)

### Orchestrator Loop

This is the canonical step-by-step workflow the orchestrator follows for every feature:

```
1. git checkout -b {initials}/feature/{ID}         # Create branch FIRST
2. odin.start_feature({ id, name, ... })           # Record in database
3. For each phase 0→9:
   a. odin.get_next_phase({ feature_id })           # Confirm next phase
   b. odin.prepare_phase_context({ feature_id, phase, agent_name })
                                                     # Get agent bundle
   c. Read agent definition from agents/definitions/ # Load mandatory checklist
   d. Invoke agent (Task tool or inline)             # Agent produces output
   e. odin.record_phase_artifact({ ... })            # Persist artifacts
   f. Phase-specific actions:
      - Phase 4 (Guardian): verify spec quality rubric scores 2/2
      - Phase 5 (Builder): update task statuses after each task
      - Phase 6 (Reviewer): odin.run_review_checks({ ... })
      - Phase 9 (Release): odin.verify_claims({ ... }), check coverage,
                            odin.archive_feature_release({ ... }),
                            gh pr create
   g. odin.record_phase_result({ ..., outcome: "completed" })
                                                     # Advance to next phase
4. STOP after PR creation — wait for human to merge
```

> **Remember**: Only the main orchestrator session can call `odin.*` tools. Task-spawned sub-agents cannot access MCP — they produce output that the orchestrator persists.

### Task Tracking Protocol

The Architect (Phase 3) records a task breakdown. The orchestrator updates task statuses during the Builder phase (Phase 5). This drives the dashboard's task progress display.

**Architect phase** — orchestrator records initial tasks:
```
odin.record_phase_artifact({
  feature_id: "FEAT-001",
  phase: "3",
  output_type: "tasks",
  content: [
    { id: "T1", title: "Create component", status: "pending" },
    { id: "T2", title: "Add tests", status: "pending" }
  ],
  created_by: "architect-agent"
})
```

**Builder phase** — orchestrator updates task statuses after each task completes:
```
odin.record_phase_artifact({
  feature_id: "FEAT-001",
  phase: "3",
  output_type: "tasks",
  content: [
    { id: "T1", title: "Create component", status: "completed" },
    { id: "T2", title: "Add tests", status: "in-progress" }
  ],
  created_by: "builder-agent"
})
```

> **Note**: Task artifacts always target **phase "3"** (where they were defined), even when updated during phase 5. This is an upsert — same feature/phase/output_type replaces the previous record.

**Rules**:
- Every task object MUST include `id`, `title`, and `status` fields
- Valid statuses: `pending`, `in-progress`, `completed` (also accepts `done`)
- The orchestrator MUST call this after each task completion, not just at the end of the Builder phase

---

## Adaptive Complexity

### Level 1: "The Nut" (Bug Fixes)
- **Sections**: Context & Goals + Acceptance Criteria only
- **Use When**: Single-file changes, obvious fixes
- **Time**: 5-10 minutes

### Level 2: "The Feature" (Standard Features)
- **Sections**: Context + Behavioral + Acceptance + Technical
- **Use When**: New features, API endpoints, UI components
- **Time**: 20-30 minutes

### Level 3: "The Epic" (Architectural Changes)
- **Sections**: All sections including System Context, Data Models
- **Use When**: Multi-file refactors, new subsystems
- **Time**: 1-2 hours

### Complexity Scoring

The Architect assesses complexity using 3 dimensions (1-5 each):

- **Scope**: How many files/systems affected?
- **Risk**: What can go wrong?
- **Integration**: How many touchpoints?

| Total Score | Level |
|-------------|-------|
| 3-6 | L1 |
| 7-11 | L2 |
| 12-15 | L3 |

> **Detailed Template**: See [SDD-framework.md](docs/framework/SDD-framework.md)

---

## Spec Quality Rubric

Before implementation, score your spec:

| Criterion | Blocker (0) | Risky (1) | AI-Ready (2) |
|-----------|-------------|-----------|--------------|
| **Ambiguity** | Subjective terms ("fast", "nice") | General terms | Concrete binary ("< 200ms") |
| **Testability** | Prose paragraphs | Bullet points | Given/When/Then format |
| **Context** | No files mentioned | Folder names | Specific file paths |
| **Edge Cases** | Happy path only | Mentions errors | Defines error states |
| **Data Shape** | "Return user object" | "Return name, email" | TypeScript schema |

**Rule**: All criteria must score 2 before Builder phase.

---

## The 12 Agents

| Agent | Phases | Watched? | Role |
|-------|--------|----------|------|
| [Planner](agents/definitions/planning.md) | 0 | No | Epic decomposition for L3 features |
| [Product](agents/definitions/product.md) | 1 | No | PRD generation (complexity-gated) |
| [Discovery](agents/definitions/discovery.md) | 2 | No | Requirements gathering from vague inputs |
| [Architect](agents/definitions/architect.md) | 3 | No | Specification drafting and task breakdown |
| [Guardian](agents/definitions/guardian.md) | 4 | No | PRD + Spec review with 3 perspectives |
| [Builder](agents/definitions/builder.md) | 5 | **YES** | Code implementation per spec |
| [Reviewer](agents/definitions/reviewer.md) | 6 | No | SAST/security scan (Semgrep) |
| [Integrator](agents/definitions/integrator.md) | 7 | **YES** | Build and runtime verification |
| [Documenter](agents/definitions/documenter.md) | 8 | No | Documentation generation |
| [Release](agents/definitions/release.md) | 9 | **YES** | PR creation and feature archival |
| [Watcher](agents/definitions/watcher.md) | Any | - | LLM escalation for claim verification |
| [Consultant](agents/definitions/spec-driven-dev-consultant.md) | Any | No | Spec refinement and analysis |

All agents inherit shared context from [_shared-context.md](agents/definitions/_shared-context.md).

**Watched agents** emit structured claims. The Policy Engine verifies claims deterministically; the Watcher handles semantic verification when escalated.

---

## Skills System

Skills are domain-specific knowledge modules loaded into agents based on tech stack.

### Categories

- **Frontend**: nextjs-dev, react-patterns, tailwindcss, angular-dev, vuejs-dev, svelte-dev, astro-dev, htmx-dev, alpine-dev
- **Backend**: nodejs-express, nodejs-fastify, python-fastapi, python-django, golang-gin
- **Database**: supabase, postgresql, prisma-orm, mongodb, redis
- **Testing**: jest, vitest, playwright, cypress
- **DevOps**: docker, kubernetes, terraform, github-actions, aws
- **API**: rest-api, graphql, trpc, grpc
- **Architecture**: clean-architecture, domain-driven-design, event-driven, microservices

### How Skills Work

1. Orchestrator detects tech stack from `package.json`, `pyproject.toml`, etc.
2. Matching skills are injected into agent prompts
3. Agents apply skill-specific patterns and best practices
4. If no match, the `generic-dev` fallback skill is used

> **Full Documentation**: See [SKILLS-SYSTEM.md](docs/reference/SKILLS-SYSTEM.md)

---

## Learnings System

Odin captures insights during development and propagates them to preserve knowledge.

### Confidence Scoring

- Range: 0.00 to 1.00
- Increases with validation (+0.15) and references (+0.10)
- Propagation threshold: >= 0.80

### Evolution Chains

Learnings evolve as understanding deepens:
- L_1 (initial) -> L_2 (refined) -> L_3 (validated)
- Each evolution links to predecessor via `predecessor_id`

### Multi-Target Propagation

High-confidence learnings propagate to:
- **AGENTS.md** (project-specific, not shipped with Odin)
- **Skills** (technology patterns)
- **Agent definitions** (workflow improvements)

Relevance threshold for propagation: >= 0.60

> **Full Documentation**: See [HYBRID-ORCHESTRATION-PATTERN.md](docs/reference/HYBRID-ORCHESTRATION-PATTERN.md)

---

## EVALS System

EVALS monitors feature and system health.

### Feature Health

Computed on feature completion:
- **Efficiency**: Duration vs complexity expectations
- **Quality**: Gate approval rate, blocker count, iteration count

### System Health

Computed over time windows (7/30/90 days):
- Aggregates feature health scores
- Tracks trends and generates alerts

### Health Thresholds

| Status | Score |
|--------|-------|
| HEALTHY | >= 70 |
| CONCERNING | 50-69 |
| CRITICAL | < 50 |

---

## Watcher Verification

Builder, Integrator, and Release are **watched agents**. They emit structured claims that are verified to ensure workflow integrity.

### Architecture (Hybrid Verification)

```
Builder/Integrator/Release emit claims
         ↓
   Odin Runtime (agent_claims table)
         ↓
   Policy Engine (deterministic)
         ↓
   ┌─────┴─────┐
   ↓           ↓
  PASS    NEEDS_REVIEW
              ↓
        LLM Watcher (semantic)
```

Claims are submitted automatically by the runtime when agents record phase results. The orchestrator verifies claims using:

```
odin.verify_claims({ feature_id: "FEAT-001" })
```

### Claim Types

| Claim Type | Agent | Description |
|------------|-------|-------------|
| `CODE_ADDED` | Builder | New file created |
| `CODE_MODIFIED` | Builder | Existing file changed |
| `CODE_DELETED` | Builder | File removed |
| `TEST_PASSED` | Builder | Tests pass |
| `BUILD_SUCCEEDED` | Builder | Build completes |
| `INTEGRATION_VERIFIED` | Integrator | Merge + tests + runtime verified |
| `PR_CREATED` | Release | Pull request created |
| `ARCHIVE_CREATED` | Release | Feature archived |

### Risk Levels

| Level | When to Use | Watcher Escalation? |
|-------|-------------|---------------------|
| **LOW** | Tests, docs, styling | Only if evidence missing |
| **MEDIUM** | Business logic, APIs | Only if evidence missing |
| **HIGH** | Auth, payments, security, PII | **ALWAYS** |

### Escalation Triggers

The LLM Watcher is called when ANY of these are true:
1. Claim marked `HIGH` risk
2. Evidence refs missing or empty
3. Policy Engine check inconclusive

### Watcher Verdicts

| Verdict | Meaning | Action |
|---------|---------|--------|
| `PASS` | Evidence supports claim | Continue workflow |
| `FAIL` | Evidence contradicts claim | Create blocker |
| `NEEDS_REVIEW` | Still inconclusive | Escalate to human |

The Watcher is **advisory** — it informs but does not auto-block. The orchestrator decides how to act on verdicts.

---

## Reviewer (SAST/Security)

The Reviewer agent (Phase 6) performs static application security testing using Semgrep.

### How It Works

The orchestrator calls:
```
odin.run_review_checks({
  feature_id: "FEAT-001",
  initiated_by: "reviewer-agent",
  changed_files: ["src/auth.ts", "src/api/users.ts"]
})
```

The runtime handles everything: runs Semgrep, records findings, and reports results. The orchestrator does NOT need to run Semgrep directly or record findings manually.

### Severity Levels

| Severity | Action Required |
|----------|-----------------|
| CRITICAL | **MUST FIX** - Blocks release |
| HIGH | **MUST FIX** - Blocks release |
| MEDIUM | Can defer with justification |
| LOW | Can defer with justification |
| INFO | Optional |

---

## Product Agent (PRD Generation)

The Product agent (Phase 1) generates PRDs before technical specification.

### Complexity-Gated Output

| Complexity | PRD Type | Max Length |
|------------|----------|------------|
| L1 | PRD_EXEMPTION | 8 lines |
| L2 | PRD_LITE | 1 page |
| L3 | PRD_FULL | Complete |

### PRD_EXEMPTION (L1)

```markdown
## PRD Exemption

**Problem**: [One sentence]
**Impact**: [Who is affected]
**Acceptance Check**: [How to verify]
**Rollback Note**: [How to revert]
```

### Key Rules

- Max 1 clarification round with user
- No technical implementation details (that's Architect's job)
- If still ambiguous after 1 round → blocker `HUMAN_DECISION_REQUIRED`

---

## Git Branch Management

Odin tracks git branches per feature.

### Branch Naming

Format: `{dev_initials}/feature/{FEATURE-ID}`  
Example: `jd/feature/AUTH-001`

### Developer Identity

The `dev_initials` and `author` parameters in `odin.start_feature` identify the human developer. The orchestrator must **never guess** these values. To obtain them:

1. **Check git config**: `git config user.name` for author, derive initials from the name
2. **Ask the developer** if git config is not available

### Workflow

1. **Orchestrator creates the git branch FIRST**: `git checkout -b {dev_initials}/feature/{FEATURE-ID}` — this must succeed before anything is recorded in the database
2. **Only after the branch exists**, call `odin.start_feature` to record the feature
3. Transition to Phase 1 (Product) — all work happens on the feature branch
4. Each phase: `odin.prepare_phase_context` → agent work → `odin.record_phase_artifact` → `odin.record_phase_result`
5. Release phase creates PR via `gh pr create`
6. Human reviews and merges (NEVER the agent)

> **CRITICAL**: Create the git branch BEFORE calling `odin.start_feature`. If branch creation fails (e.g., branch already exists, git error), do NOT create the feature — you would have a dead DB record with no branch. The branch is the real artifact; the DB record is tracking.

---

## Feature Archival

When a feature completes, the Release phase archives spec files to Supabase Storage.

### What Gets Archived

| File | Purpose |
|------|---------|
| `requirements.md` | Discovery phase output |
| `spec.md` | Approved specification |
| `tasks.md` | Task breakdown |
| `review.md` | Guardian review |
| `implementation-notes.md` | Builder notes |

### Archive Format

**Archived files MUST be formatted markdown, NOT raw JSON.**

The archive modal renders files using `react-markdown`. If you upload raw JSON (e.g., the direct output of `get_phase_outputs()`), it will render as unformatted text — unreadable and useless.

**Correct**: Format phase output data into proper markdown before archiving:
```markdown
# Requirements — FEAT-001

## Functional Requirements
- **REQ-1**: User can log in with email/password (Priority: HIGH)
- **REQ-2**: Session persists across page reloads (Priority: MEDIUM)

## Non-Functional Requirements
- Response time < 200ms for login endpoint
```

**Wrong**: Uploading raw JSON output directly:
```json
[{"id":"REQ-1","title":"User can log in","priority":"HIGH","type":"functional"}]
```

The Release Agent must transform phase output JSON into human-readable markdown before passing files to the archive upload.

### Archive Workflow

The orchestrator archives features using:

```
odin.archive_feature_release({
  feature_id: "AUTH-001",
  summary: "JWT authentication implementation",
  archived_by: "release-agent",
  release_version: "1.0.0",              // optional
  release_notes: "Added JWT login flow"   // optional
})
```

The runtime handles file upload (to Supabase Storage) and database recording automatically. The orchestrator does NOT need to call Edge Functions or insert archive records manually.

### Why Archive?

- **Audit trail**: Complete history of what was built and why
- **Knowledge base**: Reference past specs for similar features
- **Debugging**: Understand original requirements when bugs arise

> **Setup**: See [SUPABASE-SETUP.md](docs/guides/SUPABASE-SETUP.md) for Edge Function deployment.

---

## Critical Rules

### NEVER Skip Phases OR Steps

**All 11 phases must be executed for every feature.** The runtime enforces this at the database level — `odin.record_phase_result` with a forward transition will raise an error if phases are skipped.

**All steps within each phase must also be executed.** Each agent definition contains a **Mandatory Steps Checklist** that must be followed in order. This is enforced at the agent level — the orchestrator must verify each step is completed or explicitly marked N/A with justification.

**Two levels of enforcement**:
- **Phase enforcement**: Database-level. The runtime rejects forward phase skips.
- **Step enforcement**: Agent-level. Each agent has a mandatory checklist. The orchestrator reads the agent definition before each phase and executes every step.

**Complexity level** (L1/L2/L3) affects the **depth** within each phase and each step, not which phases or steps run:
- L1 phases can be very brief (a few sentences), but they must still happen
- L1 steps can produce minimal output, but they must still execute
- Forward transitions must be sequential: 0→1→2→3→4→5→6→7→8→9
- Backward transitions (rework) can go to any earlier phase
- Phase 10 (Complete) is set automatically when the release phase completes successfully

**Example**: An L1 bug fix still goes through all phases AND all steps:
- Phase 0 (Planning): "Single bug fix, no epic"
- Phase 1 (Product): PRD_EXEMPTION (8 lines max)
- Phase 2 (Discovery): "Bug is X, root cause is Y" (all Discovery steps, briefly)
- Phase 3 (Architect): "Fix approach: change Z in file W" (all Step A + Step B steps)
- Phase 4 (Guardian): "Approach is sound, no side effects" (all review steps)
- Phase 5 (Builder): Implement the fix (all implementation steps, emit claims)
- Phase 6 (Reviewer): "No security findings" (scan passes)
- Phase 7 (Integrator): Verify build + runtime (all verification steps, emit claims)
- Phase 8 (Documenter): Update relevant docs (if any) (all documentation steps)
- Phase 9 (Release): Create PR (all release steps, emit claims)

### Spec-First

Never write implementation code without an approved specification. The spec is the contract.

### Agents NEVER Merge Branches

Agents can CREATE pull requests but NEVER merge them. PR merging is ALWAYS a human decision.

**What agents CAN do**:
- `git checkout -b feature/X` - create branch
- `git push -u origin feature/X` - push branch
- `gh pr create` - create PR

**What agents CANNOT do**:
- `git merge` / `git rebase` - NEVER
- `gh pr merge` - NEVER

### Stop After PR Creation

When a PR is created, ALL work stops. The agent waits for the developer to review and merge.

### Bug Fixes Create Learnings

Before closing any bug fix, ask: *Is this a learning?* If the fix involved a non-obvious cause or pattern, create a learning.

### Integrator Verifies Runtime

A passing `npm run build` does NOT guarantee correctness. Integrator must spot-check runtime behavior.

### Agent Invocation Coverage Gate (Release)

Before Phase 9 release actions, the orchestrator MUST verify that all phases have recorded agent invocations. Use:

```
odin.get_feature_status({ feature_id: "FEAT-001" })
```

Check the returned status for invocation coverage across phases 1-8 (before PR) and 1-9 (before completion).

**Expected phase/agent mapping**:

| Phase | Agent |
|-------|-------|
| 1 | product-agent |
| 2 | discovery-agent |
| 3 | architect-agent |
| 4 | guardian-agent |
| 5 | builder-agent |
| 6 | reviewer-agent |
| 7 | integrator-agent |
| 8 | documenter-agent |
| 9 | release-agent |

**On missing coverage (mandatory)**:
1. Do NOT create PR or complete the feature
2. Identify which phases are missing invocations
3. Backfill or re-run the missing phases before proceeding

---

## Architecture Notes

### State Management

Odin state is managed through the **Odin MCP Runtime** (`odin` server) — a single-install TypeScript MCP server that provides all workflow tools (`odin.start_feature`, `odin.prepare_phase_context`, `odin.record_phase_artifact`, etc.).

The runtime supports any PostgreSQL provider as its backend:
- **Direct PostgreSQL** via `DATABASE_URL` (Neon, Railway, self-hosted, etc.)
- **Supabase Management API** via `SUPABASE_URL` + `SUPABASE_ACCESS_TOKEN`

Database schema is applied via `odin.apply_migrations`, which auto-detects existing schemas and tracks applied migrations. See [runtime/README.md](runtime/README.md) for full configuration.

### MCP Limitation

Task-spawned sub-agents cannot access MCP servers. Only the main orchestrator session can make MCP calls.

### Hybrid Orchestration

Agents create artifacts; the main session orchestrates MCP calls and file operations.

> **Full Documentation**: See [HYBRID-ORCHESTRATION-PATTERN.md](docs/reference/HYBRID-ORCHESTRATION-PATTERN.md)

---

## Recovery Mechanisms

### Drift Check

When code and spec diverge:

```
Compare src/[file] against specs/[spec-file].md.
List every discrepancy where code does not match spec.
The spec is the source of truth - update the code.
```

### Context Refresh

When AI hallucinates structure:

```
Stop. You are guessing [column names/types/structure].
Read the actual [database schema/file/API contract] and rewrite your response.
```

### De-Bloat

When spec is over-engineered:

```
This spec is over-engineered. Rewrite as Level 1 complexity.
Keep only Context & Goals and Acceptance Criteria.
```

---

## MCP Context Pulling

### Required MCP Servers

| Server | Purpose | Required |
|--------|---------|----------|
| `odin` | Workflow state, phase context, artifacts, learnings, reviews, migrations | **Yes** |
| `docker-gateway` | Hosts toolkit servers (see below) | Recommended |
| `filesystem` | Direct file access | Recommended |
| `github` | Pull issues, PRs, tickets | Optional |

The `odin` server is the Odin MCP Runtime. It provides all `odin.*` tools and manages workflow state via PostgreSQL (any provider). See [runtime/README.md](runtime/README.md) for setup.

**Docker Gateway Toolkit:**

| Tool | Purpose | When Used |
|------|---------|-----------|
| `context7` | Library docs lookup | Architect, Builder |
| `sequentialthinking` | Complex multi-step reasoning | Any complex task |
| `memory` | Knowledge graph | Optional knowledge backup |

### Trigger Phrases

```
"Read issue #123 from the repository..."          -> github MCP
"Start feature FEAT-001..."                       -> odin MCP (odin.start_feature)
"What phase is next?..."                          -> odin MCP (odin.get_next_phase)
"Apply database migrations..."                    -> odin MCP (odin.apply_migrations)
"Read src/components/Modal.tsx to understand..."   -> filesystem MCP
"Get Next.js docs for app router..."              -> docker-gateway (context7)
```

### Security Rules

- Odin runtime handles database access — agents use `odin.*` tools, not raw SQL
- Docker Gateway: only invoke tools documented in agent definitions

---

## Project Structure

```
odin/
├── ODIN.md                    # This file
├── README.md                  # Quick start
├── agents/
│   ├── definitions/           # 12 agent prompts + shared context
│   └── skills/                # 36+ domain skills
├── runtime/                   # Odin MCP Runtime (TypeScript)
│   ├── src/                   # Source code
│   └── migrations/            # Bundled database migrations
├── docs/
│   ├── framework/             # SDD-framework.md, multi-agent-protocol.md
│   ├── guides/                # example-workflow.md, SUPABASE-SETUP.md
│   └── reference/             # SKILLS-SYSTEM.md, orchestration patterns
├── dashboard/                 # Next.js monitoring dashboard
├── templates/                 # Spec templates (API, UI, Data, Infrastructure)
└── examples/                  # Worked examples (DOC-001, API-001)
```

---

## Code Conventions

### TypeScript

- ES modules with `.js` extensions in imports
- Strict mode enabled
- Zod for runtime validation

### Specifications

- File naming: `specs/[ID]-[description].md`
- Must score 2/2 on all rubric criteria

### Skills

- Location: `agents/skills/[category]/[name]/SKILL.md`
- Include frontmatter with version and dependencies

---

## Quick Reference: Odin Runtime Tools

All workflow operations use `odin.*` tools provided by the Odin MCP Runtime.

### Setup & Migrations

```
odin.apply_migrations({ dry_run: false })
```
Applies pending database migrations. Auto-detects existing schemas on first run. Supports `DATABASE_URL` (any PostgreSQL provider) or Supabase Management API.

### Create a Feature

```
odin.start_feature({
  id: "FEAT-001",
  name: "My Feature",
  complexity_level: 2,        // 1, 2, or 3
  severity: "ROUTINE",        // ROUTINE, EXPEDITED, CRITICAL
  dev_initials: "jd",         // optional
  base_branch: "main",        // optional
  author: "John Doe"          // optional
})
```

### Phase Workflow

```
odin.get_next_phase({ feature_id: "FEAT-001" })

odin.prepare_phase_context({
  feature_id: "FEAT-001",
  phase: "3",
  agent_name: "architect-agent"
})

odin.record_phase_artifact({
  feature_id: "FEAT-001",
  phase: "3",
  output_type: "spec",
  content: { ... },
  created_by: "architect-agent"
})

odin.record_phase_result({
  feature_id: "FEAT-001",
  phase: "3",
  outcome: "completed",
  summary: "Spec drafted",
  created_by: "architect-agent"
})
```

### Review & Verification

```
odin.run_review_checks({
  feature_id: "FEAT-001",
  initiated_by: "reviewer-agent",
  changed_files: ["src/auth.ts"]
})

odin.verify_claims({ feature_id: "FEAT-001" })
```

### Learnings & Knowledge

```
odin.capture_learning({
  feature_id: "FEAT-001",
  phase: "5",
  title: "Cache invalidation pattern",
  content: "...",
  category: "PATTERN",
  domain_tags: ["nextjs", "caching"],
  created_by: "builder-agent"
})

odin.explore_knowledge({
  tags: ["nextjs", "caching"]
})
```

### Status & Release

```
odin.get_feature_status({ feature_id: "FEAT-001" })

odin.archive_feature_release({
  feature_id: "FEAT-001",
  summary: "JWT auth implementation",
  archived_by: "release-agent"
})
```

> **Precondition**: Agent invocation coverage must pass before completing a feature.

---

## Getting Started

1. **Read the framework**: [SDD-framework.md](docs/framework/SDD-framework.md)
2. **Set up the runtime**: [runtime/README.md](runtime/README.md)
3. **Understand agents**: [multi-agent-protocol.md](docs/framework/multi-agent-protocol.md)
4. **See an example**: [example-workflow.md](docs/guides/example-workflow.md)
5. **Database setup**: [SUPABASE-SETUP.md](docs/guides/SUPABASE-SETUP.md)
6. **Explore skills**: [SKILLS-SYSTEM.md](docs/reference/SKILLS-SYSTEM.md)

---

**Odin evolves through dogfooding.** This framework follows its own specification-driven process.
