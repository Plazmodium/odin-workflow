---
name: source-driven-development
description: Ground framework and library decisions in authoritative documentation before implementation.
category: workflow
version: "1.0"
---

# source-driven-development

## When To Use

- Using unfamiliar framework, library, CLI, API, or protocol behavior.
- Version-specific behavior matters.
- The implementation depends on an external contract.

## Workflow

1. Identify the exact library, framework, service, or API and version when possible.
2. Prefer official docs, source repositories, or project-maintained references.
3. Retrieve only the docs relevant to the decision.
4. Compare docs against the local code's installed version and existing patterns.
5. Cite or summarize the source-backed rule that guides the change.
6. Flag anything unverified instead of inventing precision.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "I know this framework." | Model memory may be stale or version-mismatched. |
| "The API name sounds right." | Plausible APIs are a common hallucination. Verify. |
| "A blog post is enough." | Prefer authoritative docs when behavior matters. |

## Verification

- External behavior is backed by an authoritative source.
- Local version or code pattern does not contradict the source.
- Unverified assumptions are labeled.

## Exit Criteria

- Framework-dependent implementation choices are source-grounded.
