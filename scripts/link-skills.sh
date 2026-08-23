#!/usr/bin/env bash
set -euo pipefail

# Maintainer-only development helper. Public users should use the Claude plugin
# or `npx skills@latest add tombelieber/tomstack`.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DESTS=("$HOME/.claude/skills" "$HOME/.agents/skills")
REPLACE=0

if [[ "${1:-}" == "--replace" ]]; then
  REPLACE=1
elif [[ $# -gt 0 ]]; then
  echo "usage: $0 [--replace]" >&2
  exit 2
fi

names=()
srcs=()
while IFS= read -r -d '' skill_md; do
  src="$(dirname "$skill_md")"
  names+=("$(basename "$src")")
  srcs+=("$src")
done < <(
  find "$REPO/skills" -name SKILL.md \
    -not -path '*/node_modules/*' \
    -not -path '*/deprecated/*' \
    -print0
)

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

for dest in "${DESTS[@]}"; do
  if [[ -L "$dest" ]]; then
    resolved="$(readlink "$dest")"
    echo "error: skill root must be a directory, not a symlink: $dest -> $resolved" >&2
    exit 1
  fi

  for name in "${names[@]}"; do
    target="$dest/$name"
    if [[ -e "$target" && ! -L "$target" && $REPLACE -ne 1 ]]; then
      echo "error: $target is an existing directory" >&2
      echo "re-run with --replace to move conflicts to timestamped backups" >&2
      exit 1
    fi
  done
done

for dest in "${DESTS[@]}"; do
  mkdir -p "$dest"
  for i in "${!names[@]}"; do
    name="${names[$i]}"
    src="${srcs[$i]}"
    target="$dest/$name"

    if [[ -e "$target" && ! -L "$target" ]]; then
      backup="${target}.pre-tomstack-${timestamp}"
      mv "$target" "$backup"
      echo "backed up $target -> $backup"
    fi

    ln -sfn "$src" "$target"
    echo "linked $name -> $src ($dest)"
  done
done
