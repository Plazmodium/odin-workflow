#!/usr/bin/env bash
set -euo pipefail

root_version="$(node -p "require('./package.json').version")"
runtime_version="$(node -p "require('./runtime/package.json').version")"
loop_version="$(node -p "require('./loop/package.json').version")"

ensure_versions_match() {
  if [ "$root_version" != "$runtime_version" ]; then
    echo "Root version ($root_version) and runtime version ($runtime_version) must match." >&2
    exit 1
  fi
}

ensure_changelog_header() {
  if ! grep -Fq "## [$root_version]" CHANGELOG.md; then
    echo "CHANGELOG.md is missing a section for version ${root_version}." >&2
    exit 1
  fi
}

extract_changelog_section() {
  awk -v version="$root_version" '
    index($0, "## [" version "]") == 1 { capture=1; next }
    capture && index($0, "## [") == 1 { exit }
    capture { print }
  ' CHANGELOG.md
}

write_notes_file() {
  local notes_file="$1"
  local changelog_section
  changelog_section="$(extract_changelog_section)"

  {
    printf '## Versions\n'
    printf -- '- `odin-workflow`: `%s`\n' "$root_version"
    printf -- '- `@plazmodium/odin`: `%s`\n' "$runtime_version"
    printf -- '- `ralph-loop`: `%s`\n\n' "$loop_version"
    if [ -n "$changelog_section" ]; then
      printf '%s\n' "$changelog_section"
    fi
  } > "$notes_file"
}

command_name="${1:-}"

case "$command_name" in
  validate)
    ensure_versions_match
    ensure_changelog_header
    ;;
  export)
    output_file="${2:-}"
    if [ -z "$output_file" ]; then
      echo "Usage: release-metadata.sh export <output-file>" >&2
      exit 1
    fi

    ensure_versions_match
    ensure_changelog_header

    tag="v${root_version}"
    notes_file="$(mktemp)"
    write_notes_file "$notes_file"

    {
      printf 'root_version=%s\n' "$root_version"
      printf 'runtime_version=%s\n' "$runtime_version"
      printf 'loop_version=%s\n' "$loop_version"
      printf 'tag=%s\n' "$tag"
      printf 'release_name=%s\n' "$tag"
      printf 'notes_file=%s\n' "$notes_file"
    } >> "$output_file"
    ;;
  *)
    echo "Usage: release-metadata.sh <validate|export> [output-file]" >&2
    exit 1
    ;;
esac
