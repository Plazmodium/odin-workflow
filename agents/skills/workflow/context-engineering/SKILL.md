---
name: context-engineering
description: Gather, filter, and maintain the right context for an agent task without overloading the session.
category: workflow
version: "1.0"
---

# context-engineering

## When To Use

- Starting a task in an unfamiliar codebase.
- Output quality drops or contradictions appear.
- The agent needs framework, repo, or domain context to act safely.

## Workflow

1. Identify the decision that context must support.
2. Read local rules first: `AGENTS.md`, command docs, nearby README files.
3. Inspect only the files, tests, configs, and call sites relevant to the task.
4. Summarize constraints, conventions, and unknowns.
5. Drop irrelevant context from working memory.
6. Refresh context when changing directories, domains, or assumptions.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "More context is always better." | Irrelevant context can poison decisions. |
| "I can infer the convention." | Local conventions beat generic model priors. |
| "The first files I found are enough." | Verify against call sites, tests, or configuration. |

## Verification

- Claims are grounded in read files, commands, or provided text.
- Important unknowns are explicit.
- No broad rewrite was justified by shallow context.

## Exit Criteria

- The agent has enough relevant context to proceed safely and no more than needed.
