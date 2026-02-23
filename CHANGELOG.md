# Changelog

All notable changes to this project are documented in this file.

## [0.1.4] - 2026-02-23

### Fixed
- Dashboard: added a resilient fallback in feature data queries so agent duration stats are computed from `agent_invocations` when `get_agent_durations` returns null or empty results.
- Dashboard: preserved profiler usability by grouping fallback durations by phase and agent, then returning stable sorted aggregates.

### Changed
- Documentation: updated release version references in the root README to 0.1.4-beta.

## [0.1.3] - 2026-02-20

### Fixed
- Dashboard: hardened feature detail handling against phase output drift.
