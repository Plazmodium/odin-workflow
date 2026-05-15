---
name: security-and-hardening
description: Check trust boundaries, input validation, auth, secrets, dependencies, and common vulnerability classes.
category: workflow
version: "1.0"
---

# security-and-hardening

## When To Use

- Handling user input, authentication, authorization, secrets, storage, payments, external services, or file/network access.
- Reviewing changes that cross a trust boundary.
- Preparing production-facing code.

## Workflow

1. Identify assets, actors, trust boundaries, and data flow.
2. Validate and normalize input at boundaries.
3. Check authentication and authorization separately.
4. Ensure secrets are not logged, committed, exposed to clients, or embedded in code.
5. Check injection, XSS, CSRF, SSRF, path traversal, insecure deserialization, and dependency risk when relevant.
6. Prefer deny-by-default and least privilege.
7. Add tests or checks for critical failure paths.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "Only trusted users call this." | Trust boundaries change and credentials leak. |
| "Validation happens elsewhere." | Boundary code should verify the assumption or make it explicit. |
| "This secret is just for local testing." | Secrets in code tend to spread. Do not commit them. |

## Verification

- Trust boundaries and sensitive data are identified.
- Critical inputs and permissions are checked.
- Security-relevant behavior has tests or documented manual checks.

## Exit Criteria

- The change does not introduce an avoidable security regression.
