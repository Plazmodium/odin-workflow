# Ralph Loop Guide

Ralph Loop is Odin's external supervisor. It consumes the runtime's policy/state decisions and performs bounded automation without turning the runtime into a hidden workflow engine.

## What it does today

Current supported execution paths:

1. **Release auto-PR handoff**
   - archives the release bundle
   - pushes the feature branch
   - creates a pull request with `gh pr create`
   - records the PR with `odin.record_pr`
   - records release handoff with `odin.record_release_handoff`
2. **Release closeout after human merge**
   - waits for `odin.record_merge`
   - completes phase 9 -> 10 via `odin.record_phase_result`
3. **Optional child-command execution for phases 5-8**
   - enabled with `RALPH_SUBAGENT_COMMAND_JSON` or `--subagent-command-json`
   - Ralph Loop spawns the configured child command
   - Ralph Loop records `odin.register_phase_execution(...)` so Odin can audit actual mode and attested session linkage
   - the child returns artifacts and a final phase outcome on stdout
   - Ralph Loop proxies `odin.record_phase_artifact` / `odin.record_phase_result` from the parent session using `context.execution.acting_agent_name`
   - Ralph Loop also respects `context.execution.response_style` so internal execution chatter can be terse without changing final artifact templates

Without a child command configured, Ralph Loop keeps its earlier Release-only behavior.

## Commands

In the public Odin suite repo:

```bash
npm run ralph:tick -- --project-root /path/to/project
npm run ralph:watch -- --project-root /path/to/project --interval-ms 30000
npm run ralph:tick -- --project-root /path/to/project --subagent-command-json '["node","./child-runner.js"]'
```

## Simulated verification first

If your real project is not ready for a live smoke run yet (for example because it still needs fresh Odin migrations), start with the simulated scenario suite:

```bash
cd loop
npm install
npm run test:simulation
```

The simulation suite covers:

- Release auto-PR handoff
- Release closeout after human merge
- failure cleanup for retryable handoff errors
- child-command protocol parsing
- parent-proxied artifact/result recording for subagent phases

## Environment and prerequisites

- target project bootstrapped with Odin
- `runtime.mode: supabase`
- valid `.env` / `.env.local`
- `git` and `gh` installed locally
- `automation.mode: auto_pr` plus non-empty `allowed_base_branches` for auto-PR handoff

Optional:

- `RALPH_LOOP_NAME=my-loop-name` to change the emitted supervisor identity
- `RALPH_LOOP_INTERVAL_MS=15000` for watch mode if you do not pass `--interval-ms`
- `RALPH_SUBAGENT_COMMAND_JSON='["node","./child-runner.js"]'` to let Ralph Loop pick phases 5-8 and execute them through a child command

## Child command protocol

When `RALPH_SUBAGENT_COMMAND_JSON` or `--subagent-command-json` is set, Ralph Loop widens pickup from phase `9` only to phases `5`, `6`, `7`, `8`, and `9`.

The child command receives JSON on stdin:

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
        "execution": {
          "acting_agent_name": "builder-agent",
          "recommended_mode": "subagent",
          "execution_policy": "distinct_session_preferred",
          "response_style": "terse_execution"
        }
      }
    },
    "prompt": "..."
  }
}
```

It must return JSON on stdout:

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

Ralph Loop then proxies the returned artifacts and phase result through `odin.*` using `selection.prepared_context.execution.acting_agent_name` for `created_by`.

It also records `odin.register_phase_execution(...)` before execution so Odin can tell whether a phase was run inline or by an attested child session.

When `selection.prepared_context.execution.response_style = terse_execution`, Ralph Loop adds terse operational-style instructions to the child prompt. This applies to execution chatter and summaries only. Final artifacts are still expected to follow the normal human-readable templates for the phase.

## What the dashboard shows

The Health Overview page reads Ralph Loop events from `audit_log` and shows:

- last tick
- selected feature/phase
- last no-op reason
- last failure summary

## Manual smoke runbook

### A. Release closeout after human merge

Use this to verify the already-merged closeout path.

1. Pick a feature already in phase 9 with:
   - recorded PR
   - recorded merge (`odin.record_merge` already called)
   - current phase still `9`
2. Run:

```bash
npm run ralph:tick -- --project-root /path/to/project
```

3. Expect:
   - tick selects the feature
   - phase 9 completes to phase 10
   - dashboard shows the last selected feature/phase and a completed outcome

### B. Auto-PR handoff under `auto_pr`

Use this to verify the handoff path before merge.

1. Configure `.odin/config.yaml`:

```yaml
automation:
  mode: auto_pr
  allowed_base_branches:
    - main
```

2. Ensure the feature is in phase 9 and has:
   - `branch_name`
   - `base_branch: main`
   - release notes artifact recorded
   - no PR recorded yet
3. Run:

```bash
npm run ralph:tick -- --project-root /path/to/project
```

4. Expect:
   - release bundle archived
   - branch pushed to origin
   - PR created
   - PR metadata recorded
   - release handoff recorded
   - dashboard shows the selected feature/phase and then future ticks show waiting on human merge

### C. Local watch mode

```bash
npm run ralph:watch -- --project-root /path/to/project --interval-ms 30000
```

Watch mode is single-worker and intentionally simple for now.

Use it when:

- you want repeated release handoff/closeout polling locally
- you want optional child-command execution for phases 5-8
- you are testing supervisor observability on the dashboard

Do not treat it as a fully general multi-phase daemon yet; this slice only adds a bounded child-command hook for phases 5-8 plus the existing Release inline paths.
