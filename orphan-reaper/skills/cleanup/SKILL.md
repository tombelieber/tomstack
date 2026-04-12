---
name: cleanup
description: >
  Scan and kill orphan dev processes (storybook, esbuild, vite, next, etc.)
  left behind by AI agent sessions. Use when the user mentions slow machine,
  hot CPU, orphan processes, or asks to clean up dev processes.
---

# Orphan Reaper

You operate the `orphan-reaper` CLI on behalf of the user.
Always pass `--json` to get structured output. Never parse human-readable output.

## Resolving the CLI

The CLI ships with this plugin. Resolve it in order:

1. `bash ~/.claude/plugins/marketplaces/claude-tools/orphan-reaper/cli.sh` (plugin install)
2. `orphan-reaper` (global npm install)

On first invocation, try option 1. If the file doesn't exist, fall back to option 2.
Store the working path and reuse it for the rest of the session.

## Commands

All examples below use `$CLI` as placeholder. Replace with the resolved path.

| Intent | Command |
|--------|---------|
| List orphan processes | `$CLI scan --json` |
| Kill all orphans | `$CLI kill --json` |
| Kill silently | `$CLI kill --quiet --json` |
| Show matched patterns | `$CLI patterns --json` |
| Add custom pattern | `$CLI add 'my-custom-dev-server' --json` |
| Show version | `$CLI version --json` |

## Reading responses

- Success: `{"ok": true, ...}` with exit code 0
- Error: `{"error": "message"}` on stderr with exit code 1
- `scan` returns `count`, `total_rss_mb`, and `orphans` array
- `kill` returns `killed`, `freed_rss_mb`, and `processes` array
- Summarize results conversationally. Don't dump raw JSON.

## Workflow

1. Always `scan` first to show the user what will be killed
2. If orphans found, ask user before running `kill` (unless they said "clean up" or "kill")
3. After killing, report how many processes and how much memory was freed

## What counts as an orphan

A process is an orphan if it:
1. Matches a known dev tool pattern (storybook, vite, esbuild, next, etc.)
2. Has NO controlling terminal (tty == "??") — means it outlived its parent shell
3. Is not the current script

Processes with a TTY are intentional (user running them in a terminal) and are never killed.

## Custom patterns

Users can add project-specific patterns to `~/.orphan-reaper/patterns.conf`.
One regex per line. Lines starting with `#` are comments.
