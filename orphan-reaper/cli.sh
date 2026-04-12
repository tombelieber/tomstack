#!/usr/bin/env bash
# orphan-reaper — kill orphan dev processes left by AI agent sessions
# https://github.com/tombelieber/tomstack
set -euo pipefail

VERSION="0.1.1"

# ── Output helpers ──────────────────────────────────────────────────────────

JSON_OUTPUT=0
QUIET=0

json_escape() {
  python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$1"
}

json_out() { [ "$JSON_OUTPUT" -eq 1 ] && echo "$1"; }
json_err() { [ "$JSON_OUTPUT" -eq 1 ] && echo "$1" >&2; }

info() { [ "$QUIET" -eq 0 ] && [ "$JSON_OUTPUT" -eq 0 ] && echo "$@"; return 0; }
warn() { [ "$QUIET" -eq 0 ] && [ "$JSON_OUTPUT" -eq 0 ] && echo "warn: $*" >&2; return 0; }

fail() {
  if [ "$JSON_OUTPUT" -eq 1 ]; then
    json_err "{\"error\": $(json_escape "$1")}"
  else
    echo "error: $1" >&2
  fi
  exit 1
}

# ── Default orphan patterns ────────────────────────────────────────────────
# Process-name patterns matched with pgrep -f (full command line).
# Each pattern is scoped to avoid false positives — never bare "node".

DEFAULT_PATTERNS=(
  'storybook dev'
  'storybook build'
  'esbuild.*--service.*--ping'
  'astro preview'
  'astro dev'
  'vite preview'
  'vite dev'
  'turbo.*preview'
  'next dev'
  'webpack serve'
  'wrangler dev'
  'remix dev'
  'nuxt dev'
  'angular.*serve'
  'parcel serve'
  'rollup.*--watch'
  'tsc.*--watch'
  'vitest.*--watch'
  'jest.*--watch'
  'playwright.*test'
  'cypress open'
)

# ── Config ─────────────────────────────────────────────────────────────────
# Users can add custom patterns in ~/.orphan-reaper/patterns.conf (one per line).

CONFIG_DIR="${HOME}/.orphan-reaper"
CUSTOM_PATTERNS_FILE="${CONFIG_DIR}/patterns.conf"

load_patterns() {
  local patterns=("${DEFAULT_PATTERNS[@]}")
  if [ -f "$CUSTOM_PATTERNS_FILE" ]; then
    while IFS= read -r line; do
      # Skip comments and blank lines
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${line// }" ]] && continue
      patterns+=("$line")
    done < "$CUSTOM_PATTERNS_FILE"
  fi
  echo "${patterns[@]}"
}

# ── Core: find orphans ─────────────────────────────────────────────────────
# An "orphan" is a process that:
# 1. Matches a known dev tool pattern
# 2. Has NO controlling terminal (tty == "??")
# 3. Is not this script or its parent

find_orphans() {
  local -a patterns
  read -ra patterns <<< "$(load_patterns)"

  local found=()
  for pattern in "${patterns[@]}"; do
    local pids
    pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
    [ -z "$pids" ] && continue

    for pid in $pids; do
      # Skip self and parent
      [ "$pid" = "$$" ] || [ "$pid" = "$PPID" ] && continue

      # Only orphans: no controlling terminal
      local tty
      tty="$(ps -p "$pid" -o tty= 2>/dev/null || echo '?')"
      if [ "$tty" != "??" ] && [ "$tty" != "?" ]; then
        continue
      fi

      # Verify process exists
      kill -0 "$pid" 2>/dev/null || continue

      local cmd rss
      cmd="$(ps -p "$pid" -o command= 2>/dev/null | head -c 120 || echo '?')"
      rss="$(ps -p "$pid" -o rss= 2>/dev/null | tr -d ' ' || echo '0')"

      found+=("${pid}|${rss}|${cmd}")
    done
  done

  printf '%s\n' "${found[@]}"
}

# ── Commands ───────────────────────────────────────────────────────────────

cmd_scan() {
  local orphans
  orphans="$(find_orphans)"

  if [ -z "$orphans" ]; then
    if [ "$JSON_OUTPUT" -eq 1 ]; then
      echo '{"ok": true, "count": 0, "orphans": [], "total_rss_mb": 0}'
    else
      info "No orphan dev processes found."
    fi
    return 0
  fi

  local count=0 total_rss=0
  local json_entries=()

  while IFS='|' read -r pid rss cmd; do
    ((count++)) || true
    ((total_rss += rss)) || true
    local rss_mb=$(( rss / 1024 ))

    if [ "$JSON_OUTPUT" -eq 1 ]; then
      json_entries+=("{\"pid\": $pid, \"rss_mb\": $rss_mb, \"command\": $(json_escape "$cmd")}")
    else
      info "  PID $pid  ${rss_mb}MB  $cmd"
    fi
  done <<< "$orphans"

  local total_mb=$(( total_rss / 1024 ))

  if [ "$JSON_OUTPUT" -eq 1 ]; then
    local joined
    joined="$(printf ',%s' "${json_entries[@]}")"
    joined="${joined:1}"
    echo "{\"ok\": true, \"count\": $count, \"total_rss_mb\": $total_mb, \"orphans\": [$joined]}"
  else
    info ""
    info "$count orphan(s), ~${total_mb}MB total"
  fi
}

cmd_kill() {
  local orphans
  orphans="$(find_orphans)"

  if [ -z "$orphans" ]; then
    if [ "$JSON_OUTPUT" -eq 1 ]; then
      echo '{"ok": true, "killed": 0}'
    else
      info "No orphan dev processes found."
    fi
    return 0
  fi

  local killed=0 total_rss=0
  local json_entries=()

  while IFS='|' read -r pid rss cmd; do
    local rss_mb=$(( rss / 1024 ))

    # SIGTERM first — give processes a chance to cleanup
    if kill "$pid" 2>/dev/null; then
      ((killed++)) || true
      ((total_rss += rss)) || true

      if [ "$JSON_OUTPUT" -eq 1 ]; then
        json_entries+=("{\"pid\": $pid, \"rss_mb\": $rss_mb, \"command\": $(json_escape "$cmd")}")
      else
        info "  killed PID $pid  ${rss_mb}MB  $cmd"
      fi
    fi
  done <<< "$orphans"

  local total_mb=$(( total_rss / 1024 ))

  if [ "$JSON_OUTPUT" -eq 1 ]; then
    local joined
    joined="$(printf ',%s' "${json_entries[@]}")"
    joined="${joined:1}"
    echo "{\"ok\": true, \"killed\": $killed, \"freed_rss_mb\": $total_mb, \"processes\": [$joined]}"
  else
    info ""
    info "Killed $killed process(es), freed ~${total_mb}MB"
  fi
}

cmd_patterns() {
  if [ "$JSON_OUTPUT" -eq 1 ]; then
    local items=()
    for p in "${DEFAULT_PATTERNS[@]}"; do
      items+=("$(json_escape "$p")")
    done
    local joined
    joined="$(printf ',%s' "${items[@]}")"
    joined="${joined:1}"

    local has_custom=false custom_items=()
    if [ -f "$CUSTOM_PATTERNS_FILE" ]; then
      has_custom=true
      while IFS= read -r line; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        custom_items+=("$(json_escape "$line")")
      done < "$CUSTOM_PATTERNS_FILE"
    fi

    local custom_joined="[]"
    if [ ${#custom_items[@]} -gt 0 ]; then
      custom_joined="$(printf ',%s' "${custom_items[@]}")"
      custom_joined="[${custom_joined:1}]"
    fi

    echo "{\"ok\": true, \"default\": [$joined], \"custom_file\": $(json_escape "$CUSTOM_PATTERNS_FILE"), \"custom\": $custom_joined}"
  else
    info "Default patterns:"
    for p in "${DEFAULT_PATTERNS[@]}"; do
      info "  $p"
    done
    info ""
    if [ -f "$CUSTOM_PATTERNS_FILE" ]; then
      info "Custom patterns ($CUSTOM_PATTERNS_FILE):"
      while IFS= read -r line; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        info "  $line"
      done < "$CUSTOM_PATTERNS_FILE"
    else
      info "No custom patterns. Add to: $CUSTOM_PATTERNS_FILE"
    fi
  fi
}

cmd_add() {
  local pattern="$1"
  [ -z "$pattern" ] && fail "Usage: orphan-reaper add 'pattern'"

  mkdir -p "$CONFIG_DIR"
  echo "$pattern" >> "$CUSTOM_PATTERNS_FILE"

  if [ "$JSON_OUTPUT" -eq 1 ]; then
    echo "{\"ok\": true, \"added\": $(json_escape "$pattern"), \"file\": $(json_escape "$CUSTOM_PATTERNS_FILE")}"
  else
    info "Added pattern: $pattern"
  fi
}

cmd_version() {
  if [ "$JSON_OUTPUT" -eq 1 ]; then
    echo "{\"version\": \"$VERSION\"}"
  else
    echo "orphan-reaper $VERSION"
  fi
}

cmd_help() {
  cat <<'USAGE'
orphan-reaper — kill orphan dev processes left by AI agent sessions

Usage:
  orphan-reaper scan              List orphan processes (don't kill)
  orphan-reaper kill              Kill all orphan processes (SIGTERM)
  orphan-reaper patterns          Show matched process patterns
  orphan-reaper add 'pattern'     Add a custom pattern
  orphan-reaper version           Show version

Flags:
  --json       Machine-readable JSON output
  --quiet      Suppress output unless something was killed

An "orphan" is a dev process (storybook, vite, esbuild, etc.) that has no
controlling terminal — typically left behind when an AI agent session ends.

Custom patterns: ~/.orphan-reaper/patterns.conf (one regex per line)
USAGE
}

# ── Arg parsing ────────────────────────────────────────────────────────────

COMMAND=""
CMD_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --json)  JSON_OUTPUT=1 ;;
    --quiet) QUIET=1 ;;
    *)       [ -z "$COMMAND" ] && COMMAND="$arg" || CMD_ARGS+=("$arg") ;;
  esac
done

case "${COMMAND:-help}" in
  scan)     cmd_scan ;;
  kill)     cmd_kill ;;
  patterns) cmd_patterns ;;
  add)      cmd_add "${CMD_ARGS[0]:-}" ;;
  version)  cmd_version ;;
  help|--help|-h) cmd_help ;;
  *)        fail "Unknown command: $COMMAND. Run 'orphan-reaper help'." ;;
esac
