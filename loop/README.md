# Ralph Loop

Ralph Loop is the user-facing Odin supervisor that runs alongside the Odin runtime.

It does **not** replace the runtime. Instead it:

- asks the runtime which feature/phase is safe to run next
- performs a bounded action
- records the result back through `odin.*`
- emits supervisor events for dashboard/operator visibility

## Current scope

This tracer-bullet slice supports two Release-phase actions only:

1. **Auto-PR handoff** for phase 9 when `automation.mode: auto_pr` allows PR creation
2. **Release closeout** after a human merge is recorded

It does **not** yet execute Builder/Reviewer/Integrator work.

## Commands

From the full Odin suite repo:

```bash
npm run ralph:tick -- --project-root /path/to/project
npm run ralph:watch -- --project-root /path/to/project --interval-ms 30000
```

From this source package directly:

```bash
cd loop
npm install
npm run tick -- --project-root /path/to/project
npm run watch -- --project-root /path/to/project --interval-ms 30000
```

## Simulated tests

If your real project database is stale or not ready for live smoke runs yet, use the simulated scenario suite first:

```bash
cd loop
npm install
npm run test:simulation
```

That covers:
- Release auto-PR handoff flow
- merged Release closeout flow
- failure cleanup for handoff retries

## Requirements

- the Odin runtime must be built and available locally
- the target project must already be bootstrapped with `.odin/config.yaml`
- real loop usage should use `runtime.mode: supabase`
- `gh` and `git` must be installed for auto-PR handoff
- `automation.mode: auto_pr` plus an allowlisted base branch are required for auto-PR creation

## Operational notes

- Ralph Loop records tick events through `odin.record_supervisor_event`
- the dashboard reads those events to show last tick, selected feature/phase, no-op reason, and failure summary
- human merge remains the boundary; Ralph Loop never merges PRs

## Recommended next command

For a local one-shot smoke run:

```bash
npm run tick -- --project-root /path/to/project
```
