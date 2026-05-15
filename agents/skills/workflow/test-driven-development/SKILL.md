---
name: test-driven-development
description: Use red-green-refactor, test pyramid discipline, and behavior-focused tests for logic changes and bug fixes.
category: workflow
version: "1.0"
---

# test-driven-development

## When To Use

- Implementing behavior, fixing bugs, or changing logic.
- A regression needs to stay fixed.
- Existing tests do not cover the acceptance criteria.

## Workflow

1. Identify the behavior that must be proven.
2. Write the smallest failing test first when practical.
3. Run it and confirm it fails for the expected reason.
4. Write the minimum code needed to pass.
5. Run the focused test and then the smallest relevant broader check.
6. Refactor only with tests green.
7. Prefer the test pyramid: mostly unit, some integration, few end-to-end.
8. Keep tests DAMP: readable as specifications, even with some duplication.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "I'll write tests later." | Later is where tests disappear. Write the proving test now. |
| "This is just plumbing." | Infrastructure changes can break behavior and need proof. |
| "Mocks are enough." | Mock-heavy tests can prove implementation details, not behavior. |
| "The UI looked fine once." | Manual observation is useful evidence, not a replacement for durable tests. |

## Verification

- The test fails before the fix when feasible.
- The test passes after the fix.
- The test asserts user-visible or domain behavior, not incidental structure.

## Exit Criteria

- Correct behavior is protected by an appropriate test or a clearly justified verification alternative.
