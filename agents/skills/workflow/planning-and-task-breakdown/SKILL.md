---
name: planning-and-task-breakdown
description: Decompose a spec into small, ordered, reviewable tasks with acceptance criteria.
category: workflow
version: "1.0"
---

# planning-and-task-breakdown

## When To Use

- A spec exists and needs implementation steps.
- Work spans multiple files or phases.
- The change needs to be split for reviewability.

## Workflow

1. Restate the target outcome and constraints.
2. Identify dependencies and risky unknowns.
3. Break work into vertical slices that each produce observable progress.
4. Keep each task small enough to review independently.
5. Define acceptance criteria and verification for each task.
6. Order tasks to de-risk early and avoid large hidden integration steps.
7. Mark tasks that need user confirmation, external credentials, or production access.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "I'll just do it all at once." | Large changes hide defects and are hard to review. |
| "The tasks are obvious." | If they are obvious, they are cheap to write down. |
| "Testing can be one final step." | Verification belongs to each slice, not just the end. |

## Verification

- Every task has an outcome, acceptance criteria, and check.
- Dependencies are explicit.
- No task requires unrelated refactoring to be reviewable.

## Exit Criteria

- Implementation can proceed one slice at a time with clear stopping points.
