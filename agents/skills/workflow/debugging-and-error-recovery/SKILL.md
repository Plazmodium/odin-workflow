---
name: debugging-and-error-recovery
description: Reproduce, localize, reduce, fix, and guard failures without guessing or masking errors.
category: workflow
version: "1.0"
---

# debugging-and-error-recovery

## When To Use

- Tests, builds, runtime behavior, or user reports fail.
- The root cause is unknown.
- A previous attempted fix did not work.

## Workflow

1. Reproduce the failure with the smallest reliable command or flow.
2. Capture exact error text, inputs, environment, and expected behavior.
3. Localize the failing component or boundary.
4. Reduce the case to the smallest meaningful example.
5. Fix the root cause, not the symptom.
6. Add a regression guard when feasible.
7. Rerun the failing check and the smallest relevant surrounding check.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "I know what's wrong." | Reproduce first or risk fixing the wrong thing. |
| "I'll just silence the error." | Masking errors converts visible failures into latent defects. |
| "The first fix passed once." | Verify the guard and adjacent behavior. |

## Verification

- Failure was reproduced or clearly not reproducible.
- Root cause is tied to evidence.
- The fix has a passing check and, when feasible, a regression test.

## Exit Criteria

- The failure is fixed, guarded, and explained.
