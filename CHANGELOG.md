# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

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
