---
name: git-workflow-and-versioning
description: Keep changes atomic, reviewable, trunk-friendly, and safe within the repository's VCS conventions.
category: workflow
version: "1.0"
---

# git-workflow-and-versioning

## When To Use

- Preparing or reviewing code changes.
- Creating commits, branches, tags, or release points when explicitly requested.
- Checking repository state before risky work.

## Workflow

1. Check for `.jj/` before any VCS command; prefer `jj` when colocated unless git is required.
2. Inspect status before staging or committing.
3. Keep changes atomic: one purpose per diff or commit.
4. Avoid mixing refactors, behavior changes, formatting, and generated output unless required.
5. Do not rewrite history, force push, or delete branches without explicit approval.
6. Use the repository's existing commit and branch conventions.
7. Verify the working tree state after VCS operations.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "I'll include nearby cleanup in the commit." | Mixed commits are hard to review and revert. |
| "Force push is quicker." | Destructive history changes require explicit approval. |
| "Status is unnecessary." | Dirty worktrees may contain user changes. Inspect first. |

## Verification

- VCS status is checked before and after mutations.
- Only intended files are staged or committed.
- No destructive operation occurs without explicit approval.

## Exit Criteria

- Repository history remains safe, atomic, and reviewable.
