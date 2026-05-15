---
name: doubt-driven-development
description: Run adversarial self-review for high-stakes, uncertain, or unfamiliar implementation decisions.
category: workflow
version: "1.0"
---

# doubt-driven-development

## When To Use

- Security, data loss, production, migration, or irreversible risk exists.
- The agent is unusually confident with thin evidence.
- The codebase or domain is unfamiliar.

## Workflow

1. State the decision or claim being relied on.
2. Extract the evidence that supports it.
3. List plausible ways the claim could be wrong.
4. Check the most likely failure modes against code, tests, docs, or runtime behavior.
5. Reconcile: keep, revise, or stop and ask.
6. Do not proceed on unresolved high-impact doubts.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "This looks correct." | Looking correct is not evidence. |
| "The risk is theoretical." | High-impact theoretical risks deserve bounded checks. |
| "Questioning myself wastes time." | Early doubt is cheaper than late incident response. |

## Verification

- Key claims have explicit evidence.
- High-impact doubts are resolved or escalated.
- Final action reflects the reconciled evidence.

## Exit Criteria

- The decision is safe enough to proceed, or work stops with a clear blocker.
