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

Anything outside those Release actions is out of scope for this tracer-bullet slice.

## Commands

In the public Odin suite repo:

```bash
npm run ralph:tick -- --project-root /path/to/project
npm run ralph:watch -- --project-root /path/to/project --interval-ms 30000
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

## Environment and prerequisites

- target project bootstrapped with Odin
- `runtime.mode: supabase`
- valid `.env` / `.env.local`
- `git` and `gh` installed locally
- `automation.mode: auto_pr` plus non-empty `allowed_base_branches` for auto-PR handoff

Optional:

- `RALPH_LOOP_NAME=my-loop-name` to change the emitted supervisor identity
- `RALPH_LOOP_INTERVAL_MS=15000` for watch mode if you do not pass `--interval-ms`

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
- you are testing supervisor observability on the dashboard

Do not use it yet as a generic multi-phase daemon.
