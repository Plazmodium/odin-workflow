---
name: unit-tests-eval-sdd
description: Mandatory unit test evaluation protocol for Reviewer. Scores test quality, verifies compliance, and sends weak test implementations back to Builder for rework.
category: testing
compatible_with:
  - vitest
  - jest
  - react-patterns
  - nextjs-dev
  - nodejs-fastify
---

# Unit Test Evaluation Protocol

Use this skill during Reviewer when the feature includes new or changed tests.

## Reviewer Goal

Do not only ask whether tests exist. Judge whether the tests are strong enough to trust the implementation.

## Required Review Flow

1. Verify test files exist for changed production code.
2. Verify tests pass with the repo-native test command.
3. Verify lint/type expectations relevant to tests still pass.
4. Inspect the changed source and the corresponding tests.
5. Evaluate test quality across these dimensions:
   - coverage quality
   - assertion specificity
   - Arrange / Act / Assert structure
   - mock hygiene
   - naming quality
   - async correctness
   - fixture/data quality
6. Decide whether the test suite is acceptable, acceptable with recommendations, or needs Builder rework.

## Automatic Rework Triggers

Send the feature back to Builder when any of these are true:

- changed production code has no meaningful unit tests
- tests are failing
- coverage is below the project hard gate
- assertions are mostly vague or vacuous
- tests rely on implementation details instead of behavior
- mocks bleed between tests or mock the unit under test
- async behavior is unawaited, flaky, or only partially covered

## Reviewer Output Expectations

- Cite concrete evidence: file paths, line numbers, and command output.
- Separate blocking issues from non-blocking recommendations.
- If test quality is insufficient, record `needs_rework` and send the workflow back to Builder.
- If tests are acceptable, still capture recommendations for the next iteration.

## Minimal Scoring Rubric

- `PASS`: tests are trustworthy and compliant
- `PASS_WITH_RECOMMENDATIONS`: acceptable now, but improvements are still warranted
- `NEEDS_REWORK`: Builder must fix tests before integration
- `ESCALATE`: test evidence reveals a deeper production bug or ambiguous requirement

## Reviewer Checklist

- [ ] Test files present for changed code
- [ ] Tests pass
- [ ] Coverage meets hard gate
- [ ] Assertions are specific
- [ ] Mock cleanup is correct
- [ ] Async paths are handled correctly
- [ ] Result is either approved or routed back to Builder with precise feedback

Use this skill alongside security review. Weak tests are a workflow-quality issue and should block progression just like important review findings.
