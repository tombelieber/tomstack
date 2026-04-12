#!/usr/bin/env bash
set -euo pipefail

# Contract test: verifies that all CLI subcommands and flags appear in the skill.
# Run from repo root: bash orphan-reaper/test/skill-sync.sh

CLI="orphan-reaper/cli.sh"
SKILL="orphan-reaper/skills/cleanup/SKILL.md"
PLUGIN="orphan-reaper/.claude-plugin/plugin.json"
PKG="orphan-reaper/package.json"
ERRORS=0

# Allow running from plugin dir or repo root
if [ ! -f "$CLI" ] && [ -f "cli.sh" ]; then
  CLI="cli.sh"
  SKILL="skills/cleanup/SKILL.md"
  PLUGIN=".claude-plugin/plugin.json"
  PKG="package.json"
fi

check() {
  local label="$1" pattern="$2" file="$3"
  if ! grep -qF -- "$pattern" "$file"; then
    echo "MISSING in $file: $pattern ($label)"
    ((ERRORS++)) || true
  fi
}

for cmd in scan kill patterns add version; do
  check "subcommand" "$cmd" "$SKILL"
done

for flag in --json --quiet; do
  check "flag" "$flag" "$SKILL"
done

# Version triple check
CLI_VER=$(sed -n 's/^VERSION="\([^"]*\)"/\1/p' "$CLI")
PKG_VER=$(python3 -c "import json; print(json.load(open('$PKG'))['version'])")
PLUGIN_VER=$(python3 -c "import json; print(json.load(open('$PLUGIN'))['version'])")

if [ "$CLI_VER" != "$PKG_VER" ]; then
  echo "VERSION MISMATCH: cli.sh=$CLI_VER, package.json=$PKG_VER"
  ((ERRORS++)) || true
fi
if [ "$CLI_VER" != "$PLUGIN_VER" ]; then
  echo "VERSION MISMATCH: cli.sh=$CLI_VER, plugin.json=$PLUGIN_VER"
  ((ERRORS++)) || true
fi

if ! bash -n "$CLI" 2>/dev/null; then
  echo "SYNTAX ERROR in $CLI"
  ((ERRORS++)) || true
fi

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "FAIL: $ERRORS issue(s) found."
  exit 1
fi

echo "OK: All subcommands, flags, and versions are in sync."
exit 0
