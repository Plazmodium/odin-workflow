---
name: api-and-interface-design
description: Design APIs and module boundaries with contracts, Hyrum's Law, validation, and stable error semantics.
category: workflow
version: "1.0"
---

# api-and-interface-design

## When To Use

- Creating or changing an API, CLI, exported function, event, schema, or module boundary.
- Behavior may be consumed by other code, users, scripts, or services.
- Inputs cross a trust or version boundary.

## Workflow

1. Identify consumers and observable behavior.
2. Define the contract before implementation: inputs, outputs, errors, side effects, and compatibility.
3. Apply Hyrum's Law: assume every observable behavior may become depended on.
4. Validate inputs at the boundary.
5. Make illegal states unrepresentable where practical.
6. Design error semantics that help callers recover.
7. Add contract tests or examples for expected and failure paths.

## Anti-Rationalization

| Excuse | Rebuttal |
| --- | --- |
| "This is internal." | Internal APIs still gain consumers and implicit contracts. |
| "Callers should pass valid data." | Boundaries must defend themselves. |
| "Changing this behavior is harmless." | Observable behavior can have hidden dependents. |

## Verification

- Contract is documented in code, tests, types, schema, or command help.
- Invalid inputs fail predictably.
- Compatibility risk is called out.

## Exit Criteria

- Consumers can rely on the interface without guessing behavior.
