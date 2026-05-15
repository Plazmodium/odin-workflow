---
name: ci-cd-and-automation
description: Design pipelines with Shift Left checks, quality gates, feature flags, and fast failure feedback.
category: workflow
version: "1.0"
---

# ci-cd-and-automation

## When To Use

- Creating or modifying CI, build, deploy, release, or automation workflows.
- A change needs automated quality gates.
- Deployment and release should be decoupled.

## Workflow

1. Identify the pipeline goal and triggering events.
2. Move cheap checks early: format, lint, typecheck, unit tests, dependency checks.
3. Keep slow or expensive checks later and conditional where appropriate.
4. Fail fast with actionable logs.
5. Use feature flags or staged rollout when deployment should not equal release.
6. Protect secrets and least-privilege credentials.
7. Verify locally when possible and document any unverified remote behavior.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "CI will catch it later." | Shift Left: catch cheap failures before expensive stages. |
| "Deploying means released." | Decouple deploy from release when risk warrants flags. |
| "The workflow syntax looks right." | Pipelines need validation or a dry run where feasible. |

## Verification

- Pipeline changes have syntax or dry-run validation where available.
- Quality gates map to project risk.
- Secrets and permissions are reviewed.

## Exit Criteria

- Automation fails quickly, safely, and with useful evidence.
