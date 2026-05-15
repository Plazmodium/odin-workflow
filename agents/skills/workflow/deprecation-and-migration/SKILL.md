---
name: deprecation-and-migration
description: Remove or migrate old behavior safely with code-as-liability discipline and rollback-aware plans.
category: workflow
version: "1.0"
---

# deprecation-and-migration

## When To Use

- Removing APIs, flags, files, schemas, dependencies, or behavior.
- Migrating users, data, configuration, or integrations.
- Sunsetting legacy systems.

## Workflow

1. Identify what is being removed or migrated and who depends on it.
2. Prove usage, non-usage, or migration readiness with code search, telemetry, tests, or stakeholder evidence.
3. Choose advisory deprecation, compulsory migration, compatibility shim, or immediate removal.
4. Define migration steps, rollback path, and communication needs.
5. Remove code only after dependents are handled or the risk is accepted.
6. Add tests or checks that prevent zombie code from returning.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "This looks dead." | Dead code claims need evidence. |
| "Keeping it is harmless." | Code is liability: every line has maintenance cost. |
| "We can fix users after removal." | Breaking consumers without a plan creates incidents. |

## Verification

- Dependents are identified or the search limits are documented.
- Migration or removal has tests, telemetry, or review evidence.
- Rollback or recovery is considered.

## Exit Criteria

- Legacy surface area shrinks without surprising active consumers.
