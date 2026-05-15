---
name: documentation-and-adrs
description: Document architectural decisions, API behavior, operational knowledge, and the why behind changes.
category: workflow
version: "1.0"
---

# documentation-and-adrs

## When To Use

- Making architectural, API, dependency, storage, security, or operational decisions.
- Changing behavior future maintainers must understand.
- A decision has meaningful tradeoffs.

## Workflow

1. Decide whether the audience needs inline comments, API docs, README updates, or an ADR.
2. Document the context and decision, not just mechanics.
3. Record alternatives considered and why they were rejected.
4. Capture consequences, risks, and follow-up work.
5. Keep docs close to the code or established docs location.
6. Update docs in the same change when behavior changes.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "The code is self-documenting." | Code shows what; docs often need to explain why. |
| "We'll document after launch." | Post-launch docs are frequently incomplete or forgotten. |
| "An ADR is too heavy." | A short decision record is cheaper than rediscovering context. |

## Verification

- Docs match current behavior.
- Decision records include context, decision, alternatives, and consequences.
- No stale or contradictory docs remain in touched areas.

## Exit Criteria

- Future maintainers can understand the reason and safe use of the change.
