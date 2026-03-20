---
name: unit-tests-sdd
description: Mandatory unit test generation protocol for Builder. Enforces guardrails, coverage gates, assertion quality, and escalation rules so code changes always ship with meaningful tests.
category: testing
compatible_with:
  - vitest
  - jest
  - react-patterns
  - nextjs-dev
  - nodejs-fastify
---

# Unit Test Generation Protocol

Use this skill whenever Builder changes production code. Tests are not optional.

## Required Outcome

- Add or update unit tests for every code-changing task.
- Cover acceptance criteria, edge cases, happy paths, and failure paths.
- Run the repo-native test command and lint/type checks relevant to tests.
- Stop and escalate if tests cannot be made green without changing production code in ways the spec did not authorize.

## Hard Guardrails

- Never skip tests for code changes.
- Never modify production code only to make a bad test pass.
- Never delete or weaken an existing passing test just to get green.
- Never use `any`, `@ts-ignore`, or `@ts-expect-error` as shortcuts in tests.
- Never use vacuous assertions like `expect(true).toBe(true)`.
- Never rely on snapshots as the main proof of behavior.
- Never mock the module under test; mock dependencies only.
- Never leave `.only`, `.skip`, `console.log`, `debugger`, or sleep-style delays in committed tests.

## Build Workflow

1. Read the source file fully before writing tests.
2. Identify exports, branches, async behavior, and error paths.
3. Add or update colocated test files following repo conventions.
4. Use clear `describe` / `it` names tied to observable behavior.
5. Follow Arrange / Act / Assert in each non-trivial test.
6. Run the repo-native test command with coverage.
7. Run the repo-native lint command if tests or linted files changed.
8. If coverage is below the project hard gate, add tests or escalate.

## Coverage Expectations

- Meet the project's hard coverage gates at minimum.
- Aim for near-complete coverage on the changed unit.
- Cover both success and failure branches.
- Document genuine coverage gaps explicitly; do not hide them with meaningless tests.

## Assertion Rules

- Prefer exact assertions over truthy/falsy checks.
- Assert outputs, visible UI, callback args, and thrown/rejected errors.
- Avoid implementation-detail assertions on private state or internals.
- For mocks, prefer argument assertions such as `toHaveBeenCalledWith(...)`.

## Async Rules

- Make async tests `async` and await real async work.
- Test both resolved and rejected branches.
- Use framework-native async helpers (`waitFor`, fake timers, `act`) instead of arbitrary delays.
- Restore timers and mocks in teardown.

## Escalate Immediately When

- A correct test exposes a production bug.
- The test cannot pass without unauthorized production-code changes.
- Coverage gates remain below threshold after good-faith testing.
- The mocking strategy is ambiguous or would violate project guardrails.

## Builder Checklist

- [ ] Tests added or updated for the change
- [ ] Acceptance criteria covered
- [ ] Error paths covered
- [ ] Coverage checked
- [ ] Test command passed
- [ ] Lint/type checks relevant to tests passed

Pair this skill with the repo's detected test framework skill such as `vitest` or `jest`.
