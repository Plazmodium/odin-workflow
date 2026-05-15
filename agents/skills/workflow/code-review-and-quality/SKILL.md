---
name: code-review-and-quality
description: Review code for correctness, safety, maintainability, tests, and reviewability before merge.
category: workflow
version: "1.0"
---

# code-review-and-quality

## When To Use

- Reviewing a diff or pre-merge change.
- Asked for a review.
- A change is complete enough to evaluate.

## Workflow

1. Determine the intended behavior and changed files.
2. Review for correctness and edge cases.
3. Review for safety: security, data loss, concurrency, migrations, and trust boundaries.
4. Review for maintainability: clarity, names, scope, complexity, and local conventions.
5. Review tests and verification evidence.
6. Review change size; recommend splitting large or unrelated diffs.
7. Report findings first, ordered by severity with file/line references.
8. Use severity labels: Critical, Major, Minor, Nit, Optional, FYI.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "Tests pass, ship it." | Passing tests are evidence, not a review. |
| "The diff is too large to inspect closely." | Large diffs should be split, not rubber-stamped. |
| "This is only a nit." | Label nits as nits so real blockers stay visible. |

## Verification

- Findings cite concrete code locations.
- No speculation is presented as fact.
- Missing tests or verification gaps are explicit.

## Exit Criteria

- A human can decide whether the change is safe to merge.
