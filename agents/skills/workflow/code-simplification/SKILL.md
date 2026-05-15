---
name: code-simplification
description: Reduce complexity safely while preserving behavior, using Chesterton's Fence before removal.
category: workflow
version: "1.0"
---

# code-simplification

## When To Use

- Code works but is hard to read, modify, or review.
- A refactor or cleanup is explicitly requested.
- Complexity blocks a needed change.

## Workflow

1. Define the behavior that must not change.
2. Apply Chesterton's Fence: understand why code exists before removing it.
3. Identify needless branches, indirection, duplication, cleverness, and dead paths.
4. Prefer deletion and clearer control flow over new abstractions.
5. Make one simplification at a time.
6. Run behavior-preserving checks after each meaningful change.
7. Stop when the requested simplification is achieved.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "This looks unused." | Prove it with references, tests, or runtime behavior before deleting. |
| "A new abstraction will clean this up." | Abstractions add surface area; use them only when they reduce real complexity. |
| "Refactors do not need tests." | Behavior-preserving changes need evidence that behavior was preserved. |

## Verification

- Behavior before and after is covered by tests or focused checks.
- Removed code was shown to be unnecessary.
- Complexity decreased without broadening scope.

## Exit Criteria

- The code is simpler and behavior is preserved.
