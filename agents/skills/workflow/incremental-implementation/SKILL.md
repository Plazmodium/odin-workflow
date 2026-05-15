---
name: incremental-implementation
description: Build changes in thin vertical slices with verification after each slice.
category: workflow
version: "1.0"
---

# incremental-implementation

## When To Use

- Any change touches more than one file.
- A feature can be delivered in smaller observable increments.
- The risk of a large diff outweighs the speed of one-shot implementation.

## Workflow

1. Confirm scope and the next smallest useful slice.
2. Inspect existing patterns before editing.
3. Implement only the slice currently in scope.
4. Preserve behavior outside the slice.
5. Verify the slice with the smallest relevant check.
6. Record evidence and remaining work.
7. Repeat only if the next slice is still within the request.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "It is faster to implement everything." | Unverified bulk changes are slower to debug and review. |
| "I should clean up adjacent code while here." | Adjacent cleanup is scope drift unless required for the slice. |
| "I'll verify after all slices." | Per-slice verification localizes failures. |

## Verification

- Each slice has a named check: test, typecheck, lint, build, or runtime inspection.
- Changed behavior is tied to acceptance criteria.
- Remaining work is explicit.

## Exit Criteria

- The implemented slice is correct, bounded, and independently reviewable.
