# Hybrid Orchestration Pattern for Odin

**Architecture**: Agents create artifacts, Main session manages state
**Database**: Supabase (remote PostgreSQL via MCP)
**State Access**: Main session only (via Supabase MCP)

---

## Overview

Odin uses a **hybrid orchestration** model where:

1. **Agents** (stateless workers) create artifacts (specs, reviews, code)
2. **Main Session** (orchestrator) manages workflow state via Supabase MCP
3. **Supabase** (remote database) stores state accessible to dashboard

This architecture works within the constraint that sub-agents spawned via task/agent tools cannot access MCP servers.

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

1. **Register Feature**:
   - Feature ID: AUTH-001-jwt-login
   - Name: JWT Login Flow
   - Complexity: Level 2

2. **Track Duration**:
   - Phase: 0 (Discovery)
   - Agent: Discovery
   - Operation: Requirements gathering

3. **Transition Phase**:
   - From: Phase 1 (Discovery)
   - To: Phase 2 (Architect)
   - Next Agent: Architect
```

### ✅ Follow Workflow Patterns

Agents follow established patterns for file structure, naming, and templates.

### ❌ Do NOT Attempt State Management

Agents should NOT:
- Try to call MCP tools (they don't have access)
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

After agent completes, orchestrator reads the "State Changes Required" section and executes via Supabase MCP:

```typescript
// 1. Register feature
await mcp_supabase_execute_sql({
  query: `SELECT * FROM create_feature(
    'AUTH-001-jwt-login',
    'JWT Login Flow',
    2,
    'ROUTINE',
    NULL, NULL,
    'discovery-agent'
  )`
});

// 2. Track agent duration
await mcp_supabase_execute_sql({
  query: `SELECT * FROM start_agent_invocation(
    'AUTH-001-jwt-login',
    '0'::phase,
    'discovery-agent',
    'Requirements gathering'
  )`
});

// 3. Transition phase
await mcp_supabase_execute_sql({
  query: `SELECT * FROM transition_phase(
    'AUTH-001-jwt-login',
    '1'::phase,
    'discovery-agent',
    'Requirements complete'
  )`
});
```

### ✅ Enforce Workflow Rules

- Track agent durations via `start_agent_invocation` / `end_agent_invocation`
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

    Please gather requirements following Phase 1 Discovery process.
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

1. **Register Feature**:
   - ID: AUTH-001-jwt-login
   - Name: JWT Login Flow
   - Complexity: 2

2. **End Agent Invocation**:
   - Phase: 0, Agent: Discovery
   - Operation: Requirements gathering

3. **Transition Phase**: 0 → 1 (Architect)
```

### Step 3: Main Session Executes State Changes

```typescript
// Read agent output
const reqDoc = await Read({
  file_path: "requirements/AUTH-001-jwt-login/requirements.md"
});

// Parse "State Changes Required" section
// Execute via Supabase MCP

await mcp_supabase_execute_sql({
  query: "SELECT * FROM create_feature('AUTH-001-jwt-login', 'JWT Login Flow', 2, 'ROUTINE', NULL, NULL, 'discovery-agent')"
});

await mcp_supabase_execute_sql({
  query: "SELECT * FROM end_agent_invocation(<invocation_id>)"
});

await mcp_supabase_execute_sql({
  query: "SELECT * FROM transition_phase('AUTH-001-jwt-login', '1'::phase, 'discovery-agent', 'Requirements complete')"
});
```

### Step 4: Main Session Spawns Architect Agent

```typescript
const specResult = await Task({
  subagent_type: "architect",
  prompt: `
    Create specification for AUTH-001-jwt-login.

    Requirements document: requirements/AUTH-001-jwt-login/requirements.md

    Follow Phase 2 Specification Drafting process.
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

Every agent artifact should end with this section:

```markdown
---
## State Changes Required

<!-- Document what state changes the orchestrator should make -->

### 1. [State Change Name]
- **Operation**: [insert/update/delete]
- **Table**: [table_name]
- **Data**:
  - field1: value1
  - field2: value2

### 2. [Next State Change]
...

---
## Next Steps

The orchestrator should:
1. Execute state changes above via Supabase MCP
2. Spawn [NextAgent] agent with [context]
3. Monitor [constraints/budgets]
```

---

## Benefits of This Pattern

### ✅ Works Within Constraints
- Agents don't need MCP access
- Main session uses its native MCP capability

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

### Old Pattern (Doesn't Work)
```markdown
# Agent Instructions

### Step 6: Track State

**CRITICAL**: You MUST call MCP tools directly.

[Agents cannot call MCP tools - this never worked]
```

### New Pattern (Works)
```markdown
# Agent Instructions

### Step 6: Complete Artifact

Create your artifact (spec.md, review.md, etc.) and include a "State Changes Required" section documenting what state changes the orchestrator should make.

**Example**:
```markdown
---
## State Changes Required

### End Agent Invocation
- Phase: 1 (Specification)
- Agent: Architect
- Operation: Spec draft v1

### Transition Phase
- To: Phase 2 (Iteration)
- Next Agent: Guardian
```
```

---

## Orchestrator Helper Functions

### Recommended Pattern

Create helper functions in main session for common operations:

```typescript
async function registerFeature(featureId, name, complexity, severity = "ROUTINE") {
  await mcp_supabase_execute_sql({
    query: `SELECT * FROM create_feature(
      '${featureId}', '${name}', ${complexity}, '${severity}',
      NULL, NULL, 'orchestrator'
    )`
  });
}

async function startAgentInvocation(featureId, phase, agentName, operation) {
  const result = await mcp_supabase_execute_sql({
    query: `SELECT * FROM start_agent_invocation(
      '${featureId}', '${phase}'::phase, '${agentName}', '${operation}'
    )`
  });
  return result.id; // invocation_id for later end_agent_invocation
}

async function endAgentInvocation(invocationId) {
  await mcp_supabase_execute_sql({
    query: `SELECT * FROM end_agent_invocation(${invocationId})`
  });
}

async function transitionPhase(featureId, toPhase, agentName, notes) {
  await mcp_supabase_execute_sql({
    query: `SELECT * FROM transition_phase(
      '${featureId}', '${toPhase}'::phase, '${agentName}', '${notes}'
    )`
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
```

### Branch Naming

- With initials: `{dev_initials}/feature/{FEATURE-ID}` (e.g., `jd/feature/AUTH-001`)
- Without initials: `feature/{FEATURE-ID}`

### CRITICAL: Agents NEVER Merge PRs

Agents can CREATE pull requests but NEVER merge them. PR merging is ALWAYS a human decision. No exceptions.

---

## Completion Status

1. ✅ Document pain points (AGENT-MCP-ACCESS-LIMITATIONS.md)
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
