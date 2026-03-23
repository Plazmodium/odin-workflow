# Changelog

All notable changes to this project are documented in this file.

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
