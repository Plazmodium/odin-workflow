---
name: tla-precheck
description: "Formal design verification using TLA+ model checking via tla-precheck. Use when a feature involves state machines, lifecycle transitions, concurrent state mutations, or invariants that must hold across all interleavings."
category: architecture
compatible_with:
  - clean-architecture
  - domain-driven-design
  - event-driven
depends_on: []
---

# TLA+ PreCheck — Formal Design Verification

## Overview

[tla-precheck](https://github.com/kingbootoshi/tla-precheck) translates a TypeScript state machine DSL (`.machine.ts`) into TLA+ specifications, then runs the TLC model checker to exhaustively verify invariants and graph equivalence. Odin integrates it as an opt-in design verification step in the Architect → Guardian flow.

## When to Use

Write a `.machine.ts` file when the feature involves:

- **Entity lifecycle management** — status transitions, state machines with guard conditions
- **Concurrent operations on shared state** — multiple actors mutating the same resource
- **Financial/billing state changes** — charges, refunds, subscriptions where invariant violations cause real damage
- **Distributed workflow coordination** — where guard conditions are scattered across files/services
- **Any invariant that must hold across all possible interleavings** — not just the happy path

Complexity level (L1/L2/L3) is a secondary signal. Even a small L1 feature can contain a high-risk lifecycle invariant.

## The `.machine.ts` DSL

A machine definition describes states, events, transitions, and invariants:

```typescript
import { defineMachine } from 'tla-precheck';

export default defineMachine({
  moduleName: 'AgentRuns',

  constants: {
    Users: { type: 'set', values: ['u1', 'u2'] },
    MaxConcurrent: { type: 'number', value: 1 },
  },

  state: {
    runs: { type: 'map', keys: 'Users', values: ['idle', 'queued', 'running', 'completed'] },
  },

  init: {
    runs: { u1: 'idle', u2: 'idle' },
  },

  actions: {
    QueueRun: {
      guard: (s) => Object.values(s.runs).some((v) => v === 'idle'),
      update: (s) => {
        const user = Object.keys(s.runs).find((u) => s.runs[u] === 'idle')!;
        s.runs[user] = 'queued';
      },
    },
    StartRun: {
      guard: (s) => {
        const running = Object.values(s.runs).filter((v) => v === 'running').length;
        return running < MaxConcurrent && Object.values(s.runs).some((v) => v === 'queued');
      },
      update: (s) => {
        const user = Object.keys(s.runs).find((u) => s.runs[u] === 'queued')!;
        s.runs[user] = 'running';
      },
    },
    CompleteRun: {
      guard: (s) => Object.values(s.runs).some((v) => v === 'running'),
      update: (s) => {
        const user = Object.keys(s.runs).find((u) => s.runs[u] === 'running')!;
        s.runs[user] = 'completed';
      },
    },
  },

  invariants: {
    AtMostOneRunning: (s) =>
      Object.values(s.runs).filter((v) => v === 'running').length <= MaxConcurrent,
  },
});
```

## Odin Integration

### Architect Phase (Phase 3)

1. Identify state flows in the spec that need formal verification
2. Write a `.machine.ts` file for each critical flow
3. Document in spec section "4.6 State Machine Verification"
4. Ask the orchestrator to call `odin.verify_design` for each machine
5. If proof fails → fix the **design** (the DSL), not patch around it
6. Loop until all machines return `status: VERIFIED`
7. Record aggregated results as one `design_verification` phase artifact

### Guardian Phase (Phase 4)

Guardian reviews proof results in the Technical Soundness perspective:

- All machines `VERIFIED` → supports **Good**
- Any machine `VIOLATION` → **Blocking** (design must be fixed)
- State flows in spec but no proof run → **Needs Work**
- Tool not configured/available → **N/A**

### Configuration

```yaml
# .odin/config.yaml
formal_verification:
  provider: tla-precheck    # or "none" (default)
  timeout_seconds: 120
```

### Requirements

- Java 17+ (for the TLC model checker)
- `tla-precheck` installed as a devDependency in the target project

```bash
npm install -D tla-precheck
```

## Verification Status Codes

| Status | Meaning |
|--------|---------|
| `VERIFIED` | Proof passed, invariants hold, graph equivalence confirmed |
| `VIOLATION` | Invariant violation found — design bug |
| `INVALID_MODEL` | DSL parse error or malformed machine — fix the `.machine.ts`, not the design |
| `TIMEOUT` | TLC exceeded time budget — simplify the state space or increase timeout |
| `UNAVAILABLE` | Java or tla-precheck not installed |
| `NOT_CONFIGURED` | `formal_verification.provider` is `none` |
| `INTERNAL_ERROR` | Unexpected failure in tla-precheck |

## Design Loop

```
Write .machine.ts
       │
       ▼
 odin.verify_design
       │
   ┌───┴───┐
   │       │
VERIFIED  VIOLATION
   │       │
   ▼       ▼
 Done    Read counter-example
         Fix the DESIGN (DSL)
         Re-run verification
         └──────────────┘
```

The key insight: when proof fails, **fix the design**, not the code. The `.machine.ts` IS the design. If you can't make the invariant hold in the model, you can't make it hold in the implementation.

## Best Practices

- **Keep state spaces small** — use 2-3 constants per set, not production-scale values. TLC checks all interleavings exhaustively.
- **Name invariants descriptively** — `AtMostOneRunning` not `Inv1`. Guardian reviews these names.
- **One machine per concern** — don't model your entire system in one file. Model the billing flow, the auth flow, the workflow transitions separately.
- **Pin the version** — `tla-precheck` is early-stage (1 contributor, no releases). Pin exact version in `package.json`.
- **Check `equivalent`** — proof passing but `equivalent: false` means your TypeScript interpreter diverges from the TLA+ spec. This is a bug in the DSL, not the model checker.

## References

- [tla-precheck GitHub](https://github.com/kingbootoshi/tla-precheck)
- [TLA+ Learning Resources](https://lamport.azurewebsites.net/tla/learning.html)
- [Odin Architect Agent — Section 4.6](../../../agents/definitions/architect.md)
