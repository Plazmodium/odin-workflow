# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

## [0.6.0-beta] - 2026-04-13

### Added

- `odin.prepare_phase_context` now returns explicit harness execution guidance, including logical phase-role metadata, acting-agent attribution, supported execution modes, and recommended inline vs subagent routing.
- Ralph Loop now supports an optional child-command execution hook for phases 5-8, including a documented stdin/stdout protocol and parent-proxied artifact/result recording through `odin.*`.

### Changed

- Public runtime and orchestration docs now define the canonical harness contract for inline execution, true harness-spawned subagents, and MCP-less child-agent proxy flows.
- Root package version, runtime package version, runtime MCP server version, runtime lockfile, root README badge, and Ralph Loop package version were updated for this release.

## [0.5.0-beta] - 2026-04-08

### Added
- New `odin start-feature` helper flow in the published package creates or switches the feature branch first, then records the feature through `odin.start_feature`, so the public Odin workflow now matches the documented branch-first contract.

### Fixed
- Ralph Loop release handoff now fails early with actionable errors when the recorded feature branch is missing locally, the current checkout is on the wrong branch, or the target project is not a git repo.
- Feature detail UI now distinguishes elapsed phase time from completed agent invocation runtime, reducing the mismatch between the Phase Timeline and Agent Runtime Profiler.

### Changed
- Root package version, runtime package version, runtime MCP server version, runtime lockfile, and README badge updated to `0.5.0-beta`.

## [0.4.0-beta] - 2026-04-08

### Fixed
- `odin.get_claims_needing_review`, `odin.verify_claims`, and `odin.run_policy_checks` now print the pending watcher `claim_id` values directly in text output, along with exact follow-up calls for `odin.record_watcher_review` and `odin.verify_claims`, so text-only clients can clear the watcher queue without direct database access.

### Changed
- Root package version, runtime package version, runtime MCP server version, runtime lockfile, and README badge updated to `0.4.0-beta`.

## [0.3.9-beta] - 2026-04-08

### Fixed
- `011_complete_feature_phase_coverage.sql` now drops the legacy `get_feature_status(TEXT)` signature before recreating it so `odin.apply_migrations` succeeds on databases that still have the older row type.
- Autonomous pickup now filters only valid persisted feature statuses, fixing Ralph Loop failures against databases whose `feature_status` enum never included the runtime-only `PLANNED` value.

### Changed
- Synced the public repo with the current framework runtime and migration sources, including the bundled migration regression test and runtime package metadata updated to `0.3.9-beta`.

## [0.3.7-beta] - 2026-04-02

### Added
- Ralph Loop as a user-facing supervisor package with `ralph:tick` and `ralph:watch` commands in the full Odin suite.
- Release-phase autonomous tooling for safe auto-PR handoff, merged release closeout, supervisor audit events, and dashboard loop visibility.
- Simulation-first verification for Ralph Loop via `loop/src/scenario.test.ts` and `npm run test:simulation`.

### Changed
- Runtime now exposes release handoff and cleanup tools so external supervisors can archive, record PR handoff, retry safely after failed handoff/closeout attempts, and keep phase-9 invocation telemetry clean.
- Dashboard health view now shows Ralph Loop last tick, selected feature/phase, no-op reason, and last failure summary from supervisor audit events.
- Root package version, runtime package version, runtime MCP server version, runtime lockfile, and README badge updated to `0.3.7-beta`.

## [0.3.6-beta] - 2026-04-01

### Added
- Runtime automation policy support with `guarded` and `auto_pr` modes, explicit config validation, and automation snapshots surfaced through `odin.prepare_phase_context` and `odin.get_feature_status`.
- Release-phase invocation coverage summaries in `odin.get_feature_status` so orchestrators can gate PR handoff without leaving the tool-driven workflow.

### Changed
- Release/orchestrator guidance now treats `context.automation` as the trusted PR-action boundary for this release while keeping merge human-only.
- Runtime bootstrap, shipped guide, agent definitions, and README docs now describe the guarded default, opt-in `auto_pr`, and unsupported `auto_merge` contract.
- Root package version, runtime package version, runtime MCP server version, runtime lockfile, and README badge updated to `0.3.6-beta`.

## [0.3.5-beta] - 2026-03-31

### Added
- Governed skill-proposal pipeline for unresolved learnings: deterministic candidate detection, persisted proposal workflow state, draft validation, approval, and publish flow into `.odin/skills/generated/`.
- New runtime tools for the proposal workflow: `get_skill_proposal_queue`, `get_skill_proposals`, `record_skill_proposal_draft`, `record_skill_proposal_decision`, `publish_skill_proposal`, and `sync_skill_proposal_candidates`.
- Dashboard visibility for skill proposal candidates and proposal draft/approval/publish state on the Learnings page.

### Changed
- Runtime migrations now include `009_skill_proposal_candidates.sql` and `010_skill_proposals.sql` in both the public migrations folder and bundled runtime migrations.
- `odin.capture_learning` now surfaces unresolved proposal candidates and can keep proposal candidate state in sync.
- Root package version, runtime package version, runtime MCP server version, runtime lockfile, and README badge updated to `0.3.5-beta`.

## [0.3.4-beta] - 2026-03-30

### Added
- The npm package now bundles `ODIN.md`, built-in skills, and built-in phase agent definitions inside the tarball.
- `odin.prepare_phase_context` now exposes packaged phase-definition markdown so harnesses can build prompts from shipped Odin instructions instead of relying only on hard-coded summaries.

### Changed
- `odin init` now copies `.odin/ODIN.md` and `.odin/agents/definitions/` into the target project alongside `.odin/config.yaml`, `.odin/skills/`, and `.env.example`.
- Runtime docs now instruct harnesses to read `.odin/ODIN.md` and use `context.agent.definition_markdown` during phase orchestration.
- Root package version, runtime package version, runtime MCP server version, runtime lockfile, and README badge updated to `0.3.4-beta`.

## [0.3.3-beta] - 2026-03-30

### Added
- Public npm distribution for the Odin runtime as `@plazmodium/odin` with the `odin` CLI entrypoint for `odin mcp` and `odin init`.
- Maintainer npm publishing guide plus manual MCP wiring examples for Claude Code, Amp, OpenCode, Codex, and Cursor.

### Fixed
- Runtime bootstrap now defaults to `runtime.mode: in_memory` with archive disabled so MCP smoke tests do not require Supabase credentials.
- `odin.apply_migrations` now reports clearer errors for invalid or local `SUPABASE_URL` values and reminds users that runtime config changes require an MCP server restart.
- Runtime dependency advisories resolved in the published lockfile (`yaml`, `picomatch`, `path-to-regexp`).

### Changed
- Runtime packaging now prefers the published `npx -y @plazmodium/odin ...` install path while keeping repo-checkout flow as the maintainer fallback.
- Root `package.json`, runtime package metadata, runtime MCP server version, and README release badge updated to `0.3.3-beta`.
- Runtime docs now clarify that the npm package ships the MCP runtime only; the dashboard remains part of the full `odin-workflow` repo.

## [0.3.2-beta] - 2026-03-24

### Fixed
- Runtime: handle object-shaped Supabase RPC responses when recording commits so `odin.record_commit` no longer crashes on installs that return a single row object.
- Runtime: harden watched-claim flow so claims can only be submitted from the active watched phase, and expose clearer watcher next actions through `run_policy_checks`, `get_claims_needing_review`, `verify_claims`, and `prepare_phase_context`.
- Runtime: narrow skill auto-detection so generic words like `api`, `architecture`, and `testing` do not load entire skill categories for every agent; non-technical phases now fall back more cleanly to `generic-dev`.
- Dashboard: keep Discovery requirements visible in the phase timeline even when requirements items use fallback fields such as `description`, `text`, or plain strings instead of only `id` / `title` / `priority`.

### Changed
- Version references updated to `0.3.2-beta` in the root package, runtime package, runtime lockfile, runtime MCP server version, and README badge.

## [0.3.1-beta] - 2026-03-23

### Added
- Development Evals workflow support across Odin docs, runtime tools, and dashboard rendering.
- Runtime helpers for `eval_plan`, `eval_run`, `eval_readiness`, and focused development-eval status inspection.
- Canonical eval-aware orchestration guidance in runtime bootstrap output and shipped docs.

### Fixed
- Dashboard archive viewing now resolves files through archive metadata instead of assuming public storage URLs.
- Dashboard phase timeline and agent profiler now normalize workflow agent labels, aggregate duration data correctly, and show current task progress more reliably.

### Changed
- Root README release badge updated to `0.3.1-beta`.
- Root `package.json`, runtime `package.json`, runtime lockfile, and runtime MCP server version updated to `0.3.1-beta`.

## [0.3.0] - 2026-03-18

### Added
- **Provider-agnostic migrations** (`odin.apply_migrations`): new `SqlExecutor` adapter interface with two implementations — `DirectPostgresExecutor` (any PostgreSQL via `DATABASE_URL`) and `SupabaseManagementApiExecutor` (Supabase Management API).
- **Auto-bootstrap**: `apply_migrations` detects existing Odin schema on first run and seeds the `odin_migrations` tracking table so already-applied migrations are not re-run.
- `DATABASE_URL` config support — Odin now works with any PostgreSQL provider (Neon, Railway, self-hosted, etc.), not just Supabase.
- `postgres` (postgres.js) dependency for direct PostgreSQL connections.
- Knowledge exploration tool (`odin.explore_knowledge`) for domain cluster inspection, cross-domain bridges, and resonance ranking.
- TLA+ formal design verification skill (`agents/skills/architecture/tla-precheck/`).
- Dashboard domain cluster map component for learnings visualization.

### Changed
- **ODIN.md comprehensively rewritten**: all raw SQL replaced with `odin.*` tool calls, added Orchestrator Loop section, updated State Management, Required MCP Servers, Project Structure, and Quick Reference.
- Runtime README updated for provider-agnostic setup with dual connection methods.
- `apply-migrations.ts` rewritten to v0.2.0 using the adapter pattern.
- `config.ts` updated with `database.url` field.
- Runtime `package.json` bumped to `0.3.0`.
- Agent definitions and shared context updated for current workflow semantics.

## [0.2.0] - 2026-03-10

### Added
- Product, Reviewer, and Watcher agent definitions for the current 11-phase workflow.
- Workflow extension migrations `005_odin_v2_schema.sql`, `006_odin_v2_functions.sql`, and `007_odin_v2_phase_alignment.sql`.
- Dashboard support for watcher verification and security findings.

### Changed
- Updated `ODIN.md`, README files, and shipped docs to reflect the current public workflow and repo structure.
- Updated dashboard UI copy and activity rendering for the 11-phase workflow, watcher verification, and Reviewer semantics.

### Validated
- End-to-end dogfooding completed before sync to `odin-workflow`.
- Dashboard build validation passed.
- Reviewer/Semgrep validation completed with `0 findings` and `0 parser warnings`.

## [0.1.4] - 2026-02-23

### Fixed
- Dashboard: added a resilient fallback in feature data queries so agent duration stats are computed from `agent_invocations` when `get_agent_durations` returns null or empty results.
- Dashboard: preserved profiler usability by grouping fallback durations by phase and agent, then returning stable sorted aggregates.

### Changed
- Documentation: updated release version references in the root README to 0.1.4-beta.

## [0.1.3] - 2026-02-20

### Fixed
- Dashboard: hardened feature detail handling against phase output drift.
