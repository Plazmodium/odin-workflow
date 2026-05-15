---
name: spec-driven-development
description: Write objectives, boundaries, acceptance criteria, and verification plan before significant code changes.
category: workflow
version: "1.0"
---

# spec-driven-development

## When To Use

- Starting a feature, project, API, migration, or significant behavior change.
- The work crosses files, teams, trust boundaries, or user-visible behavior.
- The user asks for a spec, PRD, or design before implementation.

## Workflow

1. State the goal and why it matters.
2. Define in-scope and out-of-scope work.
3. Capture assumptions and unresolved questions.
4. Write acceptance criteria as observable outcomes.
5. Describe user-visible behavior and failure behavior.
6. Identify affected files, APIs, data, dependencies, and trust boundaries.
7. Define the verification plan before coding.
8. Stop if acceptance criteria or boundaries are materially unclear.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "This task is too simple for a spec." | Acceptance criteria can be five lines. Zero lines is the problem. |
| "The code will clarify the requirements." | Code written before requirements tends to encode guesses. |
| "The user already knows what they want." | The agent must know what is being optimized and what is excluded. |

## Verification

- Spec includes goal, scope, non-goals, assumptions, acceptance criteria, and verification.
- Ambiguities that affect implementation are resolved or explicitly deferred.
- The verification plan can produce concrete evidence.

## Exit Criteria

- A reviewer can tell what success means without reading the implementation.
