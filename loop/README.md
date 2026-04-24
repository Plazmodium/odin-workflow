# Ralph Loop

Ralph Loop is the user-facing Odin supervisor that runs alongside the Odin runtime.

It does **not** replace the runtime. Instead it:

- asks the runtime which feature/phase is safe to run next
- performs a bounded action
- records the result back through `odin.*`
- emits supervisor events for dashboard/operator visibility

## Current scope

This tracer-bullet slice supports:

1. **Auto-PR handoff** for phase 9 when `automation.mode: auto_pr` allows PR creation
2. **Release closeout** after a human merge is recorded
3. **Optional child-command execution for phases 5-8** when a subagent command is configured

Release stays inline inside Ralph Loop. Phases 5-8 only become eligible when a child command is configured; Ralph Loop then spawns that command and proxies the returned artifacts and final phase result from the parent session. Ralph Loop also respects `context.execution.response_style`, so terse operational chatter can be requested without changing the normal human-readable templates for final artifacts.

Ralph Loop now also records `odin.register_phase_execution(...)` before it executes a picked phase so Odin can distinguish:

- expected execution mode
- actual execution mode
- whether a distinct worker session was attested

For subagent phases, Ralph Loop can now also record `odin.register_phase_realization(...)` after a successful child run so Odin can tell whether the child was launched from the canonical phase prompt bundle returned by `odin.prepare_phase_context(...)`.

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
npm run tick -- --project-root /path/to/project --subagent-command-json '["node","./child-runner.js"]'
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
- child-command protocol parsing
- parent-proxied artifact/result recording for subagent phases

## Requirements

- the Odin runtime must be built and available locally
- the target project must already be bootstrapped with `.odin/config.yaml`
- real loop usage should use `runtime.mode: supabase`
- `gh` and `git` must be installed for auto-PR handoff
- `automation.mode: auto_pr` plus an allowlisted base branch are required for auto-PR creation

Optional child-command execution:

- set `RALPH_SUBAGENT_COMMAND_JSON='["node","./child-runner.js"]'`, or pass `--subagent-command-json '["node","./child-runner.js"]'`
- when configured, Ralph Loop widens pickup from phase `9` only to phases `5`, `6`, `7`, `8`, and `9`

## Child command protocol

The configured child command runs with `cwd = project_root`.

Ralph Loop writes JSON to stdin shaped like:

```json
{
  "schema_version": "1",
  "request": {
    "project_root": "/path/to/project",
    "supervisor_name": "ralph-loop",
    "selection": {
      "feature_id": "FEAT-123",
      "phase": "5",
      "prepared_context": {
        "agent": {
          "name": "builder-agent"
        },
        "execution": {
          "acting_agent_name": "builder-agent",
          "recommended_mode": "subagent",
          "execution_policy": "distinct_session_preferred"
        }
      }
    },
    "prompt": "..."
  }
}
```

The child command must write JSON to stdout shaped like:

```json
{
  "summary": "Builder implementation finished.",
  "outcome": "completed",
  "next_phase": "6",
  "blockers": [],
  "artifacts": [
    {
      "output_type": "documentation",
      "content": {
        "note": "done"
      }
    }
  ]
}
```

Ralph Loop then proxies:

- `odin.register_phase_execution(...)` to attest actual mode and session linkage
- `odin.register_phase_realization(...)` for subagent phases when a canonical phase prompt manifest was used
- `odin.record_phase_artifact(...)` for each returned artifact
- `odin.record_phase_result(...)` for the returned outcome
- on failed/aborted attempts after registration: `odin.clear_phase_execution(...)` before retry

using `selection.prepared_context.execution.acting_agent_name` as the proxied `created_by` value.

When `selection.prepared_context.execution.response_style = terse_execution`, Ralph Loop adds terse operational-style instructions to the child prompt. This applies to execution chatter and summaries only. Final artifacts are still expected to follow the normal phase templates.

When `selection.prepared_context.execution.phase_prompt_manifest` is present and `prompt_realization_policy` is not optional, Ralph Loop includes the manifest details in the child prompt and records manifest-based realization proof after a successful child run.

## Operational notes

- Ralph Loop records tick events through `odin.record_supervisor_event`
- the dashboard reads those events to show last tick, selected feature/phase, no-op reason, and failure summary
- human merge remains the boundary; Ralph Loop never merges PRs
- if no child command is configured, Ralph Loop keeps its previous Release-only pickup behavior

## Recommended next command

For a local one-shot smoke run:

```bash
npm run tick -- --project-root /path/to/project
```
