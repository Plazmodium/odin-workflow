# ODIN.md

> **Odin** is a Specification-Driven Development (SDD) framework for AI-assisted development.
> It provides 9 specialized agents, adaptive complexity levels, a learnings system with
> confidence scoring, and EVALS for health monitoring.

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
- **8-phase workflow** with 9 specialized agents
- **Skills system** with 36+ domain-specific knowledge modules

---

## The 8-Phase Workflow

| Phase | Name | Agent | Description |
|-------|------|-------|-------------|
| 0 | Planning | Planner | Epic decomposition (L3 only) |
| 1 | Discovery | Discovery | Requirements gathering |
| 2 | Architect | Architect | Specification drafting |
| 3 | Guardian | Guardian | Spec review and approval |
| 4 | Builder | Builder | Implementation |
| 5 | Integrator | Integrator | Build verification |
| 6 | Documenter | Documenter | Documentation generation |
| 7 | Release | Release | PR creation and archival (telemetry gate required) |

```
All features: PLANNING -> DISCOVERY -> ARCHITECT -> GUARDIAN -> BUILDER -> INTEGRATOR -> DOCUMENTER -> RELEASE
```

> **Note**: L1/L2 features still execute Planning — it's just brief ("No epic decomposition needed").
> Complexity level affects **depth** within each phase, not which phases run.

> **Detailed Documentation**: See [multi-agent-protocol.md](docs/framework/multi-agent-protocol.md)

### Task Tracking Protocol

The Architect (Phase 2) records a task breakdown via `record_phase_output()`. The Builder (Phase 4) updates task statuses as work progresses. This drives the dashboard's task progress display.

**Architect responsibility** (Phase 2):
```sql
-- Record tasks with explicit 'pending' status for each task
SELECT * FROM record_phase_output(
  'FEAT-001', '2'::phase, 'tasks',
  '[
    {"id": "T1", "title": "Create component", "status": "pending"},
    {"id": "T2", "title": "Add tests", "status": "pending"}
  ]'::jsonb,
  'architect-agent'
);
```

**Builder/Orchestrator responsibility** (Phase 4):
```sql
-- After completing each task, upsert with updated statuses
SELECT * FROM record_phase_output(
  'FEAT-001', '2'::phase, 'tasks',
  '[
    {"id": "T1", "title": "Create component", "status": "completed"},
    {"id": "T2", "title": "Add tests", "status": "in-progress"}
  ]'::jsonb,
  'builder-agent'
);
```

**Rules**:
- Every task object MUST include `id`, `title`, and `status` fields
- Valid statuses: `pending`, `in-progress`, `completed` (also accepts `done`)
- `record_phase_output()` is an upsert — same feature/phase/type replaces the previous record
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

## The 9 Agents

| Agent | Phases | Role |
|-------|--------|------|
| [Planner](agents/definitions/planning.md) | 0 | Epic decomposition for L3 features |
| [Discovery](agents/definitions/discovery.md) | 1 | Requirements gathering from vague inputs |
| [Architect](agents/definitions/architect.md) | 2 | Specification drafting and task breakdown |
| [Guardian](agents/definitions/guardian.md) | 3 | Spec review with 3 perspectives |
| [Builder](agents/definitions/builder.md) | 4 | Code implementation per spec |
| [Integrator](agents/definitions/integrator.md) | 5 | Build and runtime verification |
| [Documenter](agents/definitions/documenter.md) | 6 | Documentation generation |
| [Release](agents/definitions/release.md) | 7 | PR creation and feature archival |
| [Consultant](agents/definitions/spec-driven-dev-consultant.md) | Any | Spec refinement and analysis |

All agents inherit shared context from [_shared-context.md](agents/definitions/_shared-context.md).

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

## Git Branch Management

Odin tracks git branches per feature.

### Branch Naming

Format: `{dev_initials}/feature/{FEATURE-ID}`  
Example: `jd/feature/AUTH-001`

### Developer Identity

The `dev_initials` and `author` parameters in `create_feature()` identify the human developer. The orchestrator must **never guess** these values. To obtain them:

1. **Check git config**: `git config user.name` for author, derive initials from the name
2. **Check recent features**: Query `SELECT dev_initials, author FROM features WHERE dev_initials IS NOT NULL ORDER BY created_at DESC LIMIT 1`
3. **Ask the developer** if neither source is available

### Workflow

1. **Orchestrator creates the git branch FIRST**: `git checkout -b {dev_initials}/feature/{FEATURE-ID}` — this must succeed before anything is recorded in the database
2. **Only after the branch exists**, call `create_feature()` to record the feature in the database
3. Transition to Phase 1 (Discovery) — all work happens on the feature branch
4. Commits tracked per phase via `record_commit()`
5. Release phase creates PR via `gh pr create`
6. Human reviews and merges (NEVER the agent)

> **CRITICAL**: Create the git branch BEFORE calling `create_feature()`. If branch creation fails (e.g., branch already exists, git error), do NOT create the feature in the database — you would have a dead DB record with no branch. The branch is the real artifact; the DB record is just tracking.

### Key Functions

```sql
-- Track commit per phase
SELECT * FROM record_commit('FEAT-001', 'abc123', '4'::phase, 'feat: add login');

-- Record PR creation
SELECT * FROM record_pr('FEAT-001', 'https://github.com/org/repo/pull/42', 42);

-- Record merge (human only)
SELECT * FROM record_merge('FEAT-001', 'human');
```

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

**Wrong**: Uploading raw JSON from `record_phase_output()`:
```json
[{"id":"REQ-1","title":"User can log in","priority":"HIGH","type":"functional"}]
```

The Release Agent must transform phase output JSON into human-readable markdown before passing files to the archive upload.

### Archive Storage

Files are uploaded to Supabase Storage bucket `workflow-archives/{FEATURE-ID}/`:

```
workflow-archives/
├── AUTH-001/
│   ├── requirements.md
│   ├── spec.md
│   └── tasks.md
├── USER-042/
│   └── ...
```

### Archive Workflow (Hybrid Orchestration)

1. **Release Agent** documents files to archive in State Changes
2. **Orchestrator** uploads files via `archive-upload` Edge Function

**IMPORTANT**: Use Node.js (not curl) to preserve newlines in markdown files:

```javascript
// Archive files with proper newline preservation
node -e "
const fs = require('fs');
const https = require('https');

const payload = JSON.stringify({
  feature_id: 'AUTH-001',
  files: [
    { name: 'requirements.md', content: fs.readFileSync('specs/AUTH-001/requirements.md', 'utf8') },
    { name: 'spec.md', content: fs.readFileSync('specs/AUTH-001/spec.md', 'utf8') }
  ]
});

const req = https.request({
  hostname: '[project-ref].supabase.co',
  path: '/functions/v1/archive-upload',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer [anon-key]',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
req.write(payload);
req.end();
"
```

> **WARNING**: Do NOT use curl with shell substitution like `$(cat file | tr '\n' ' ')` — this strips newlines and breaks markdown rendering.

3. **Orchestrator** records archive in database:

```sql
INSERT INTO feature_archives (feature_id, storage_path, files_archived, ...)
VALUES ('AUTH-001', 'workflow-archives/AUTH-001/', ARRAY['requirements.md', 'spec.md'], ...);
```

### Why Archive?

- **Audit trail**: Complete history of what was built and why
- **Knowledge base**: Reference past specs for similar features
- **Debugging**: Understand original requirements when bugs arise

> **Setup**: See [SUPABASE-SETUP.md](docs/guides/SUPABASE-SETUP.md) for Edge Function deployment.

---

## Critical Rules

### NEVER Skip Phases OR Steps

**All 8 phases must be executed for every feature.** The `transition_phase()` function enforces this at the database level — attempting to skip a phase will raise an error.

**All steps within each phase must also be executed.** Each agent definition contains a **Mandatory Steps Checklist** that must be followed in order. This is enforced at the agent level — the orchestrator must verify each step is completed or explicitly marked N/A with justification.

**Two levels of enforcement**:
- **Phase enforcement**: Database-level. `transition_phase()` rejects forward skips.
- **Step enforcement**: Agent-level. Each agent has a mandatory checklist. The orchestrator reads the agent definition before each phase and executes every step.

**Complexity level** (L1/L2/L3) affects the **depth** within each phase and each step, not which phases or steps run:
- L1 phases can be very brief (a few sentences), but they must still happen
- L1 steps can produce minimal output, but they must still execute
- Forward transitions must be sequential: 0→1→2→3→4→5→6→7
- Backward transitions (rework) can go to any earlier phase
- Phase 8 (Complete) is set by `complete_feature()`, not by `transition_phase()`

**Example**: An L1 bug fix still goes through all phases AND all steps:
- Phase 0 (Planning): "Single bug fix, no epic"
- Phase 1 (Discovery): "Bug is X, root cause is Y" (all 7 Discovery steps, briefly)
- Phase 2 (Architect): "Fix approach: change Z in file W" (all Step A + Step B steps)
- Phase 3 (Guardian): "Approach is sound, no side effects" (all review steps)
- Phase 4 (Builder): Implement the fix (all implementation steps)
- Phase 5 (Integrator): Verify build + runtime (all verification steps)
- Phase 6 (Documenter): Update relevant docs (if any) (all documentation steps)
- Phase 7 (Release): Create PR (all release steps)

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

Before Phase 7 release actions and before calling `complete_feature(...)`, the orchestrator MUST verify agent invocation telemetry coverage.

**Coverage requirement by checkpoint**:
- Before PR/release actions: phases **1-6** must have completed invocations
- Before `complete_feature(...)`: phases **1-7** must have completed invocations

**Expected phase/agent mapping**:
- `1` -> `discovery-agent`
- `2` -> `architect-agent`
- `3` -> `guardian-agent`
- `4` -> `builder-agent`
- `5` -> `integrator-agent`
- `6` -> `documenter-agent`
- `7` -> `release-agent`

**Validation query**:
```sql
WITH expected AS (
  SELECT * FROM (VALUES
    ('1'::phase, 'discovery-agent'::text),
    ('2'::phase, 'architect-agent'::text),
    ('3'::phase, 'guardian-agent'::text),
    ('4'::phase, 'builder-agent'::text),
    ('5'::phase, 'integrator-agent'::text),
    ('6'::phase, 'documenter-agent'::text),
    ('7'::phase, 'release-agent'::text)
  ) AS t(phase, agent_name)
), actual AS (
  SELECT phase, agent_name
  FROM agent_invocations
  WHERE feature_id = :feature_id
    AND ended_at IS NOT NULL
    AND duration_ms IS NOT NULL
)
SELECT e.phase, e.agent_name
FROM expected e
LEFT JOIN actual a
  ON a.phase = e.phase
 AND a.agent_name = e.agent_name
WHERE a.phase IS NULL;
```

**Pass/fail rule**:
- **PASS**: query returns zero rows
- **FAIL**: query returns one or more missing phase/agent pairs

**On FAIL (mandatory)**:
1. Record quality gate failure with `gate_name = 'agent_invocation_coverage'` and status `REJECTED` (fail semantic)
2. Create/update a blocker listing missing phase/agent pairs
3. Halt release progression (do not create PR, do not call `complete_feature(...)`)

**Remediation (explicit only, never silent)**:
- Optional backfill may derive invocations from `phase_transitions`
- Backfilled rows must include explicit notes about the source
- Re-run coverage validation and proceed only after PASS

**Important**: Dashboard fallback aggregation is display resilience only. It does not satisfy workflow correctness.

---

## Architecture Notes

### State Management

All Odin state uses Supabase PostgreSQL via `mcp_supabase_execute_sql`.

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

### Recommended MCP Servers

- `filesystem` - Direct file access
- `github` - Pull issues, PRs, tickets
- `postgres`/`sqlite` - Read schemas (read-only!)
- `supabase` - Database functions and queries

### Trigger Phrases

```
"Read issue #123 from the repository..."          -> github MCP
"Check the users table schema..."                 -> postgres MCP
"Read src/components/Modal.tsx to understand..."  -> filesystem MCP
```

### Security Rule

Database MCP servers must be read-only during spec phase. No INSERT/UPDATE/DELETE.

---

## Project Structure

```
odin/
├── ODIN.md                    # This file
├── README.md                  # Quick start
├── agents/
│   ├── definitions/           # 9 agent prompts + shared context
│   └── skills/                # 36+ domain skills
├── docs/
│   ├── framework/             # SDD-framework.md, multi-agent-protocol.md
│   ├── guides/                # example-workflow.md, SUPABASE-SETUP.md
│   └── reference/             # SKILLS-SYSTEM.md, orchestration patterns
├── system/
│   ├── dashboard/             # Next.js monitoring dashboard
│   └── database/              # Supabase migrations
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

## Quick Reference

### Create a Feature

```sql
SELECT * FROM create_feature(
  'FEAT-001',           -- id
  'My Feature',         -- name
  2,                    -- complexity_level (1, 2, or 3)
  'ROUTINE',            -- severity (ROUTINE, EXPEDITED, CRITICAL)
  NULL,                 -- epic_id (optional)
  NULL,                 -- requirements_path (optional)
  'orchestrator',       -- created_by
  'jd',                 -- dev_initials (optional)
  'main',               -- base_branch (optional)
  'John Doe'            -- author (optional)
);
```

### Transition Phase

```sql
SELECT * FROM transition_phase(
  'FEAT-001',           -- feature_id
  '2'::phase,           -- to_phase (0-8)
  'architect-agent',    -- agent_name
  'Notes here'          -- notes (optional)
);
```

### Track Agent Work

```sql
-- Start tracking
SELECT * FROM start_agent_invocation(
  'FEAT-001',
  '2'::phase,
  'architect-agent',
  'Operation description',
  ARRAY['frontend/nextjs-dev']  -- skills_used (optional)
);

-- End tracking (calculates duration)
SELECT * FROM end_agent_invocation(invocation_id);
```

### Approve Quality Gate

```sql
SELECT * FROM approve_gate(
  'FEAT-001',
  'guardian_approval',
  'APPROVED',
  'guardian-agent',
  'Spec meets all criteria'
);
```

### Complete Feature

```sql
SELECT * FROM complete_feature('FEAT-001', 'release-agent');
```

> **Precondition**: Agent invocation coverage must pass before calling `complete_feature(...)`.

---

## Getting Started

1. **Read the framework**: [SDD-framework.md](docs/framework/SDD-framework.md)
2. **Understand agents**: [multi-agent-protocol.md](docs/framework/multi-agent-protocol.md)
3. **See an example**: [example-workflow.md](docs/guides/example-workflow.md)
4. **Set up Supabase**: [SUPABASE-SETUP.md](docs/guides/SUPABASE-SETUP.md)
5. **Explore skills**: [SKILLS-SYSTEM.md](docs/reference/SKILLS-SYSTEM.md)

---

**Odin evolves through dogfooding.** This framework follows its own specification-driven process.
