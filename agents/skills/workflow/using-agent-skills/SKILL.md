---
name: using-agent-skills
description: Route work to the right workflow skill and enforce shared senior-engineering operating rules.
category: workflow
version: "1.0"
---

# using-agent-skills

Use skills as workflows, not reference material. Load only the skills needed for the current phase, then produce evidence before calling work complete.

Inspired by Addy Osmani's Agent Skills article: process over prose, anti-rationalization, verification, progressive disclosure, and scope discipline.

## When To Use

- At the start of a session or slash command.
- When deciding which lifecycle workflow applies.
- When the task is expanding beyond the user's request.

## Workflow

1. Classify the work: define, plan, build, verify, review, simplify, or ship.
2. Load the smallest relevant skill set for that phase.
3. Surface important assumptions before acting.
4. Stop and ask when requirements conflict or missing information materially changes the result.
5. Push back when a request would reduce safety, correctness, maintainability, or reviewability.
6. Prefer the boring, obvious solution.
7. Touch only what the user asked you to touch.
8. End with evidence: tests, typecheck, build, runtime trace, review findings, or a clear explanation of what was not verified.

## Skill Router

| Situation | Load |
| --- | --- |
| Vague idea | `idea-refine` |
| Feature or significant change | `spec-driven-development` |
| Need implementable steps | `planning-and-task-breakdown` |
| Multi-file change | `incremental-implementation` |
| Behavior change or bug fix | `test-driven-development` |
| Framework/library uncertainty | `source-driven-development` |
| Poor output quality or stale context | `context-engineering` |
| High stakes or unfamiliar code | `doubt-driven-development` |
| User-facing UI | `frontend-ui-engineering` |
| API or boundary design | `api-and-interface-design` |
| Browser runtime behavior | `browser-testing-with-devtools` |
| Broken build/test/runtime | `debugging-and-error-recovery` |
| Pre-merge review | `code-review-and-quality` |
| Complex or clever code | `code-simplification` |
| Trust boundary, auth, secrets, external input | `security-and-hardening` |
| Performance target or regression | `performance-optimization` |
| VCS hygiene | `git-workflow-and-versioning` |
| Pipeline/deploy automation | `ci-cd-and-automation` |
| Removing or migrating old behavior | `deprecation-and-migration` |
| Architecture or API decision | `documentation-and-adrs` |
| Production launch | `shipping-and-launch` |

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "This is too small for process." | Small work still needs scope, assumptions, and evidence. |
| "I know what the user means." | Silent assumptions are a common failure mode. State them or ask. |
| "I can load everything just in case." | Irrelevant context degrades decisions. Load progressively. |
| "I noticed nearby cleanup." | Unrequested cleanup makes PRs harder to review. Stay in scope. |

## Verification

- Relevant skills were loaded, not the whole library.
- Assumptions and conflicts were surfaced.
- Scope did not drift beyond the request.
- Final response includes evidence or explicit verification gaps.

## Exit Criteria

- The task is routed to the right workflow.
- Work remains reviewable and bounded.
- Completion is backed by concrete evidence.
