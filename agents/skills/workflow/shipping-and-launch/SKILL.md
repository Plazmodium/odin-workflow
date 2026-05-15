---
name: shipping-and-launch
description: Prepare production changes with launch checks, staged rollout, rollback, monitoring, and evidence.
category: workflow
version: "1.0"
---

# shipping-and-launch

## When To Use

- Preparing to release, deploy, enable, or announce production behavior.
- A change has user, data, operational, or business impact.
- The user asks to ship.

## Workflow

1. Confirm what is being shipped and what remains off.
2. Verify tests, build, migrations, docs, and configuration are ready.
3. Identify feature flags, rollout stages, and blast radius.
4. Define rollback or disablement steps.
5. Confirm monitoring, alerts, logs, and success metrics.
6. Check known risks and owner contacts.
7. Ship only when evidence supports readiness or the user explicitly accepts residual risk.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "Tests pass, ship it." | Launch readiness also requires rollback, monitoring, and operational checks. |
| "We can watch manually." | Monitoring should be explicit and actionable. |
| "Rollback is obvious." | Rollback steps must be known before launch pressure. |

## Verification

- Pre-launch checks are complete or gaps are accepted.
- Rollback path is documented.
- Monitoring and success criteria are known.

## Exit Criteria

- The change can be released with controlled blast radius and recovery path.
