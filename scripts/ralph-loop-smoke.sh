#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  printf 'Usage: %s /absolute/path/to/project [tick|watch]\n' "$0" >&2
  exit 1
fi

PROJECT_ROOT="$1"
MODE="${2:-tick}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$PROJECT_ROOT" ]; then
  printf 'Project root not found: %s\n' "$PROJECT_ROOT" >&2
  exit 1
fi

if [ -d "$REPO_ROOT/loop" ]; then
  if [ "$MODE" = "watch" ]; then
    exec bash -lc "cd '$REPO_ROOT' && npm run ralph:watch -- --project-root '$PROJECT_ROOT' --interval-ms 30000"
  fi

  exec bash -lc "cd '$REPO_ROOT' && npm run ralph:tick -- --project-root '$PROJECT_ROOT'"
fi

if [ -d "$REPO_ROOT/system/ralph-loop" ]; then
  if [ "$MODE" = "watch" ]; then
    exec bash -lc "cd '$REPO_ROOT/system/ralph-loop' && npm run watch -- --project-root '$PROJECT_ROOT' --interval-ms 30000"
  fi

  exec bash -lc "cd '$REPO_ROOT/system/ralph-loop' && npm run tick -- --project-root '$PROJECT_ROOT'"
fi

printf 'Could not find Ralph Loop package in %s\n' "$REPO_ROOT" >&2
exit 1
