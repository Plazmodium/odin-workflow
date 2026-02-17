# Shared Agent Context

This file contains common patterns and references shared across all SDD agents. Each agent definition references this file rather than duplicating the content.

---

## Hybrid Orchestration Model

Odin uses a **hybrid orchestration** model:
- **You (Agent)**: Create artifacts (specs, reviews, code, docs) + document state changes needed
- **Main Session (Orchestrator)**: Manages workflow state via MCP

**Why**: Sub-agents spawned via task/agent tools cannot access MCP servers. Only the main orchestrator session can call MCP tools.

**Your responsibility**: At the end of your artifact, include a `## State Changes Required` section listing all state changes the orchestrator should make.

---

## State Changes Required — Template

Every agent artifact must end with this section:

```markdown
---
## State Changes Required

### 1. Track Duration
- **Phase**: [0-8]
- **Agent**: [Your agent name]
- **Operation**: [Brief description]

### 2. Transition Phase (if applicable)
- **Feature ID**: [ID]
- **From Phase**: [N]
- **To Phase**: [N+1]
- **Transitioned By**: [Agent name]

### 3. Create Blocker (if applicable)
- **Blocker Type**: [SPEC_AMBIGUITY | MISSING_CONTEXT | TECHNICAL_IMPOSSIBILITY | EXTERNAL_DEPENDENCY | INTEGRATION_CONFLICT | DURATION_EXCEEDED | ITERATION_LIMIT_EXCEEDED | QUALITY_GATE_REJECTED | OTHER]
- **Phase**: [N]
- **Severity**: [LOW | MEDIUM | HIGH | CRITICAL]
- **Title**: [Short description]
- **Description**: [Details + what's needed to resolve]
- **Created By**: [Agent name]
```

---

## Duration Tracking

Agent work duration is tracked automatically by the orchestrator using `start_agent_invocation` and `end_agent_invocation`. You do not need to self-report duration or token usage.

**If an operation is taking excessively long** (e.g., unbounded iteration, runaway complexity):
- Stop and document a `DURATION_EXCEEDED` blocker
- Include what was completed and what remains

---

## Memory Candidates

Document project knowledge discovered during your work. The orchestrator will prompt the user to save these as permanent memories.

**When to document**: Architecture insights, integration patterns, tech stack decisions, performance baselines, security requirements, gotchas found.

```markdown
### Memory Candidates

**ARCHITECTURE**: [Insight about system architecture]
**Tags**: [relevant, tags]

**PATTERN**: [Reusable pattern discovered]
**Tags**: [pattern, category]
```

---

## Skills — Mandatory

Skills are **mandatory** for all agents. The orchestrator injects domain-specific skills into your context under `## Active Skills`. If no specific tech stack skills match, the `generic-dev` fallback skill is injected.

Always follow patterns, conventions, and best practices from your injected skills.

---

## Build Verification — Dual-Check Convention

Both the **Builder** and **Integrator** agents must verify the build passes. This provides defense-in-depth:

1. **Builder (Step 5a)**: Runs `npm run build` after completing all code changes. Catches TypeScript errors, import issues, and configuration problems before handoff. If the build fails, the Builder fixes the issue — no phase transition until the build passes.

2. **Integrator (Step 6)**: Runs the build again as a second verification. Also performs runtime verification (Step 6b) to catch issues that pass the build but fail at runtime (e.g., stale data, caching, missing env vars).

**Why both?** A build failure caught by the Builder saves a full phase transition round-trip. The Integrator's second check catches regressions or environment-specific issues.

---

## Git Branch Management

Odin tracks git branches per feature. When a feature is created, a branch name is generated:
- **With dev initials**: `{initials}/feature/{FEATURE-ID}` (e.g., `jd/feature/AUTH-001`)
- **Without initials**: `feature/{FEATURE-ID}` (e.g., `feature/AUTH-001`)

The orchestrator creates the git branch **BEFORE calling `create_feature()`**. The branch must exist before the DB record is created:
```
# 1. Create branch FIRST
git checkout -b {dev_initials}/feature/{FEATURE-ID}

# 2. Only after branch exists, create the DB record
SELECT * FROM create_feature(...);
```

> **CRITICAL**: If branch creation fails, do NOT call `create_feature()`. A dead DB record with no branch is worse than no record at all.

Agents that interact with git should:
1. **Orchestrator**: Create the feature branch FIRST, then call `create_feature()` — do NOT defer branch creation to Builder
2. **Builder**: Commit after each task, include commit tracking in State Changes
3. **Integrator**: Verify build and runtime on the feature branch
4. **Release**: Create PR via `gh pr create`, request human review — **NEVER merge PRs**

### Developer Identity

The `dev_initials` and `author` parameters must identify the real human developer. **Never guess or use placeholders.** To obtain them:
1. Check `git config user.name` and derive initials
2. Check recent features: `SELECT dev_initials, author FROM features WHERE dev_initials IS NOT NULL ORDER BY created_at DESC LIMIT 1`
3. Ask the developer if neither source is available

### Commit Tracking

After each commit, document it in State Changes Required:

```markdown
### Record Commit
- **Feature ID**: AUTH-001
- **Commit Hash**: abc123
- **Phase**: 4 (Builder)
- **Message**: feat(AUTH-001): implement login endpoint
- **Files Changed**: 5
- **Insertions**: 120
- **Deletions**: 30
```

The orchestrator records commits via `record_commit()` in Supabase.

---

## CRITICAL: NEVER Auto-Merge Pull Requests

**Agents can CREATE pull requests but NEVER merge them.**

PR merging is ALWAYS a human decision. This applies to ALL agents with git/gh access. No exceptions. No "auto-merge if tests pass." No "merge if approved." NEVER.

- **Release agent**: Creates PR via `gh pr create`, records PR URL via `record_pr()`, then STOPS
- **Human**: Reviews, approves, and merges the PR
- **After merge**: Human (or agent on instruction) calls `record_merge()` to update tracking

---

## Learning Creation — Mandatory for Bug Fixes

**Every bug fix MUST create a learning.** Before closing any fix, ask yourself:

> *Is this a learning? If the fix involved a non-obvious cause, a gotcha, or a pattern others would hit — create a learning and declare propagation targets.*

Include in your artifact's Memory Candidates section:
- **Category**: GOTCHA, PATTERN, CONVENTION, etc.
- **Title**: Concise description of the insight
- **Content**: What happened, why, and how to avoid it
- **Propagation targets**: Which skills, agent definitions, or AGENTS.md should receive this

**When in doubt, create the learning.** It's better to have a low-importance learning than to lose a hard-won insight.

---

## Post-Release Verification

After the Release phase completes, the orchestrator should verify the deployed/running application shows correct data. This includes:

1. **Spot-check a known DB value** against the rendered output (e.g., a feature's status in Supabase vs. what the dashboard shows)
2. **Verify key pages render** without errors
3. **Check data freshness** — ensure the UI reflects recent changes, not cached stale data

If bugs are found post-release:
1. Create a **new L1 feature** to track the fix (don't fix ad-hoc without tracking)
2. The fix feature MUST create a learning before completion
3. The learning MUST declare propagation targets

---

## CRITICAL: NEVER Skip Phases OR Steps

**All 8 phases must be executed for every feature.** This is enforced at the database level — `transition_phase()` will reject any attempt to skip a phase.

**All steps within each phase must also be executed.** Each agent definition contains a **Mandatory Steps Checklist** that lists every step. No step may be silently skipped.

- Forward transitions must be sequential: 0→1→2→3→4→5→6→7
- Complexity level (L1/L2/L3) affects **depth** within each phase and step, not which phases or steps run
- An L1 phase can be a single sentence, but it must still be recorded
- An L1 step can produce minimal output, but it must still execute
- When documenting State Changes, always use `To Phase: [current + 1]`

**If you think a phase or step is unnecessary**: You're wrong. Execute it briefly. A one-sentence Discovery, a three-line spec, a quick "looks good" Guardian review — these are all valid L1 outputs. If a step truly does not apply (e.g., "Handle Merge Conflicts" when there are none), mark it **N/A** with a one-line justification. Never silently skip it.

---

## Step Execution Protocol

Before each phase, the orchestrator MUST:

1. **Read the agent definition** for the upcoming phase
2. **Identify the Mandatory Steps Checklist** at the top of the agent's process section
3. **Execute every step** in order, or mark it N/A with justification
4. **Never silently skip a step** — if a step seems unnecessary, state why and mark N/A

**Enforcement levels**:
| Level | What | Enforced By | Mechanism |
|-------|------|-------------|-----------|
| Phase | All 8 phases run | Database | `transition_phase()` rejects skips |
| Step | All steps within a phase run | Agent checklist | Orchestrator verifies each step |

**Complexity affects depth, not coverage**:
| Complexity | Phase Depth | Step Depth |
|------------|-------------|------------|
| L1 | 1-3 sentences | Minimal output per step |
| L2 | Full paragraphs | Standard output per step |
| L3 | Comprehensive sections | Detailed output per step |

---

## What ALL Agents Must NOT Do

- Try to call MCP tools directly (you don't have access)
- Skip documenting State Changes Required
- Proceed without skills loaded
- **Skip phases** — all 8 phases must execute, even for L1 tasks (see above)
- **Skip steps** — all steps within your phase must execute, even for L1 tasks (see above)
- Continue past reasonable duration for your phase (document DURATION_EXCEEDED blocker and stop)
- Make up file paths or code patterns — use only what you can verify from context
- Override decisions made in earlier phases
- **Merge pull requests** — PR merging is ALWAYS a human decision (see above)
- **Skip learning creation after bug fixes** — every fix is a potential learning (see above)
- **Continue work after PR creation** — When a feature is complete and a PR has been created, ALL work MUST stop. Do NOT switch branches, start the next task, stash changes, or begin planning. Report the PR URL and EVAL score, then STOP and wait for the developer to review and merge. The ONLY exception is if the developer explicitly says "continue."
