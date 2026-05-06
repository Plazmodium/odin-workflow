# Hybrid Orchestration Pattern for Odin

**Architecture**: Child agents create artifacts, parent session manages workflow state
**Database**: Supabase (remote PostgreSQL via MCP)
**State Access**: Parent session always; child agents only when the harness gives them direct `odin.*` access

---

## Overview

Odin uses a **hybrid orchestration** model where:

1. **Agents** (stateless workers) create artifacts (specs, reviews, code)
2. **Main Session** (orchestrator) manages workflow state by proxying `odin.*` calls
3. **Supabase** (remote database) stores state accessible to dashboard

This document now describes the **fallback pattern** for harnesses where spawned child agents cannot call `odin.*` directly. If your harness gives the child direct Odin runtime access, use [`../../runtime/README.md#harness-execution-modes`](../../runtime/README.md#harness-execution-modes) as the canonical contract and treat this doc as the parent-session proxy pattern only.

Important: invocation lifecycle telemetry (`prepare_phase_context -> record_phase_result`) is not the same as proof of a distinct child session. When projects care about provable phase ownership, the harness must also record `odin.register_phase_execution(...)`.

For the stricter question "did the child actually run from the properly defined Odin phase bundle?", the harness must additionally record `odin.register_phase_realization(...)` against the manifest returned by `odin.prepare_phase_context(...)`.

Read the examples below using the current 11-phase order (Planning → Product → Discovery → Architect → Guardian → Builder → Reviewer → Integrator → Documenter → Release → Complete).

---

## Agent Responsibilities (What Agents DO)

### ✅ Create Artifacts

Agents focus on their core competency: creating high-quality content.

**Examples**:
- Discovery agent → `requirements.md`
- Architect agent → `spec.md`, `tasks.md`
- Guardian agent → `review.md`, `context.md`
- Builder agent → implementation code, tests

### ✅ Document State Changes Needed

At the end of each artifact, agents document what state changes the orchestrator should make.

**Example** (in `requirements.md`):
```markdown
---
## State Changes Required

After completing this requirements document, the orchestrator should:

1. **Proxy `odin.record_phase_artifact`**:
   - `feature_id`: `AUTH-001-jwt-login`
   - `phase`: `2`
   - `output_type`: `requirements`
   - `created_by`: `context.execution.acting_agent_name`

2. **Proxy `odin.record_phase_result`**:
   - `feature_id`: `AUTH-001-jwt-login`
   - `phase`: `2`
   - `outcome`: `completed`
   - `summary`: `Requirements complete`
   - `created_by`: `context.execution.acting_agent_name`
   - `next_phase`: `3`
   - `blockers`: `[]`
```

### ✅ Follow Workflow Patterns

Agents follow established patterns for file structure, naming, and templates.

### ❌ Do NOT Attempt State Management

Agents should NOT:
- Try to call workflow-state tools when the harness did not give them direct `odin.*` access
- Create Bash scripts to access databases (breaks remote DB model)
- Attempt to write state directly
- Worry about phase transitions or duration tracking

---

## Main Session Responsibilities (What Orchestrator DOES)

### ✅ Spawn Agents

```typescript
// Spawn Discovery agent
const discoveryResult = await Task({
  subagent_type: "discovery",
  prompt: "Gather requirements for AUTH-001-jwt-login...",
  description: "Requirements gathering"
});
```

### ✅ Execute State Changes

After agent completes, orchestrator reads the "State Changes Required" section and proxies the required `odin.*` calls.

In the packaged Odin runtime, the same proxy rule applies when a child agent lacks direct `odin.*` access: the parent session performs the `odin.*` calls on the child's behalf and should pass `context.execution.acting_agent_name` through to fields such as `agent_name` and `created_by` so runtime-managed invocation tracking stays aligned. Child agents should not call `start_agent_invocation` or `end_agent_invocation` directly; the runtime owns that lifecycle through `odin.prepare_phase_context(...)` and `odin.record_phase_result(...)`.

### ✅ Enforce Workflow Rules

- Let the runtime own invocation lifecycle via `odin.prepare_phase_context(...)` and `odin.record_phase_result(...)`
- Record actual execution mode with `odin.register_phase_execution(...)` when a project needs auditable phase ownership
- Record prompt-bundle realization with `odin.register_phase_realization(...)` when a project needs proof that the child ran from the canonical Odin phase bundle manifest
- Validate quality gates before phase transitions
- Manage feature locks for parallel work
- Handle escalations and blockers
- **Validate and inject skills before spawning agents** (see below)

### ✅ Skill Validation Protocol

Before spawning any agent, the orchestrator MUST ensure skills are loaded:

```
1. Read the spec's "Required Skills" or "Tech Stack" section
2. For each required skill:
   a. Check if skill exists at agents/skills/<category>/<skill-name>/SKILL.md
   b. If found → load and inject into agent context under "## Active Skills"
   c. If not found → log warning: "Skill <name> not found, falling back"
3. If NO specific skills matched:
   → Inject agents/skills/generic-dev/SKILL.md as fallback
4. Log all skill injections for the feature record:
   - Which skills were loaded
   - Which were missing (fell back to generic-dev)
   - Total skill token size
```

**Example orchestrator flow**:
```javascript
// Extract tech stack from spec
const techStack = ["nextjs", "supabase", "tailwindcss"];

// Resolve skills
const skills = [];
for (const tech of techStack) {
  const skillPath = findSkill(tech); // searches agents/skills/**/SKILL.md
  if (skillPath) {
    skills.push(readFile(skillPath));
  } else {
    console.warn(`Skill not found: ${tech}`);
  }
}

// Fallback to generic-dev if nothing matched
if (skills.length === 0) {
  skills.push(readFile("agents/skills/generic-dev/SKILL.md"));
}

// Inject into agent prompt
const agentPrompt = `
## Active Skills
${skills.join("\n---\n")}

${agentDefinition}
`;
```

**Failure handling**: If skill loading itself fails (file read error), create a blocker of type `MISSING_CONTEXT` and log the error. Do not block the agent — inject generic-dev as fallback and continue.

---

## Supabase Schema

The remote Supabase database mirrors the local SQLite schema design:

### Core Tables

1. **features** - Feature records
2. **phase_transitions** - Workflow progression history
3. **agent_invocations** - Agent duration tracking
4. **quality_gates** - Guardian approvals
5. **iteration_tracking** - Spec iteration convergence
6. **blockers** - Issues requiring escalation
7. **work_in_progress** - File locks for parallel work
8. **conflict_detection** - Cross-feature file conflicts
9. **audit_log** - Complete operation history

### Views

1. **v_active_features** - Currently in-progress features
2. **v_pending_gates** - Quality gates awaiting approval
3. **v_high_risk_conflicts** - Features with file overlaps
4. **feature_health_overview** - Feature health and duration metrics

---

## Workflow Example: Discovery → Architect

### Step 1: Main Session Spawns Discovery Agent

```typescript
const result = await Task({
  subagent_type: "discovery",
  prompt: `
    Feature Request: JWT Login Flow

    Please gather requirements following Phase 2 Discovery process.
    Feature ID: AUTH-001-jwt-login
  `,
  description: "Requirements gathering for AUTH-001"
});
```

### Step 2: Discovery Agent Creates Artifact

Discovery agent creates `requirements/AUTH-001-jwt-login/requirements.md`:

```markdown
# Requirements: JWT Login Flow

**Feature ID**: AUTH-001-jwt-login
**Complexity**: Level 2
**Priority**: HIGH

## User Stories
...

## Acceptance Criteria
...

---
## State Changes Required

1. **Record requirements artifact**
2. **Complete phase 2 (Discovery) to phase 3 (Architect)**
3. **Use the child's acting agent name for proxied Odin calls**
```

### Step 3: Main Session Executes State Changes

```typescript
// Feature already exists in Odin via `odin.start_feature` or `odin start-feature`

// Read agent output
const reqDoc = await Read({
  filePath: "requirements/AUTH-001-jwt-login/requirements.md"
});

// Parse "State Changes Required" section
// Proxy via Odin runtime tools, preserving the child's acting name

await odin.record_phase_artifact({
  feature_id: 'AUTH-001-jwt-login',
  phase: '2',
  output_type: 'requirements',
  content: reqDoc,
  created_by: context.execution.acting_agent_name,
});

await odin.record_phase_result({
  feature_id: 'AUTH-001-jwt-login',
  phase: '2',
  outcome: 'completed',
  summary: 'Requirements complete',
  created_by: context.execution.acting_agent_name,
  next_phase: '3',
  blockers: [],
});
```

### Step 4: Main Session Spawns Architect Agent

```typescript
const specResult = await Task({
  subagent_type: "architect",
  prompt: `
    Create specification for AUTH-001-jwt-login.

    Requirements document: requirements/AUTH-001-jwt-login/requirements.md

    Follow the current Phase 3 Architect contract.
  `,
  description: "Spec drafting for AUTH-001"
});
```

### Step 5: Repeat Pattern

Architect creates `spec.md` with "State Changes Required" section.
Main session executes state changes.
Main session spawns Guardian agent.
...and so on through the workflow.

---

## Agent Artifact Template

Every agent artifact should end with this section when the parent session needs to proxy `odin.*` calls:

```markdown
---
## State Changes Required

<!-- Document which odin.* calls the parent session should proxy -->

### 1. [State Change Name]
- **Tool**: `odin.[tool_name]`
- **Arguments**:
  - arg1: value1
  - arg2: value2

### 2. [Next State Change]
...

---
## Next Steps

The orchestrator should:
1. Execute the proxied `odin.*` calls above
2. Spawn [NextAgent] agent with [context]
3. Monitor [constraints/budgets]
```

---

## Benefits of This Pattern

### ✅ Works Within Constraints
- Works even when child agents do not have direct `odin.*` or MCP access
- Parent session keeps workflow-state authority

### ✅ Clean Separation of Concerns
- Agents: Content creation (stateless)
- Orchestrator: State management (stateful)
- Database: Single source of truth

### ✅ Enables Dashboard
- Supabase is remote, accessible from anywhere
- Real-time subscriptions for live updates
- Multiple developers → same database

### ✅ Testable
- Agent outputs are pure artifacts (files)
- Can test agents without database
- Can test orchestration logic separately

### ✅ Flexible
- Can swap Supabase for other backends
- Can add additional orchestration logic
- Agents remain unchanged

---

## Migration from Old Pattern

### Old Pattern (Pre-Runtime History)

````markdown
# Agent Instructions

### Step 6: Track State

**CRITICAL**: You MUST call MCP tools directly.

[Historical note: this was only true for older harness setups where child agents had no direct runtime access]
````


### Current Fallback Pattern (Works Without Child `odin.*` Access)

````markdown
# Agent Instructions

### Step 6: Complete Artifact

Create your artifact (spec.md, review.md, etc.) and include a "State Changes Required" section documenting which `odin.*` calls the parent session should proxy on your behalf.

**Example**:
```markdown
---
## State Changes Required

### Record Spec Artifact
- Tool: `odin.record_phase_artifact`
- Phase: 3 (Architect)
- Output type: `spec`
- created_by: `context.execution.acting_agent_name`

### Close Phase
- Tool: `odin.record_phase_result`
- Phase: 3 (Architect)
- Outcome: `completed`
- Next phase: 4 (Guardian)
- created_by: `context.execution.acting_agent_name`
````

```

---

## Orchestrator Helper Functions

### Recommended Pattern

Create helper functions in the parent session for proxied `odin.*` calls. Avoid raw SQL/Supabase writes for normal workflow progression because Odin runtime owns actor normalization, invocation lifecycle, and phase-completion guards.

```typescript
async function recordArtifactFromChild(featureId, phase, outputType, content, actingAgentName) {
  await odin.record_phase_artifact({
    feature_id: featureId,
    phase,
    output_type: outputType,
    content,
    created_by: actingAgentName,
  });
}

async function completePhaseFromChild(featureId, phase, summary, actingAgentName, nextPhase) {
  await odin.record_phase_result({
    feature_id: featureId,
    phase,
    outcome: 'completed',
    summary,
    created_by: actingAgentName,
    next_phase: nextPhase,
    blockers: [],
  });
}

async function proxyStateChangesFromChild(context, artifactContent) {
  await recordArtifactFromChild(
    context.feature.id,
    context.phase.id,
    'spec',
    artifactContent,
    context.execution.acting_agent_name
  );

  await completePhaseFromChild(
    context.feature.id,
    context.phase.id,
    'Spec draft complete',
    context.execution.acting_agent_name,
    '4'
  );
}

async function startFeature(featureId, name, complexityLevel, severity, author) {
  await odin.start_feature({
    id: featureId,
    name,
    complexity_level: complexityLevel,
    severity,
    author,
  });
}
```

---

## Dashboard Integration

The Supabase database enables real-time dashboard visualization:

```javascript
// Dashboard subscribes to real-time updates
const { data, error } = await supabase
  .from('features')
  .select('*')
  .eq('status', 'IN_PROGRESS')
  .subscribe((payload) => {
    // Update UI with live feature progress
    updateFeatureProgressUI(payload.new);
  });

// Query feature health overview
const { data: health } = await supabase
  .from('feature_health_overview')
  .select('*')
  .order('health_score', { ascending: true });

// Display features with health concerns
```

---

## Learning Propagation Workflow

The orchestrator manages propagation of high-confidence learnings to AGENTS.md, Skills, and Agent definitions. This is a hybrid workflow: PostgreSQL functions handle eligibility/formatting, the main session handles file operations.

### Multi-Target Propagation

Learnings can propagate to multiple targets simultaneously:

```
Learning (confidence >= 0.80)
    │
    ├─→ AGENTS.md (project-specific insights)
    │
    ├─→ Skill file (technology patterns)
    │     └─ Append to "## Session Learnings" section
    │
    └─→ Agent definition (workflow improvements)
          └─ Append to "## Learnings" section
```

### Propagation Steps (Orchestrator)

```
1. CHECK QUEUE
   SELECT * FROM get_skill_propagation_queue();
   -- Returns learnings with unpropagated targets

2. FOR EACH TARGET:
   a. Read target file (mcp_read)
   b. Check for duplicates (search for title)
   c. Append formatted learning to appropriate section
   d. Record propagation:
      SELECT * FROM record_skill_propagation(
        'learning-uuid', 'skill', 'frontend/nextjs-dev', 'orchestrator'
      );

3. VERIFY
   SELECT * FROM learning_propagation_overview;
   -- All learnings should show propagation_status = 'complete'
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `declare_propagation_target()` | Declare where a learning should go |
| `get_skill_propagation_queue()` | Get learnings with unpropagated targets |
| `record_skill_propagation()` | Record a completed propagation (idempotent) |
| `get_learning_propagation_status()` | Check propagation status for a learning |
| `get_propagations_for_skill()` | Get all learnings propagated to a skill |
| `get_pending_evolution_syncs()` | Find propagated learnings that need updating |

### Safety Measures

- **Confidence threshold**: Only >= 0.80 can propagate
- **Relevance threshold**: Only >= 0.60 targets qualify
- **Duplicate detection**: Skip if title already in file
- **Conflict blocking**: Won't propagate if open conflicts exist
- **Audit trail**: All propagations logged
- **Idempotent**: `record_skill_propagation()` returns NULL if already done

---

## Git Branch Management

The orchestrator manages git branches per feature. Database records intent, orchestrator executes git commands.

### Branch Workflow

```
1. create_feature() → returns branch_name
2. Orchestrator: git checkout -b {branch_name} {base_branch}
3. Each phase: commit work, call record_commit()
4. Release phase: gh pr create, call record_pr()
5. Human reviews and merges PR (NEVER the agent)
6. Human calls record_merge()
7. Orchestrator calls record_release_closeout()
```

### Branch Naming

- With initials: `{dev_initials}/feature/{FEATURE-ID}` (e.g., `jd/feature/AUTH-001`)
- Without initials: `feature/{FEATURE-ID}`

### CRITICAL: Agents NEVER Merge PRs

Agents can CREATE pull requests but NEVER merge them. PR merging is ALWAYS a human decision. No exceptions.

---

## Completion Status

1. ✅ Document pain points and the orchestrator/agent boundary clearly
2. ✅ Document hybrid orchestration pattern (this document)
3. ✅ Update all agent instructions for new pattern
4. ✅ Supabase MCP connected and working
5. ✅ End-to-end workflow tested (DASH-001, FIX-001, GIT-001, RT-001, LEARN-001)
6. ✅ Dashboard developed with polling auto-refresh
7. ✅ Learning propagation to skills and agent definitions
8. ✅ Git branch management per feature

---

**Architecture Version**: 3.0 (Hybrid Orchestration + Multi-Target Propagation + Git Management)
**Date**: 2026-02-09
**Status**: Complete — all features verified and documented
