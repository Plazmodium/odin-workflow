# Changelog

All notable changes to this project are documented in this file.

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
