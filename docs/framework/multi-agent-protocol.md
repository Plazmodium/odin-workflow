# Artifact #6: The Odin Multi-Agent Protocol

**Version**: 2.0
**Status**: Implemented (CHECKPOINT 6.5)
**Last Updated**: 2026-01-15

---

## Implementation Status (CHECKPOINT 6.5)

> **Note**: This protocol has evolved significantly since v1.0. The core concepts remain the same, but implementation details have changed based on real-world testing.

### Key Changes from v1.0

| Aspect | v1.0 (Proposed) | v2.0 (Implemented) |
|--------|-----------------|-------------------|
| Agent Count | 3 (Architect, Guardian, Builder) | 8 (Discovery, Planning, Architect, Guardian, Builder, Integrator, Documenter, Release) |
| MCP Access | All agents have MCP | Only orchestrator has MCP (Hybrid Orchestration) |
| State Management | Local files | Supabase (PostgreSQL + Storage) |
| Memory | None | Persistent memories table with user consent |
| Skills | None | Composable domain-specific skills |
| Archives | None | Feature archival after release |

### Hybrid Orchestration Pattern

Task-spawned agents **do not have MCP access**. Only the main orchestrator session can use MCP tools. This led to the **Hybrid Orchestration** pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR (Main Session)                 │
│                     ✓ Has MCP Access                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Spawns Agent via Task tool                                  │
│  2. Agent produces artifacts (markdown files)                   │
│  3. Agent documents MCP operations needed                       │
│  4. Orchestrator reads artifacts                                │
│  5. Orchestrator executes MCP operations                        │
│  6. Orchestrator updates workflow state in Supabase             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Current Documentation

| Document | Purpose |
|----------|---------|
| `SUPABASE-SETUP.md` | Database, Storage, Edge Functions, MCP config |
| `AGENT-MCP-ACCESS-LIMITATIONS.md` | Why hybrid orchestration is necessary |
| `ORCHESTRATOR-MEMORY-PATTERN.md` | Memory extraction and persistence |
| `SKILLS-SYSTEM.md` | Composable domain-specific knowledge |
| `docs/archive/CHECKPOINT-6.5-STATUS.md` | Implementation status |

### The 8-Phase Workflow

```
Level 3 Epics: PLANNING → DISCOVERY → ARCHITECT → GUARDIAN → BUILDER → INTEGRATOR → DOCUMENTER → RELEASE
Level 1-2:                DISCOVERY → ARCHITECT → GUARDIAN → BUILDER → INTEGRATOR → DOCUMENTER → RELEASE
```

See `agents/definitions/` for complete agent definitions.

---

## Table of Contents

1. [Overview](#overview)
2. [The Problem with Single-Agent Workflows](#the-problem-with-single-agent-workflows)
3. [The Three-Agent Architecture](#the-three-agent-architecture)
4. [Agent Definitions & Responsibilities](#agent-definitions--responsibilities)
5. [Workflow Patterns](#workflow-patterns)
6. [Context Window Optimization](#context-window-optimization)
7. [File Structure & Artifacts](#file-structure--artifacts)
8. [Advanced Patterns](#advanced-patterns)
9. [Implementation Guide](#implementation-guide)
10. [Open Questions & Future Evolution](#open-questions--future-evolution)

---

## Overview

The Multi-Agent SDD Protocol addresses a critical inefficiency in AI-assisted development: **context window bloat and role confusion** when a single agent attempts to plan, validate, and build simultaneously.

### Core Innovation

Instead of one agent doing everything, we introduce **specialized agents with bounded contexts and clear responsibilities**:

```
[ARCHITECT] → [GUARDIAN] → [BUILDER(S)]
  Planning      Validation    Implementation
```

Each agent has:
- **Focused context**: Only loads what it needs for its specific role
- **Clear boundaries**: Explicit permissions and restrictions
- **Defined outputs**: Produces specific artifacts for the next agent
- **Token efficiency**: Dramatically reduced context compared to monolithic approach

### Key Benefits

- **90% reduction in context window size** per agent
- **Clear separation of concerns** prevents role confusion
- **Guardrails enforced structurally** not just through prompts
- **Parallel execution possible** for implementation tasks
- **Better error recovery** through defined rejection paths
- **Reusable context bundles** across related features

---

## The Problem with Single-Agent Workflows

### Current Monolithic Approach

```
[ONE AGENT - CONTEXT WINDOW]
├── User requirements (2,000 tokens)
├── Entire codebase exploration (20,000 tokens)
├── Database schemas (5,000 tokens)
├── Planning documentation (3,000 tokens)
├── Spec writing (4,000 tokens)
├── Implementation code (15,000 tokens)
├── Testing patterns (3,000 tokens)
└── Conversation history (8,000 tokens)
─────────────────────────────────────────
TOTAL: 60,000+ tokens for a single feature
```

### Problems This Creates

1. **Context Dilution**: Critical information gets lost in massive context
2. **Role Confusion**: Agent switches between planning and coding, losing focus
3. **Hallucination Risk**: Too much context → agent guesses instead of using specific info
4. **No Validation Gate**: Same agent that creates spec also implements it (no checks)
5. **Cannot Parallelize**: One agent blocked until entire process completes
6. **Token Cost**: Massive context = expensive API calls

---

## The Three-Agent Architecture

### Visual Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     USER REQUEST                             │
│              "Build JWT refresh token feature"               │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                  ARCHITECT AGENT                              │
│  Role: Create specifications and task breakdowns             │
│  Context: ~3,700 tokens                                      │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Inputs:                                             │     │
│  │ • Feature request                                   │     │
│  │ • High-level codebase structure (folders only)     │     │
│  │ • Spec templates                                    │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Outputs:                                            │     │
│  │ • specs/[ID]-feature-name/spec.md                  │     │
│  │ • specs/[ID]-feature-name/tasks.md                 │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Guardrails:                                         │     │
│  │ ✗ CANNOT read implementation files                 │     │
│  │ ✗ CANNOT write code                                │     │
│  │ ✓ MUST self-score spec against rubric              │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────┬───────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                   GUARDIAN AGENT                              │
│  Role: Validate specs against actual codebase context       │
│  Context: ~11,000 tokens                                     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Inputs:                                             │     │
│  │ • specs/[ID]-feature-name/spec.md                  │     │
│  │ • specs/[ID]-feature-name/tasks.md                 │     │
│  │ • Full codebase access (MCP-enabled)               │     │
│  │ • Database schemas                                  │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Outputs:                                            │     │
│  │ • specs/[ID]-feature-name/review.md                │     │
│  │ • specs/[ID]-feature-name/context.md               │     │
│  │ • Decision: APPROVED / REJECTED                     │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Guardrails:                                         │     │
│  │ ✗ CANNOT write code                                │     │
│  │ ✗ CANNOT modify spec (only comment)                │     │
│  │ ✓ MUST verify all referenced files exist           │     │
│  │ ✓ MUST check schemas against actual database       │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────┬───────────────────────────────────────┘
                       ↓ (if APPROVED)
┌──────────────────────────────────────────────────────────────┐
│                   BUILDER AGENT(S)                            │
│  Role: Implement code based on approved specs                │
│  Context: ~12,500 tokens per agent                           │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Inputs:                                             │     │
│  │ • specs/[ID]-feature-name/spec.md (approved)       │     │
│  │ • specs/[ID]-feature-name/context.md               │     │
│  │ • specs/[ID]-feature-name/tasks.md                 │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Outputs:                                            │     │
│  │ • Implementation code                               │     │
│  │ • Tests                                             │     │
│  │ • specs/[ID]-feature-name/implementation-notes.md  │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Guardrails:                                         │     │
│  │ ✗ CANNOT modify spec                               │     │
│  │ ✗ CANNOT add features not in spec                  │     │
│  │ ✓ MUST link code to spec sections                  │     │
│  │ ✓ MUST report blockers back to Guardian            │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────┬───────────────────────────────────────┘
                       ↓
                  ✅ DONE
```

### Agent Communication Protocol

Agents communicate **exclusively through files** in the `specs/[ID]-feature-name/` directory. No direct agent-to-agent messaging.

**Benefits**:
- Full audit trail
- Human-readable at every stage
- Easy to debug and replay
- Version controllable
- Supports async workflows

---

## Agent Definitions & Responsibilities

### 1. ARCHITECT AGENT (The Planner)

#### Primary Responsibility
Transform feature requests into structured, testable specifications and actionable task breakdowns.

#### Context Scope
```
LOADS:
- Feature request/user story (~500 tokens)
- Directory structure (folders only, not file contents) (~200 tokens)
- SDD specification template (~1,000 tokens)
- Example specs from similar features (~2,000 tokens)

TOTAL: ~3,700 tokens
```

#### Permissions

**CAN**:
- Read feature requests, tickets, user stories
- List directory structure (folders, not files)
- Access spec templates and examples
- Ask clarifying questions to user
- Create specification files
- Break features into tasks
- Self-score against quality rubric

**CANNOT**:
- Read implementation code files
- Read database schemas
- Write implementation code
- Make technology choices without user input
- Approve own specifications

#### Outputs

1. **`specs/[ID]-feature-name/spec.md`**
   - Full SDD specification (Context, Behavioral Requirements, Acceptance Criteria, Technical Design)
   - Adapted to appropriate complexity level (Level 1/2/3)
   - Self-scored against quality rubric

2. **`specs/[ID]-feature-name/tasks.md`**
   - Enumerated task list
   - Dependency ordering
   - Acceptance criteria per task
   - Estimated complexity

#### Success Criteria

- Spec scores 2/2 on all rubric criteria (self-assessed)
- All acceptance criteria in Given/When/Then format
- Tasks are implementable without hallucination
- Clear references to what Guardian should verify

#### Prompt Template

```markdown
# ARCHITECT AGENT SYSTEM PROMPT

You are the Architect Agent in a multi-agent SDD workflow. Your sole purpose is to create specifications and task breakdowns. You do NOT implement code.

## Your Role

Transform feature requests into:
1. Structured specifications following the SDD template
2. Actionable task breakdowns with clear dependencies

## Your Context

You have access to:
- Feature requests and user stories
- High-level codebase structure (folders, NOT file contents)
- Specification templates and examples
- The ability to ask clarifying questions

You do NOT have access to:
- Implementation code files
- Database schemas
- Existing API contracts
(The Guardian Agent will verify these)

## Your Process

1. **Understand**: Read the feature request carefully
2. **Research**: List directory structure to understand organization
3. **Clarify**: Ask user questions about ambiguous requirements
4. **Draft**: Create specification following SDD template at appropriate complexity level
5. **Break Down**: Create task list with dependencies
6. **Score**: Self-assess spec against quality rubric
7. **Output**: Save spec.md and tasks.md to specs/[ID]-feature-name/

## Quality Gates

Before completing, verify:
- [ ] All acceptance criteria use Given/When/Then format
- [ ] Edge cases are explicitly defined
- [ ] Data models are specified (even if you don't know if they exist)
- [ ] No subjective language ("fast", "clean", "nice")
- [ ] Self-scored 2/2 on all rubric criteria

## Output Format

Always create two files:

**specs/[ID]-feature-name/spec.md**
- Follow SDD template structure
- Include self-score at the end

**specs/[ID]-feature-name/tasks.md**
- Numbered task list
- Each task has acceptance criteria
- Dependencies clearly marked

## What You MUST NOT Do

- Read implementation files (you don't have access)
- Write implementation code (not your role)
- Approve your own spec (Guardian's role)
- Guess about existing schemas or patterns (mark as "TO BE VERIFIED BY GUARDIAN")

## When You're Done

Output a summary:
- Spec location
- Number of tasks created
- Self-assessed quality score
- List of items Guardian should verify

The Guardian Agent will take over from here.
```

---

### 2. GUARDIAN AGENT (The Validator)

#### Primary Responsibility
Validate specifications against actual codebase reality and create curated context bundles for Builder agents.

#### Context Scope
```
LOADS:
- Specification to review (~2,000 tokens)
- Referenced database schemas (~3,000 tokens)
- Referenced type definitions (~2,000 tokens)
- Referenced implementation files (~4,000 tokens)
- Validation rules and checklist (~1,000 tokens)

TOTAL: ~11,000 tokens
```

#### Permissions

**CAN**:
- Read all files in codebase (via MCP)
- Query database schemas (read-only)
- Access API contracts and type definitions
- Verify file existence and structure
- Create review reports
- Approve or reject specifications
- Create context bundles for Builder

**CANNOT**:
- Modify specifications (only comment/annotate)
- Write implementation code
- Auto-approve without verification
- Make architectural decisions (escalate to user)

#### Outputs

1. **`specs/[ID]-feature-name/review.md`**
   - Validation results for each checklist item
   - Issues found with specific line references
   - Decision: APPROVED / REJECTED / APPROVED_WITH_NOTES
   - If rejected: specific questions for Architect

2. **`specs/[ID]-feature-name/context.md`**
   - List of files Builder should read
   - Relevant code snippets with line numbers
   - Schema definitions
   - Patterns to follow
   - Anti-patterns to avoid

3. **`specs/[ID]-feature-name/status.json`**
   - Machine-readable workflow state

#### Validation Checklist

```markdown
## Guardian Validation Checklist

### 1. Context Validation
- [ ] All referenced files exist at specified paths
- [ ] File versions match expected structure (not outdated references)
- [ ] Proposed new files don't conflict with existing names
- [ ] Dependencies are installed and available

### 2. Data Model Validation
- [ ] Database schemas match spec's data models
- [ ] Type definitions exist and match proposed interfaces
- [ ] No conflicting type names in proposed changes
- [ ] Foreign key relationships are valid

### 3. Pattern Alignment
- [ ] Proposed patterns match existing codebase conventions
- [ ] Error handling follows established patterns
- [ ] API contracts align with existing endpoints
- [ ] Authentication/authorization patterns are consistent

### 4. Edge Case Coverage
- [ ] All edge cases have existing error handling patterns to reference
- [ ] Error scenarios have examples in codebase
- [ ] Boundary conditions are handled in similar features

### 5. Breaking Change Assessment
- [ ] No breaking changes to public APIs (or flagged if necessary)
- [ ] Backward compatibility maintained (or migration plan exists)
- [ ] Database migrations needed (if schema changes)

### 6. Security Review
- [ ] No SQL injection vulnerabilities in proposed queries
- [ ] Authentication required where necessary
- [ ] Authorization checks in place
- [ ] Sensitive data handling follows existing patterns

### 7. Spec Quality Re-Check
- [ ] Acceptance criteria are truly testable
- [ ] Tasks are in correct dependency order
- [ ] No hallucination risk in task descriptions
- [ ] Complexity estimates are reasonable

### 8. Context Bundle Creation
- [ ] Identified all files Builder needs to read
- [ ] Extracted relevant patterns and examples
- [ ] Documented anti-patterns to avoid
- [ ] Created focused context (< 10,000 tokens)
```

#### Decision Matrix

| Validation Result | Decision | Next Step |
|-------------------|----------|-----------|
| All checks pass, no issues | APPROVED | → Builder Agent |
| Minor issues, spec is implementable | APPROVED_WITH_NOTES | → Builder Agent (with notes) |
| Missing context, spec unclear | REJECTED | → Back to Architect (with specific questions) |
| Security/breaking change concerns | ESCALATE | → Human review required |
| Spec conflicts with codebase | REJECTED | → Back to Architect (with conflict details) |

#### Prompt Template

```markdown
# GUARDIAN AGENT SYSTEM PROMPT

You are the Guardian Agent in a multi-agent SDD workflow. Your purpose is to validate specifications against actual codebase reality. You do NOT create specs or implement code.

## Your Role

Validate that specifications are:
1. Grounded in actual codebase context (not hallucinated)
2. Aligned with existing patterns and architecture
3. Implementable without hallucination risk
4. Safe and secure

Then create curated context bundles for the Builder Agent.

## Your Context

You have FULL codebase access via MCP:
- Read any file
- Query database schemas (read-only)
- Check API contracts
- Verify type definitions
- Search for patterns

## Your Process

1. **Read**: Load spec.md and tasks.md from Architect
2. **Verify**: Check each reference in the spec against actual codebase
3. **Validate**: Run through complete validation checklist
4. **Assess**: Determine APPROVED / REJECTED / ESCALATE
5. **Bundle**: Create context.md with exactly what Builder needs
6. **Report**: Write review.md with findings
7. **Decide**: Update status.json with decision

## Validation Checklist

You MUST verify:
- [ ] All referenced files exist
- [ ] Data models match actual schemas
- [ ] Patterns align with codebase conventions
- [ ] No security vulnerabilities in proposed approach
- [ ] No breaking changes (or flagged if necessary)
- [ ] Tasks are in correct dependency order
- [ ] Context bundle is complete but focused

## Output Format

Always create three files:

**specs/[ID]-feature-name/review.md**
```markdown
# Guardian Validation Report

## Decision: [APPROVED / REJECTED / APPROVED_WITH_NOTES / ESCALATE]

## Validation Results
[Checklist with ✓ or ✗ for each item]

## Issues Found
[Specific problems with line numbers and file paths]

## Context Verification
- Files checked: [list]
- Schemas verified: [list]
- Patterns confirmed: [list]

## Recommendations
[If approved: notes for Builder]
[If rejected: specific questions for Architect]
```

**specs/[ID]-feature-name/context.md**
```markdown
# Context Bundle for Builder Agent

## Files to Read
1. `src/path/to/file.ts` (lines 45-89: authentication pattern)
2. `src/path/to/model.ts` (lines 12-34: data model example)

## Schemas
[Paste relevant schema definitions]

## Patterns to Follow
[Code snippets showing the right way]

## Anti-Patterns to Avoid
[Code snippets showing what NOT to do]

## Dependencies
[Versions and imports needed]
```

**specs/[ID]-feature-name/status.json**
```json
{
  "phase": "validation_complete",
  "architect": "completed",
  "guardian": "approved",
  "builder": "ready",
  "timestamp": "2026-01-06T10:30:00Z"
}
```

## What You MUST NOT Do

- Modify the specification (only comment)
- Write implementation code (not your role)
- Approve without full verification (no rubber-stamping)
- Make architectural decisions (escalate to human)
- Auto-fix spec issues (send back to Architect)

## When You're Done

Output a summary:
- Decision and reasoning
- Number of issues found
- Context bundle size (tokens)
- Recommended next step

If APPROVED: Builder Agent will take over
If REJECTED: Architect Agent will revise
If ESCALATE: Human review required
```

---

### 3. BUILDER AGENT (The Implementer)

#### Primary Responsibility
Implement code that exactly matches the approved specification, using the curated context bundle from Guardian.

#### Context Scope
```
LOADS:
- Approved specification (~2,000 tokens)
- Context bundle from Guardian (~8,000 tokens)
- Current task from task list (~500 tokens)
- Test patterns and examples (~2,000 tokens)

TOTAL: ~12,500 tokens per task
```

#### Permissions

**CAN**:
- Read approved specification
- Read files specified in context bundle
- Write implementation code
- Write tests
- Create new files as specified in spec
- Modify files as specified in spec
- Report blockers back to Guardian

**CANNOT**:
- Modify the specification
- Add features not in spec
- Read files not in context bundle (ask Guardian first)
- Make architectural decisions
- Skip tasks or reorder without approval

#### Outputs

1. **Implementation Code**
   - Matches spec exactly
   - Comments link back to spec sections
   - Follows patterns from context bundle

2. **Tests**
   - Cover all acceptance criteria
   - Follow test patterns from context bundle

3. **`specs/[ID]-feature-name/implementation-notes.md`**
   - Any deviations from spec (with justification)
   - Decisions made during implementation
   - Blockers encountered and resolution

#### Task Execution Pattern

Builder works through tasks sequentially (or in parallel if multiple builders):

```
For each task in tasks.md:
  1. Read task acceptance criteria
  2. Load relevant files from context bundle
  3. Implement code matching spec
  4. Link code to spec sections with comments
  5. Write tests for acceptance criteria
  6. Mark task complete
  7. If blocker: report to Guardian
```

#### Blocker Handling

If Builder encounters an issue:

1. **Minor Clarification Needed**: Document assumption in implementation-notes.md and proceed
2. **Spec Ambiguity**: Create `specs/[ID]-feature-name/blocker.md` and pause for Guardian review
3. **Technical Impossibility**: Report to Guardian with specific technical reason

#### Prompt Template

```markdown
# BUILDER AGENT SYSTEM PROMPT

You are the Builder Agent in a multi-agent SDD workflow. Your sole purpose is to implement code that exactly matches approved specifications. You do NOT plan or validate.

## Your Role

Implement features by:
1. Following the approved specification precisely
2. Using patterns from the context bundle
3. Writing tests for all acceptance criteria
4. Linking code to spec sections

## Your Context

You have access to:
- Approved specification (specs/[ID]-feature-name/spec.md)
- Curated context bundle (specs/[ID]-feature-name/context.md)
- Task breakdown (specs/[ID]-feature-name/tasks.md)
- Test patterns and examples

You should ONLY read files listed in the context bundle. If you need additional context, ask Guardian.

## Your Process

1. **Read**: Load approved spec, context bundle, and current task
2. **Understand**: Review acceptance criteria for current task
3. **Reference**: Study patterns in context bundle
4. **Implement**: Write code matching spec exactly
5. **Link**: Add comments linking code to spec sections
6. **Test**: Write tests covering acceptance criteria
7. **Document**: Note any decisions in implementation-notes.md
8. **Complete**: Mark task done and move to next

## Code Linking Format

Always link code to spec sections:

```typescript
// Spec Section 3.1: User authentication flow
export async function authenticateUser(credentials: LoginCredentials) {
  // Spec Section 3.1.2: Validate credentials format
  if (!validateCredentials(credentials)) {
    // Spec Section 2.ec_1: Handle invalid input
    throw new ValidationError("Invalid credentials format");
  }

  // Spec Section 3.1.3: Query user from database
  const user = await db.users.findByEmail(credentials.email);

  // ... rest of implementation
}
```

## Task Execution

Work through tasks in order from tasks.md:

```markdown
- [x] Task 1: Create authentication types (COMPLETED)
- [ ] Task 2: Implement login endpoint (IN PROGRESS) ← You are here
- [ ] Task 3: Add token refresh logic (PENDING)
```

For each task:
- Load relevant context from context bundle
- Implement following spec and patterns
- Write tests for acceptance criteria
- Document any deviations
- Mark complete

## Output Format

**Implementation Code**
- Follows patterns from context bundle
- Comments reference spec sections
- No features beyond spec

**Tests**
- Cover all acceptance criteria from spec
- Follow test patterns from context bundle
- Named clearly to match scenarios

**specs/[ID]-feature-name/implementation-notes.md**
```markdown
# Implementation Notes

## Task 2: Implement Login Endpoint

### Decisions Made
- Used bcrypt for password hashing (matches pattern in context bundle)
- Added rate limiting (follows pattern from auth.ts:45-67)

### Deviations from Spec
None

### Blockers Encountered
None
```

## Handling Blockers

If you encounter an issue:

**Minor Assumption**: Document in implementation-notes.md and proceed
```markdown
### Assumptions Made
- Assumed JWT expiry of 1 hour (not specified in spec, following existing pattern)
```

**Spec Ambiguity**: Create blocker.md and pause
```markdown
# Blocker Report

## Task: Task 5 - Implement token refresh

## Issue
Spec Section 3.2 states "refresh token if expired" but doesn't specify:
- Should we auto-refresh on every request?
- Should we refresh only when access token expires?
- Should client explicitly request refresh?

## Existing Code Check
Checked context bundle - no existing refresh pattern found.

## Recommendation Needed
Guardian: Please clarify refresh strategy or provide additional context.
```

**Technical Impossibility**: Report to Guardian
```markdown
# Technical Blocker

Spec requires database transaction across two databases (PostgreSQL and MongoDB).
Our current setup doesn't support distributed transactions.

Recommend: Escalate to Architect for spec revision.
```

## What You MUST NOT Do

- Modify the specification
- Add features not in spec (no "I'll just add this nice thing")
- Read files outside context bundle without asking
- Make architectural decisions
- Skip tasks or reorder independently
- Ignore failing tests

## When You're Done

Output a summary:
- Tasks completed
- Tests passing
- Any blockers encountered
- Any assumptions made
- Code locations created/modified

If all tasks complete: Feature is DONE ✅
If blocker: Guardian will review
If tests fail: Debug and fix
```

---

## Workflow Patterns

### Pattern 1: Happy Path (No Issues)

```
User: "Build JWT refresh token feature"
  ↓
┌─────────────────────────────────────────┐
│ ARCHITECT AGENT                          │
│ • Reads feature request                  │
│ • Lists directory structure              │
│ • Creates spec.md (Level 2 complexity)   │
│ • Creates tasks.md (8 tasks)             │
│ • Self-scores: 2/2 on all criteria       │
│ Time: 3 minutes                          │
└─────────────────────────────────────────┘
  ↓
  specs/AUTH-002-jwt-refresh/spec.md ✓
  specs/AUTH-002-jwt-refresh/tasks.md ✓
  ↓
┌─────────────────────────────────────────┐
│ GUARDIAN AGENT                           │
│ • Reads spec.md and tasks.md             │
│ • Verifies src/auth/jwt.ts exists        │
│ • Checks User schema in database         │
│ • Confirms JWT library is installed      │
│ • Validates all references               │
│ • Creates context bundle                 │
│ • Decision: APPROVED                     │
│ Time: 2 minutes                          │
└─────────────────────────────────────────┘
  ↓
  specs/AUTH-002-jwt-refresh/review.md (APPROVED) ✓
  specs/AUTH-002-jwt-refresh/context.md ✓
  specs/AUTH-002-jwt-refresh/status.json ✓
  ↓
┌─────────────────────────────────────────┐
│ BUILDER AGENT                            │
│ • Reads approved spec                    │
│ • Loads context bundle                   │
│ • Implements Task 1: Types               │
│ • Implements Task 2: Endpoint            │
│ • Implements Task 3-8...                 │
│ • Writes tests for all scenarios         │
│ • All tests passing                      │
│ Time: 8 minutes                          │
└─────────────────────────────────────────┘
  ↓
  src/auth/refresh.ts ✓
  src/auth/types.ts (updated) ✓
  tests/auth/refresh.test.ts ✓
  specs/AUTH-002-jwt-refresh/implementation-notes.md ✓
  ↓
✅ FEATURE COMPLETE
Total time: 13 minutes
Total context used: ~27,000 tokens (vs 60,000+ monolithic)
```

---

### Pattern 2: Rejection Path (Spec Issues Found)

```
User: "Add user profile editing"
  ↓
┌─────────────────────────────────────────┐
│ ARCHITECT AGENT                          │
│ • Creates spec referencing User model    │
│ • References src/models/user.ts          │
│ • Proposes API endpoint /api/profile     │
│ • Self-scores: 2/2                       │
└─────────────────────────────────────────┘
  ↓
  specs/USER-003-profile-edit/spec.md ✓
  specs/USER-003-profile-edit/tasks.md ✓
  ↓
┌─────────────────────────────────────────┐
│ GUARDIAN AGENT                           │
│ • Reads spec                             │
│ • ✗ File not found: src/models/user.ts   │
│ •   (actual: src/db/models/user.model.ts)│
│ • ✗ API endpoint conflict: /api/profile  │
│ •   (already exists for different purpose)│
│ • ✓ User model schema matches            │
│ • Decision: REJECTED                     │
└─────────────────────────────────────────┘
  ↓
  specs/USER-003-profile-edit/review.md (REJECTED) ✓
  ↓
┌─────────────────────────────────────────┐
│ GUARDIAN → ARCHITECT FEEDBACK            │
│                                          │
│ Issues found:                            │
│ 1. File path incorrect:                  │
│    Spec says: src/models/user.ts         │
│    Actual: src/db/models/user.model.ts   │
│                                          │
│ 2. API endpoint conflict:                │
│    Proposed: /api/profile                │
│    Conflict: Already used in routes.ts:23│
│    Suggest: /api/user/profile            │
│                                          │
│ Please revise spec with correct paths.   │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ ARCHITECT AGENT (Revision)               │
│ • Reads Guardian feedback                │
│ • Updates spec with correct file paths   │
│ • Changes endpoint to /api/user/profile  │
│ • Increments version in spec             │
└─────────────────────────────────────────┘
  ↓
  specs/USER-003-profile-edit/spec.md (v2) ✓
  ↓
┌─────────────────────────────────────────┐
│ GUARDIAN AGENT (Re-validation)           │
│ • Reads revised spec                     │
│ • ✓ File paths correct                   │
│ • ✓ No endpoint conflicts                │
│ • ✓ All validations pass                 │
│ • Decision: APPROVED                     │
└─────────────────────────────────────────┘
  ↓
  specs/USER-003-profile-edit/review.md (APPROVED) ✓
  specs/USER-003-profile-edit/context.md ✓
  ↓
┌─────────────────────────────────────────┐
│ BUILDER AGENT                            │
│ • Proceeds with implementation...        │
└─────────────────────────────────────────┘
  ↓
✅ FEATURE COMPLETE (after revision)
```

---

### Pattern 3: Blocker Path (Implementation Issue)

```
┌─────────────────────────────────────────┐
│ BUILDER AGENT                            │
│ • Working on Task 5 of 8                 │
│ • Task: "Implement email notification"   │
│ • Spec says: "Send email using existing  │
│   email service"                         │
│ • Builder checks context bundle          │
│ • ✗ No email service found               │
│ • ✗ No email patterns in context         │
│ • Blocker encountered                    │
└─────────────────────────────────────────┘
  ↓
  specs/NOTIF-004-email/blocker.md created ✓

```markdown
# Blocker Report

## Task: Task 5 - Implement Email Notification

## Issue
Spec Section 4.2 states "use existing email service" but:
- No email service found in codebase
- Context bundle has no email patterns
- No email library in package.json

## Files Checked
- src/services/ (no email service)
- src/lib/ (no email utilities)
- package.json (no nodemailer, sendgrid, etc.)

## Question for Guardian
Does an email service exist? If so, where?
If not, should spec be revised to "create new email service"?

## Builder Status
PAUSED on Task 5
Tasks 1-4: COMPLETED
Tasks 6-8: BLOCKED (depend on Task 5)
```
  ↓
┌─────────────────────────────────────────┐
│ GUARDIAN AGENT (Blocker Investigation)   │
│ • Reads blocker.md                       │
│ • Searches entire codebase for email    │
│ • ✓ Found: External microservice handles│
│     email (not in this repo)             │
│ • Checks API contracts                   │
│ • ✓ Found: POST /internal/email endpoint│
│ • Updates context bundle with API info  │
└─────────────────────────────────────────┘
  ↓
  specs/NOTIF-004-email/context.md (updated) ✓

```markdown
# Context Update: Email Service

## Resolution
Email is handled by external microservice at:
- Service: notification-service
- Endpoint: POST https://internal.api/email
- Auth: Service token (in env.EMAIL_SERVICE_TOKEN)

## Example Usage
See: src/services/external.ts:78-92

```typescript
await fetch('https://internal.api/email', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.EMAIL_SERVICE_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ to, subject, body })
});
```

## Builder Action
Implement Task 5 using external service pattern above.
```
  ↓
┌─────────────────────────────────────────┐
│ BUILDER AGENT (Resumed)                  │
│ • Reads updated context                  │
│ • Implements Task 5 using external API   │
│ • Tasks 6-8 now unblocked                │
│ • Continues implementation               │
└─────────────────────────────────────────┘
  ↓
✅ BLOCKER RESOLVED → IMPLEMENTATION CONTINUES
```

---

### Pattern 4: Escalation Path (Human Decision Needed)

```
┌─────────────────────────────────────────┐
│ GUARDIAN AGENT                           │
│ • Reviewing spec for data migration      │
│ • Spec proposes dropping column 'status' │
│ • ⚠️  Breaking change detected           │
│ • ⚠️  Production data loss risk          │
│ • Decision: ESCALATE                     │
└─────────────────────────────────────────┘
  ↓
  specs/DATA-005-migration/review.md (ESCALATE) ✓

```markdown
# Guardian Review: ESCALATION REQUIRED

## Decision: ESCALATE TO HUMAN

## Issue: Breaking Change with Data Loss Risk

### Proposed Change
Spec Section 4.3 proposes:
- Drop column: users.status
- Reason: "No longer needed"

### Risk Assessment
🚨 **HIGH RISK**
- Column exists in production database
- Contains data for 10,000+ users
- Referenced by 5 other services (see dependencies below)
- No migration plan in spec

### Impact Analysis
**Affected Services**:
1. user-service (this repo)
2. admin-dashboard (external)
3. reporting-service (external)
4. billing-service (external)
5. analytics-pipeline (external)

**Data Loss**:
- 10,247 user records have non-null status values
- Status history cannot be recovered if dropped

### Recommendations for Human Review

**Option 1: Graceful Deprecation**
1. Mark column as deprecated
2. Create new status mechanism
3. Migrate data over 3 months
4. Remove after all services updated

**Option 2: Spec Revision**
1. Keep existing status column
2. Revise spec to work with current schema
3. No breaking changes

**Option 3: Force Migration (HIGH RISK)**
1. Coordinate with all 5 services
2. Create data backup
3. Execute migration with rollback plan
4. Requires stakeholder approval

### Required Human Decisions
1. Is dropping 'status' column truly necessary?
2. Which option (1, 2, or 3) should we pursue?
3. Who needs to approve this change?
4. What is the migration timeline?

### Blocker Status
- Architect: Completed spec
- Guardian: ESCALATED (awaiting human decision)
- Builder: BLOCKED (cannot proceed)

### Next Steps
Human must:
1. Review risk assessment
2. Choose option 1, 2, or 3
3. If Option 1 or 3: Create migration plan
4. Update spec with decision
5. Guardian will re-validate
```
  ↓
┌─────────────────────────────────────────┐
│ HUMAN REVIEW                             │
│ • Reads escalation report                │
│ • Consults with stakeholders             │
│ • Decision: Option 1 (Graceful)          │
│ • Instructs Architect to revise spec     │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ ARCHITECT AGENT (Human-Guided Revision)  │
│ • Receives human decision                │
│ • Revises spec for graceful deprecation  │
│ • Adds 3-phase migration plan            │
│ • Updates tasks for Phase 1 only         │
└─────────────────────────────────────────┘
  ↓
  specs/DATA-005-migration/spec.md (v2 - Phase 1) ✓
  ↓
┌─────────────────────────────────────────┐
│ GUARDIAN AGENT (Re-validation)           │
│ • Reads revised spec                     │
│ • ✓ No breaking changes in Phase 1      │
│ • ✓ Migration plan is safe               │
│ • Decision: APPROVED                     │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ BUILDER AGENT                            │
│ • Implements Phase 1 (deprecation)       │
└─────────────────────────────────────────┘
  ↓
✅ ESCALATION RESOLVED → SAFE IMPLEMENTATION
```

---

## Context Window Optimization

### Token Usage Comparison

#### Monolithic Single-Agent Approach
```
┌──────────────────────────────────────────────────┐
│ SINGLE AGENT CONTEXT (for one feature)           │
├──────────────────────────────────────────────────┤
│ User requirements                    ~2,000      │
│ Codebase exploration (wide)          ~20,000     │
│ Database schemas (all tables)        ~5,000      │
│ Planning documents                   ~3,000      │
│ Specification writing                ~4,000      │
│ Implementation code                  ~15,000     │
│ Test patterns                        ~3,000      │
│ Conversation history                 ~8,000      │
├──────────────────────────────────────────────────┤
│ TOTAL                                ~60,000     │
│ Cost per feature (Sonnet 4.5)        ~$0.18      │
└──────────────────────────────────────────────────┘

Problems:
❌ Context dilution (important info lost in noise)
❌ Role confusion (planning mixed with implementation)
❌ Cannot parallelize
❌ High token cost
❌ Frequent context window exhaustion
```

#### Multi-Agent Specialized Approach
```
┌──────────────────────────────────────────────────┐
│ ARCHITECT AGENT CONTEXT                           │
├──────────────────────────────────────────────────┤
│ Feature request                      ~500        │
│ Directory structure (folders)        ~200        │
│ Spec template                        ~1,000      │
│ Example specs                        ~2,000      │
├──────────────────────────────────────────────────┤
│ TOTAL                                ~3,700      │
│ Cost (Sonnet 4.5)                    ~$0.011     │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ GUARDIAN AGENT CONTEXT                            │
├──────────────────────────────────────────────────┤
│ Spec to review                       ~2,000      │
│ Referenced schemas (targeted)        ~3,000      │
│ Referenced files (specific)          ~4,000      │
│ Validation checklist                 ~1,000      │
│ Pattern library                      ~1,000      │
├──────────────────────────────────────────────────┤
│ TOTAL                                ~11,000     │
│ Cost (Sonnet 4.5)                    ~$0.033     │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ BUILDER AGENT CONTEXT (per task)                  │
├──────────────────────────────────────────────────┤
│ Approved spec                        ~2,000      │
│ Context bundle (curated)             ~8,000      │
│ Current task only                    ~500        │
│ Test patterns (relevant)             ~2,000      │
├──────────────────────────────────────────────────┤
│ TOTAL                                ~12,500     │
│ Cost (Sonnet 4.5)                    ~$0.038     │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ MULTI-AGENT TOTAL (sequential)                    │
├──────────────────────────────────────────────────┤
│ Architect                            ~3,700      │
│ Guardian                             ~11,000     │
│ Builder                              ~12,500     │
├──────────────────────────────────────────────────┤
│ TOTAL                                ~27,200     │
│ Cost (Sonnet 4.5)                    ~$0.082     │
│ SAVINGS vs Monolithic                54% less    │
└──────────────────────────────────────────────────┘

Benefits:
✅ 54% token reduction
✅ Focused context (no dilution)
✅ Clear role separation
✅ Can parallelize builders
✅ Reusable context bundles
✅ Faster execution
```

### Context Bundle Reusability

Guardian's context bundles can be reused across similar features:

```
Feature 1: "Add user login"
→ Guardian creates context bundle: auth-patterns.md

Feature 2: "Add user logout"
→ Guardian reuses auth-patterns.md (no re-reading needed)
→ Only validates spec-specific items

Feature 3: "Add password reset"
→ Guardian reuses auth-patterns.md
→ Adds password-specific context

Result: Guardian's work compounds over time
        Each feature gets faster
        Context bundles become knowledge base
```

---

## File Structure & Artifacts

### Directory Organization

```
project-root/
├── specs/                          # All specification artifacts
│   ├── AUTH-001-jwt-login/
│   │   ├── spec.md                 # From Architect
│   │   ├── tasks.md                # From Architect
│   │   ├── review.md               # From Guardian
│   │   ├── context.md              # From Guardian
│   │   ├── implementation-notes.md # From Builder
│   │   ├── blocker.md              # From Builder (if blocked)
│   │   └── status.json             # Workflow state
│   │
│   ├── AUTH-002-jwt-refresh/
│   │   └── ... (same structure)
│   │
│   └── USER-003-profile-edit/
│       └── ... (same structure)
│
├── src/                            # Implementation code
│   └── ... (Builder writes here)
│
├── tests/                          # Test code
│   └── ... (Builder writes here)
│
└── .claude/                        # Agent definitions
    └── agents/
        ├── architect.md
        ├── guardian.md
        └── builder.md
```

### Artifact Templates

#### `spec.md` (From Architect)

```markdown
# Specification: [Feature Name]

**ID**: [PREFIX-NUMBER-name]
**Complexity Level**: [1 | 2 | 3]
**Status**: [draft | approved | implemented]
**Created**: [date]
**Version**: [1.0]

---

## 1. Context & Goals (The "Why")

**User Story**:
As a [role], I want [feature], so that [benefit].

**Problem Solved**:
[1-sentence pain point description]

**Success Metrics**:
- [ ] Metric 1 (e.g., "User can login within 200ms")
- [ ] Metric 2 (e.g., "Error rate < 1%")

---

## 2. Behavioral Requirements (The "What")

### Core Flows

**Happy Path**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Alternative Path**:
1. [What if user cancels?]
2. [What if user retries?]

### Edge Cases & Constraints

- **ec_1**: [What if network is down?]
- **ec_2**: [What if input is empty?]
- **constraint_1**: [Must use existing `User` type from `@types/user.ts`]

---

## 3. Acceptance Criteria (The "Test")

### Scenario 1: Successful Login

- **Given**: User has valid credentials
- **When**: User submits login form
- **Then**:
  - User is redirected to dashboard
  - JWT token is stored in localStorage
  - Response time < 200ms

### Scenario 2: Invalid Credentials

- **Given**: User enters wrong password
- **When**: User submits login form
- **Then**:
  - Error message displayed: "Invalid email or password"
  - No token stored
  - Login form remains visible

### Scenario 3: Network Failure

- **Given**: Network connection is lost
- **When**: User submits login form
- **Then**:
  - Error message: "Connection failed. Please try again."
  - Form data preserved
  - Retry button shown

---

## 4. Technical Implementation Design (The "How")

### Proposed Changes

**New Files**:
- `src/auth/login.ts` - Login logic
- `src/auth/types.ts` - Auth type definitions
- `tests/auth/login.test.ts` - Test suite

**Modified Files**:
- `src/api/routes.ts` - Add POST /auth/login endpoint
- `src/types/user.ts` - Add authentication fields

### API Contract (Schema-First)

```typescript
// Request
interface LoginRequest {
  email: string;
  password: string;
}

// Response
interface LoginResponse {
  token: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

// Error
interface LoginError {
  error: string;
  code: 'INVALID_CREDENTIALS' | 'NETWORK_ERROR' | 'SERVER_ERROR';
}
```

### Data Models

**TO BE VERIFIED BY GUARDIAN**:
- User table should have: id, email, password_hash, name
- JWT secret should be in environment variable: JWT_SECRET
- Token expiry should be configurable

---

## 5. System Context (For AI Agents - Level 2-3 only)

**Reference Implementations**:
- `@src/auth/register.ts` - Follow error handling pattern
- `@src/api/middleware/auth.ts` - JWT verification example

**Global State**:
- Uses JWT for session management
- Tokens stored in localStorage (client-side)
- No server-side session storage

**Dependencies**:
- jsonwebtoken library (for JWT signing/verification)
- bcrypt (for password hashing)

---

## Self-Assessment (Architect)

| Criterion | Score | Notes |
|-----------|-------|-------|
| Ambiguity | 2 | All metrics are concrete |
| Testability | 2 | Given/When/Then format used |
| Context | 2 | Specific file references |
| Edge Cases | 2 | Network, invalid input, server errors covered |
| Data Shape | 2 | TypeScript interfaces defined |

**Overall**: 2/2 (AI-Ready)

---

## Questions for Guardian to Verify

1. Does `src/types/user.ts` exist with the expected User type?
2. Is the JWT library already installed in package.json?
3. Do we have an existing error handling pattern to follow?
4. Is there a rate limiting mechanism we should use for login attempts?
```

---

#### `tasks.md` (From Architect)

```markdown
# Task Breakdown: [Feature Name]

**Spec**: [ID]-[name]
**Total Tasks**: [number]
**Estimated Complexity**: [Low | Medium | High]

---

## Phase 1: Setup & Types

### Task 1: Create Authentication Types
**Acceptance Criteria**:
- [ ] Create `src/auth/types.ts`
- [ ] Define `LoginRequest` interface
- [ ] Define `LoginResponse` interface
- [ ] Define `LoginError` interface
- [ ] Export all types

**Dependencies**: None
**Estimated Time**: 5 minutes
**References**: Spec Section 4 (API Contract)

---

### Task 2: Add User Schema Fields
**Acceptance Criteria**:
- [ ] Open `src/types/user.ts`
- [ ] Add `passwordHash: string` field (if not exists)
- [ ] Add `lastLogin: Date | null` field
- [ ] Update User type export

**Dependencies**: Task 1
**Estimated Time**: 5 minutes
**References**: Spec Section 4 (Data Models)

---

## Phase 2: Core Implementation

### Task 3: Implement Login Logic
**Acceptance Criteria**:
- [ ] Create `src/auth/login.ts`
- [ ] Implement `authenticateUser(credentials)` function
- [ ] Validate email format
- [ ] Query user from database
- [ ] Verify password using bcrypt
- [ ] Generate JWT token
- [ ] Return LoginResponse

**Dependencies**: Task 1, Task 2
**Estimated Time**: 15 minutes
**References**: Spec Section 2 (Happy Path), Section 4 (Implementation)

---

### Task 4: Add Error Handling
**Acceptance Criteria**:
- [ ] Handle invalid credentials (ec_2)
- [ ] Handle network errors (ec_3)
- [ ] Handle database errors
- [ ] Return appropriate LoginError for each case
- [ ] Follow error pattern from `@src/auth/register.ts`

**Dependencies**: Task 3
**Estimated Time**: 10 minutes
**References**: Spec Section 2 (Edge Cases)

---

### Task 5: Create API Endpoint
**Acceptance Criteria**:
- [ ] Open `src/api/routes.ts`
- [ ] Add POST /auth/login route
- [ ] Call `authenticateUser()` from Task 3
- [ ] Return 200 with LoginResponse on success
- [ ] Return 401 for invalid credentials
- [ ] Return 500 for server errors

**Dependencies**: Task 3, Task 4
**Estimated Time**: 10 minutes
**References**: Spec Section 4 (API Contract)

---

## Phase 3: Testing

### Task 6: Write Happy Path Tests
**Acceptance Criteria**:
- [ ] Create `tests/auth/login.test.ts`
- [ ] Test Scenario 1 (Successful Login)
- [ ] Verify JWT token structure
- [ ] Verify response time < 200ms
- [ ] All assertions pass

**Dependencies**: Task 5
**Estimated Time**: 10 minutes
**References**: Spec Section 3 (Scenario 1)

---

### Task 7: Write Error Handling Tests
**Acceptance Criteria**:
- [ ] Test Scenario 2 (Invalid Credentials)
- [ ] Test Scenario 3 (Network Failure)
- [ ] Verify error messages match spec
- [ ] Verify error codes are correct
- [ ] All assertions pass

**Dependencies**: Task 6
**Estimated Time**: 10 minutes
**References**: Spec Section 3 (Scenarios 2-3)

---

### Task 8: Integration Test
**Acceptance Criteria**:
- [ ] Test full login flow end-to-end
- [ ] Mock database responses
- [ ] Verify token storage
- [ ] Verify all edge cases
- [ ] All tests passing

**Dependencies**: Task 7
**Estimated Time**: 10 minutes
**References**: Spec Section 3 (All Scenarios)

---

## Summary

**Total Tasks**: 8
**Total Estimated Time**: 75 minutes
**Phases**: 3 (Setup → Implementation → Testing)
**Critical Path**: Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

**Parallel Opportunities**: None (sequential dependencies)
```

---

#### `review.md` (From Guardian)

```markdown
# Guardian Validation Report

**Spec**: AUTH-001-jwt-login
**Review Date**: 2026-01-06
**Reviewer**: Guardian Agent
**Decision**: APPROVED ✅

---

## Validation Checklist Results

### 1. Context Validation
- [x] All referenced files exist
  - ✓ `src/types/user.ts` exists
  - ✓ `src/auth/register.ts` exists (reference pattern)
  - ✓ `src/api/routes.ts` exists
  - ⚠️ `src/auth/types.ts` does not exist (will be created - OK)
- [x] File versions match expected structure
- [x] No conflicting file names
- [x] Dependencies available
  - ✓ jsonwebtoken@9.0.2 in package.json
  - ✓ bcrypt@5.1.1 in package.json

### 2. Data Model Validation
- [x] Database schemas verified
  - ✓ users table exists
  - ✓ Column: id (uuid, primary key)
  - ✓ Column: email (varchar, unique)
  - ✓ Column: password_hash (varchar)
  - ✓ Column: name (varchar)
  - ⚠️ Column: last_login (does not exist - will be added - OK)
- [x] Type definitions match
  - ✓ User type in `src/types/user.ts:12-18` matches database
- [x] No type name conflicts

### 3. Pattern Alignment
- [x] Error handling follows `src/auth/register.ts:45-67`
- [x] JWT patterns match `src/api/middleware/auth.ts:23-34`
- [x] API response format consistent with existing endpoints
- [x] Password hashing follows existing bcrypt pattern

### 4. Edge Case Coverage
- [x] Invalid credentials → Error pattern exists
- [x] Network errors → Error pattern exists
- [x] Database errors → Error pattern exists
- [x] All edge cases have reference implementations

### 5. Breaking Change Assessment
- [x] No breaking changes to public APIs
- [x] Backward compatible
- [x] Database migration needed: Add `last_login` column (non-breaking, nullable)

### 6. Security Review
- [x] No SQL injection risk (using ORM)
- [x] Password hashing with bcrypt (secure)
- [x] JWT secret from environment variable (secure)
- [x] No sensitive data in logs
- [x] Rate limiting recommended (see notes below)

### 7. Spec Quality Re-Check
- [x] Acceptance criteria are testable
- [x] Tasks in correct dependency order
- [x] No hallucination risk
- [x] Complexity estimates reasonable

### 8. Context Bundle Created
- [x] Identified 6 files for Builder to read
- [x] Extracted relevant patterns
- [x] Documented anti-patterns to avoid
- [x] Context bundle size: 8,200 tokens ✓

---

## Issues Found

### None (Spec is AI-Ready)

---

## Recommendations for Builder

### Pattern to Follow: Error Handling
From `src/auth/register.ts:45-67`:
```typescript
try {
  // Main logic
} catch (error) {
  if (error instanceof ValidationError) {
    return { error: error.message, code: 'VALIDATION_ERROR' };
  }
  if (error instanceof DatabaseError) {
    logger.error('Database error:', error);
    return { error: 'Server error', code: 'SERVER_ERROR' };
  }
  throw error;
}
```

### Pattern to Follow: JWT Generation
From `src/api/middleware/auth.ts:23-34`:
```typescript
const token = jwt.sign(
  { userId: user.id, email: user.email },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);
```

### Recommendation: Rate Limiting
Consider adding rate limiting to prevent brute force attacks:
- Use existing middleware from `src/api/middleware/rateLimit.ts`
- Apply to POST /auth/login route
- Limit: 5 attempts per IP per 15 minutes

---

## Context Bundle Summary

**Files Builder Should Read**:
1. `src/types/user.ts` (lines 12-18: User type)
2. `src/auth/register.ts` (lines 45-67: error pattern)
3. `src/api/middleware/auth.ts` (lines 23-34: JWT pattern)
4. `src/api/routes.ts` (lines 1-20: route structure)
5. `src/db/queries/users.ts` (lines 56-78: user query pattern)
6. `tests/auth/register.test.ts` (lines 34-89: test structure)

**Total Context Size**: 8,200 tokens

See `context.md` for full context bundle.

---

## Database Migration Required

```sql
-- Migration: Add last_login column
ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL;
```

This is non-breaking (nullable column). Can be added before or during implementation.

---

## Decision Matrix

| Criterion | Result |
|-----------|--------|
| All files exist or will be created | ✓ |
| Schemas match | ✓ |
| Patterns aligned | ✓ |
| No security issues | ✓ |
| No breaking changes | ✓ |

**Final Decision**: APPROVED ✅

---

## Next Steps

1. Builder Agent may proceed with implementation
2. Read context bundle from `context.md`
3. Follow patterns documented above
4. Implement tasks in order from `tasks.md`
5. Consider adding rate limiting (recommended but not required)

---

**Guardian Agent Complete**
**Timestamp**: 2026-01-06T10:45:00Z
```

---

#### `context.md` (From Guardian)

```markdown
# Context Bundle for Builder Agent

**Spec**: AUTH-001-jwt-login
**Created**: 2026-01-06
**Size**: 8,200 tokens

This file contains everything the Builder Agent needs to implement the feature without reading the entire codebase.

---

## Files to Read

### 1. `src/types/user.ts` (lines 12-18)
**Purpose**: Understand existing User type structure

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;  // Note: Use this field name
  createdAt: Date;
  updatedAt: Date;
}
```

**Note**: Spec will add `lastLogin: Date | null` field.

---

### 2. `src/auth/register.ts` (lines 45-67)
**Purpose**: Follow this exact error handling pattern

```typescript
export async function registerUser(data: RegisterRequest): Promise<RegisterResponse | AuthError> {
  try {
    // Validate input
    if (!isValidEmail(data.email)) {
      return {
        error: 'Invalid email format',
        code: 'VALIDATION_ERROR'
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await db.users.create({
      email: data.email,
      name: data.name,
      passwordHash
    });

    // Generate token
    const token = generateToken(user);

    return {
      token,
      expiresIn: 3600,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };

  } catch (error) {
    if (error instanceof ValidationError) {
      return { error: error.message, code: 'VALIDATION_ERROR' };
    }
    if (error instanceof DatabaseError) {
      logger.error('Database error:', error);
      return { error: 'Server error', code: 'SERVER_ERROR' };
    }
    throw error;
  }
}
```

**Pattern to copy**:
- Try-catch structure
- Early validation returns
- Specific error codes
- Logging for server errors
- Return type: `Success | Error` union

---

### 3. `src/api/middleware/auth.ts` (lines 23-34)
**Purpose**: Follow this JWT generation pattern

```typescript
import jwt from 'jsonwebtoken';

function generateToken(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: '1h'
    }
  );
}
```

**Pattern to copy**:
- Use environment variable for secret
- Include userId and email in payload
- Set expiration to 1 hour
- Do NOT include password or sensitive data

---

### 4. `src/api/routes.ts` (lines 1-20)
**Purpose**: Follow this route structure

```typescript
import { Router } from 'express';
import { registerUser } from '../auth/register';

const router = Router();

router.post('/auth/register', async (req, res) => {
  const result = await registerUser(req.body);

  if ('error' in result) {
    // Error response
    const statusCode = result.code === 'VALIDATION_ERROR' ? 400 : 500;
    return res.status(statusCode).json(result);
  }

  // Success response
  res.status(200).json(result);
});

export default router;
```

**Pattern to copy**:
- Async route handlers
- Call service function from auth module
- Check for error in result
- Return appropriate status codes:
  - 200: Success
  - 400: Validation error (invalid credentials)
  - 500: Server error

---

### 5. `src/db/queries/users.ts` (lines 56-78)
**Purpose**: Follow this database query pattern

```typescript
import { db } from '../connection';

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await db.query(
    'SELECT id, email, name, password_hash, created_at, updated_at FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
```

**Pattern to copy**:
- Use parameterized queries ($1, $2, etc.)
- Return null if not found (NOT throw error)
- Map snake_case database fields to camelCase
- Select only needed fields

---

### 6. `tests/auth/register.test.ts` (lines 34-89)
**Purpose**: Follow this test structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { registerUser } from '../../src/auth/register';
import { db } from '../../src/db/connection';

describe('Auth: Register User', () => {
  beforeEach(async () => {
    await db.query('DELETE FROM users');
  });

  it('should register user with valid credentials', async () => {
    const result = await registerUser({
      email: 'test@example.com',
      password: 'SecurePass123',
      name: 'Test User'
    });

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    expect(result.user.email).toBe('test@example.com');
  });

  it('should return error for invalid email', async () => {
    const result = await registerUser({
      email: 'invalid-email',
      password: 'SecurePass123',
      name: 'Test User'
    });

    expect(result).toHaveProperty('error');
    expect(result.code).toBe('VALIDATION_ERROR');
  });
});
```

**Pattern to copy**:
- Use Vitest framework
- Clean database before each test
- Test success cases first
- Test error cases separately
- Clear, descriptive test names
- Use async/await

---

## Database Schema

### `users` table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP NULL  -- Add this column (migration needed)
);
```

**Fields you need**:
- `id`: Unique user identifier
- `email`: For login lookup
- `password_hash`: For bcrypt comparison
- `name`: For response payload
- `last_login`: Update this on successful login (new field)

---

## Environment Variables

### Required

```bash
JWT_SECRET=your-secret-key-here
```

**Usage**: JWT signing and verification
**Location**: `.env` file (not committed to git)

---

## Patterns to Follow

### 1. Password Verification

```typescript
import bcrypt from 'bcrypt';

const isValid = await bcrypt.compare(plainPassword, user.passwordHash);
if (!isValid) {
  return { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' };
}
```

### 2. Email Validation

```typescript
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

### 3. Update Last Login

```typescript
await db.query(
  'UPDATE users SET last_login = NOW() WHERE id = $1',
  [user.id]
);
```

---

## Anti-Patterns to Avoid

### ❌ Don't expose password hash

```typescript
// WRONG
return {
  user: {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash  // NEVER include this
  }
};

// CORRECT
return {
  user: {
    id: user.id,
    email: user.email,
    name: user.name
  }
};
```

### ❌ Don't use weak error messages

```typescript
// WRONG - Reveals which part failed
return { error: 'User not found' };  // Tells attacker email doesn't exist

// CORRECT - Ambiguous message
return { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' };
```

### ❌ Don't log sensitive data

```typescript
// WRONG
logger.info('Login attempt:', { email, password });  // NEVER log password

// CORRECT
logger.info('Login attempt:', { email });
```

---

## Dependencies Already Installed

```json
{
  "jsonwebtoken": "^9.0.2",
  "bcrypt": "^5.1.1",
  "express": "^4.18.2"
}
```

No new dependencies needed.

---

## Performance Targets

From spec acceptance criteria:
- Response time: < 200ms (average)
- Test this in integration tests

---

## Security Notes

### Rate Limiting (Recommended)
Consider adding to `src/api/routes.ts`:

```typescript
import { rateLimit } from './middleware/rateLimit';

router.post(
  '/auth/login',
  rateLimit({ maxRequests: 5, windowMs: 15 * 60 * 1000 }),
  async (req, res) => {
    // ... handler
  }
);
```

This prevents brute force attacks (5 attempts per 15 minutes).

---

## Summary

**What to build**:
1. Types in `src/auth/types.ts`
2. Login logic in `src/auth/login.ts`
3. Route in `src/api/routes.ts`
4. Tests in `tests/auth/login.test.ts`

**Patterns to copy**:
- Error handling from register.ts
- JWT generation from middleware/auth.ts
- Route structure from routes.ts
- Database queries from db/queries/users.ts
- Test structure from tests/auth/register.test.ts

**Key rules**:
- Never expose password hash
- Use ambiguous error messages
- Update last_login on success
- Follow existing code style

---

**Context Bundle Complete**
**Builder may now proceed with implementation**
```

---

#### `status.json` (Workflow State)

```json
{
  "specId": "AUTH-001-jwt-login",
  "phase": "implementation",
  "workflow": {
    "architect": {
      "status": "completed",
      "timestamp": "2026-01-06T10:30:00Z",
      "version": "1.0"
    },
    "guardian": {
      "status": "approved",
      "timestamp": "2026-01-06T10:45:00Z",
      "decision": "APPROVED",
      "issuesFound": 0
    },
    "builder": {
      "status": "in_progress",
      "timestamp": "2026-01-06T10:50:00Z",
      "tasksCompleted": 3,
      "tasksTotal": 8,
      "currentTask": "Task 4: Add Error Handling",
      "blockers": []
    }
  },
  "tasks": [
    { "id": 1, "status": "completed", "completedAt": "2026-01-06T10:52:00Z" },
    { "id": 2, "status": "completed", "completedAt": "2026-01-06T10:55:00Z" },
    { "id": 3, "status": "completed", "completedAt": "2026-01-06T11:05:00Z" },
    { "id": 4, "status": "in_progress", "startedAt": "2026-01-06T11:05:00Z" },
    { "id": 5, "status": "pending" },
    { "id": 6, "status": "pending" },
    { "id": 7, "status": "pending" },
    { "id": 8, "status": "pending" }
  ],
  "metadata": {
    "estimatedCompletion": "2026-01-06T11:45:00Z",
    "complexity": "Medium",
    "level": 2
  }
}
```

---

## Advanced Patterns

### Pattern 1: Parallel Builder Agents

For large features with independent tasks, run multiple builders simultaneously:

```
Guardian approves spec with 12 tasks
  ↓
Task Analysis:
- Tasks 1-4: Backend API (no UI dependencies)
- Tasks 5-8: Frontend Components (no backend dependencies during dev)
- Tasks 9-12: Tests (depend on 1-8, but can prepare in parallel)
  ↓
┌─────────────────────────────────────────┐
│ Launch 3 Builder Agents in Parallel:    │
│                                          │
│ [BUILDER-BACKEND]                        │
│ • Context: API patterns only             │
│ • Tasks: 1-4                             │
│ • Outputs: src/api/*                     │
│                                          │
│ [BUILDER-FRONTEND]                       │
│ • Context: UI patterns only              │
│ • Tasks: 5-8                             │
│ • Outputs: src/components/*              │
│                                          │
│ [BUILDER-TESTS]                          │
│ • Context: Test patterns                 │
│ • Tasks: 9-12                            │
│ • Outputs: tests/*                       │
└─────────────────────────────────────────┘
  ↓
All complete → Integration verification
```

**Benefits**:
- 3x faster implementation
- Each builder has 1/3 the context
- Truly parallel execution
- Merge conflicts minimized (different file areas)

---

### Pattern 2: Context Bundle Caching

Guardian can create reusable context bundles for common patterns:

```
First Feature: "User Login"
  ↓
Guardian creates:
- specs/AUTH-001-jwt-login/context.md (auth-specific)
- specs/_shared/auth-patterns.md (reusable)
  ↓
Second Feature: "User Logout"
  ↓
Guardian references:
- specs/_shared/auth-patterns.md (cached!)
- Only adds logout-specific context
  ↓
Third Feature: "Password Reset"
  ↓
Guardian references:
- specs/_shared/auth-patterns.md (cached!)
- Only adds password-specific context
```

**Benefits**:
- Faster Guardian validation (less re-reading)
- Consistent patterns across features
- Knowledge base grows over time
- Reduced token usage

---

### Pattern 3: Complexity-Based Agent Routing

Not all features need all three agents:

```
┌─────────────────────────────────────────┐
│ LEVEL 1 (The Nut): Bug fixes            │
│ Route: User → Architect → Builder       │
│ Guardian: SKIP (low risk)                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ LEVEL 2 (The Feature): Standard features│
│ Route: User → Architect → Guardian → Builder
│ Guardian: REQUIRED (validation)          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ LEVEL 3 (The Epic): Architectural changes│
│ Route: User → Architect → Guardian → Human → Builder
│ Guardian: REQUIRED + Human approval      │
└─────────────────────────────────────────┘
```

**Decision Matrix**:

| Complexity | Files Affected | Agent Path |
|------------|----------------|------------|
| Level 1 | 1-2 files | Architect → Builder |
| Level 2 | 3-10 files | Architect → Guardian → Builder |
| Level 3 | 10+ files OR breaking changes | Architect → Guardian → Human → Builder |

---

### Pattern 4: Incremental Context Loading (Builder)

Builder doesn't load all context at once - it loads per task:

```
Builder working on 8-task feature:
  ↓
Task 1: "Create types"
  Load: type examples (~1000 tokens)
  ↓
Task 2: "Implement logic"
  Load: logic patterns (~3000 tokens)
  ↓
Task 3: "Add API endpoint"
  Load: API patterns (~2000 tokens)
  ↓
Task 4: "Write tests"
  Load: test patterns (~2000 tokens)

Total max context at any time: 3000 tokens
vs. Loading all at once: 8000 tokens
```

**Implementation**:
```markdown
# context.md structure

## Task 1 Context
[Only what Task 1 needs]

## Task 2 Context
[Only what Task 2 needs]

## Task 3 Context
[Only what Task 3 needs]

...
```

Builder reads only the section for current task.

---

### Pattern 5: Guardian as Continuous Validator

Guardian doesn't just validate once - it can re-validate during implementation:

```
Builder completes Task 4 of 8
  ↓
Builder: "Checkpoint - validate progress"
  ↓
Guardian:
- Reads code written so far
- Checks against spec
- Verifies no drift
- Approves or suggests correction
  ↓
Builder continues with Tasks 5-8
```

**When to use**:
- Long feature implementations (10+ tasks)
- High-risk features (security, data integrity)
- Learning scenarios (new patterns being introduced)

---

## Implementation Guide

### Option 1: AI Coding Assistant Custom Agents

Create three agent definition files:

```
agents/definitions/
├── architect.md
├── guardian.md
└── builder.md
```

Use the prompt templates from the "Agent Definitions" section above.

**Invocation**:
```
User: "Build JWT login feature"
  ↓
Claude: [Launches Architect agent]
Architect completes → specs/AUTH-001/spec.md
  ↓
Claude: [Launches Guardian agent with spec path]
Guardian completes → specs/AUTH-001/review.md (APPROVED)
  ↓
Claude: [Launches Builder agent with context bundle]
Builder completes → Implementation done
```

---

### Option 2: Coordinated Workflow (Manual)

Use the AI coding assistant's main instance as coordinator:

```
User: "Build JWT login feature"
  ↓
Orchestrator: "I'll coordinate the multi-agent workflow:

Step 1: Launching Architect Agent...
[Switches to Architect mode with system prompt]
...Architect completes spec...

Step 2: Launching Guardian Agent...
[Switches to Guardian mode with system prompt]
...Guardian validates and approves...

Step 3: Launching Builder Agent...
[Switches to Builder mode with system prompt]
...Builder implements code...

Done! Feature implemented following SDD protocol."
```

---

### Option 3: Separate Sessions (Distributed)

Run each agent in separate Claude sessions:

**Session 1 (Architect)**:
```
User: "Create spec for JWT login"
Architect: [Creates spec.md and tasks.md]
User: [Saves files to specs/AUTH-001/]
```

**Session 2 (Guardian)**:
```
User: "Validate specs/AUTH-001/spec.md"
Guardian: [Reads spec, validates, creates review.md and context.md]
User: [Reviews approval decision]
```

**Session 3 (Builder)**:
```
User: "Implement specs/AUTH-001/spec.md using context bundle"
Builder: [Reads spec and context, implements code]
User: [Reviews implementation]
```

**Benefits**:
- Ultimate separation of concerns
- Can use different Claude instances/API keys
- Easy to audit each agent's work
- Can run on different machines/times

---

### Option 4: Hybrid (MCP + Agents)

Combine MCP with agent definitions for optimal context pulling:

```
agents/definitions/
├── architect.md (uses filesystem MCP)
├── guardian.md (uses filesystem + postgres MCP)
└── builder.md (uses filesystem MCP)

Each agent configured with MCP access:
- Architect: Read-only filesystem (folders only)
- Guardian: Read-only filesystem (full) + database
- Builder: Read/write filesystem + read-only database
```

**MCP Configuration for Each Agent**:
```json
{
  "architect": {
    "mcp": ["filesystem-readonly-folders"]
  },
  "guardian": {
    "mcp": ["filesystem-readonly", "postgres-readonly"]
  },
  "builder": {
    "mcp": ["filesystem-readwrite", "postgres-readonly"]
  }
}
```

---

## Open Questions & Future Evolution

### Questions for Community Exploration

#### 1. Agent Communication
**Current**: File-based only (specs directory)

**Question**: Should agents have a message bus for real-time coordination?

**Pros**:
- Faster feedback loops
- Dynamic context updates
- Better blocker resolution

**Cons**:
- Harder to audit
- More complex implementation
- Loses async capability

**Proposed Solution**: Hybrid - file-based for artifacts, optional event bus for notifications

---

#### 2. Human-in-the-Loop Gates

**Question**: Where should human approval be required?

**Options**:
- A: After Architect creates spec (before Guardian)
- B: After Guardian review (before Builder)
- C: Never (full automation)
- D: Only for Level 3 complexity or ESCALATE decisions

**Proposed**: Option D (complexity-based)
- Level 1: No human approval needed
- Level 2: Optional approval after Guardian
- Level 3: Required approval after Guardian
- ESCALATE: Always requires human

---

#### 3. Builder Agent Specialization

**Question**: Should Builder agents specialize by domain?

**Current**: One generic Builder agent

**Proposed Specialization**:
```
agents/definitions/
├── builder-backend.md (API, database, services)
├── builder-frontend.md (UI, components, state)
├── builder-database.md (Migrations, schemas)
├── builder-tests.md (Test suites)
└── builder-docs.md (Documentation)
```

**Benefits**:
- Even more focused context
- Parallel execution by domain
- Domain-specific patterns

**Cons**:
- More complex coordination
- Potential integration issues
- Harder to maintain

**Decision Point**: Test with single Builder first, specialize if needed

---

#### 4. Context Bundle Format

**Question**: Should context bundles be structured data or markdown?

**Current**: Markdown files

**Alternative**: JSON/YAML structure
```json
{
  "contextBundle": {
    "files": [
      {
        "path": "src/auth/register.ts",
        "lines": "45-67",
        "purpose": "Error handling pattern",
        "snippet": "..."
      }
    ],
    "schemas": { ... },
    "patterns": { ... },
    "antiPatterns": { ... }
  }
}
```

**Pros**:
- Machine-parseable
- Easier programmatic access
- Versioning and diffing

**Cons**:
- Less human-readable
- More verbose
- Harder to manually edit

**Proposed**: Keep Markdown for now, consider structured format for tooling layer

---

#### 5. Spec Versioning & Evolution

**Question**: How should specs evolve when implementation discovers issues?

**Current**: Create new version (spec-v2.md)

**Alternative Strategies**:
- Git-style: Branch spec, merge after validation
- Append-only: Add amendments, never modify original
- Living document: Update in place with changelog section

**Proposed**:
```markdown
# Specification: Feature Name

**Version**: 2.1
**Status**: Implemented

## Changelog
- v2.1 (2026-01-06): Added rate limiting requirement (Builder blocker resolution)
- v2.0 (2026-01-05): Revised error handling (Guardian rejection)
- v1.0 (2026-01-04): Initial spec (Architect)

[Rest of spec...]
```

---

#### 6. Guardian Intelligence Level

**Question**: Should Guardian be reactive or proactive?

**Current**: Reactive (validates what Architect created)

**Proactive Option**: Guardian suggests improvements
```markdown
# Guardian Review

## Decision: APPROVED_WITH_SUGGESTIONS

## Validation: PASS

## Proactive Recommendations:
1. Consider adding pagination (spec doesn't mention it, but list endpoints usually need it)
2. Suggest caching strategy (this endpoint will be hit frequently)
3. Recommend adding monitoring (business-critical endpoint)
```

**Risk**: Scope creep, feature inflation

**Proposed**: Proactive mode as optional flag for experienced teams

---

#### 7. Context Window Management Strategy

**Question**: What happens when context bundle exceeds Builder's capacity?

**Current**: Guardian creates focused bundles (~8K tokens)

**Problem**: Complex features might need >20K context

**Solutions**:
- A: Split into multiple sub-features (recommended)
- B: Incremental context loading (Builder loads per task)
- C: Use smaller model for Builder (Haiku instead of Sonnet)
- D: Context compression techniques

**Proposed**: Combination of A + B
- Guardian warns if context >15K
- Suggests splitting into sub-features
- If unavoidable, use incremental loading

---

#### 8. Testing Strategy

**Question**: Who writes tests - Builder or separate Test Agent?

**Current**: Builder writes tests as part of tasks

**Alternative**: Dedicated Test Agent
```
Architect → Guardian → Builder → Tester
                                    ↓
                            Writes comprehensive tests
                            based on acceptance criteria
```

**Pros of separate Tester**:
- More thorough testing
- Builder focuses on implementation
- Test-driven development possible

**Cons**:
- Another agent to coordinate
- More context handoff
- Slower overall flow

**Proposed**: Start with Builder writing tests, add Tester agent for Level 3 complexity

---

#### 9. Rollback & Recovery

**Question**: What happens if Builder's implementation fails tests?

**Current**: Builder debugs and fixes

**Alternative**: Structured rollback
```
Builder implements → Tests fail
  ↓
Guardian re-validates spec
  ↓
If spec is wrong: → Architect revises
If implementation is wrong: → Builder fixes with guidance
```

**Proposed Protocol**:
```
1. Builder runs tests
2. If tests fail:
   a. Builder attempts fix (max 2 attempts)
   b. If still failing: Create blocker.md
   c. Guardian investigates:
      - Is spec unclear? → Back to Architect
      - Is implementation wrong? → Specific guidance for Builder
      - Is test wrong? → Update test
```

---

#### 10. Metrics & Observability

**Question**: How do we measure multi-agent effectiveness?

**Proposed Metrics**:
```json
{
  "metrics": {
    "timeToImplementation": {
      "architect": "3m",
      "guardian": "2m",
      "builder": "8m",
      "total": "13m"
    },
    "tokenUsage": {
      "architect": 3700,
      "guardian": 11000,
      "builder": 12500,
      "total": 27200
    },
    "quality": {
      "specScore": 2.0,
      "testsPassingFirstRun": true,
      "blockers": 0,
      "revisions": 0
    },
    "efficiency": {
      "tokensPerFeature": 27200,
      "vsMonolithic": "54% reduction",
      "parallelizationOpportunities": 0
    }
  }
}
```

Track in `specs/[ID]/metrics.json`

---

### Future Enhancement Ideas

1. **Agent Learning**: Agents improve over time by analyzing past specs
2. **Spec Templates Library**: Auto-suggest templates based on feature type
3. **Dependency Graph**: Automatic task ordering based on file dependencies
4. **Risk Scoring**: Guardian assigns risk scores to guide human review priority
5. **Context Prefetching**: Guardian loads common patterns before Builder starts
6. **Collaborative Editing**: Multiple humans review and edit specs in real-time
7. **Spec Marketplace**: Share proven specs across teams/organizations
8. **Visual Workflow**: GUI for tracking multi-agent progress
9. **A/B Testing**: Generate multiple spec variations, compare outcomes
10. **Compliance Checking**: Guardian validates against security/legal requirements

---

## Conclusion

The Multi-Agent SDD Protocol represents a fundamental shift from monolithic AI workflows to specialized, coordinated agent systems. By separating planning, validation, and implementation into distinct agents with bounded contexts:

- **Token usage drops 50%+** through focused contexts
- **Quality improves** through structural guardrails
- **Parallelization becomes possible** for complex features
- **Error recovery is systematic** through defined protocols
- **Knowledge compounds** through reusable context bundles

This protocol is designed to evolve with community input. The open questions above represent active areas of exploration as teams adopt and adapt this workflow to their needs.

---

**Next Steps to Implement**:
1. Create agent definition files (`agents/definitions/`)
2. Build first spec using Architect agent
3. Validate with Guardian agent
4. Implement with Builder agent
5. Document learnings and refine protocol

**Join the Evolution**: This is Artifact #6 of Odin - contribute patterns, solutions to open questions, and real-world learnings to make this protocol even better.

---

**Version**: 2.0
**Status**: Implemented (CHECKPOINT 6.5)
**Last Updated**: 2026-01-16
**Contributors**: Odin Community
