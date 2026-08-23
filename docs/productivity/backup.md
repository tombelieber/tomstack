# Backup

## What it does

Operates the `claude-backup` CLI to inspect, create, export, and restore Claude
Code configuration and session backups through structured JSON responses.

## When to reach for it

Use it for backup status, machine migration, session discovery, configuration
exports, or an explicitly requested restore.

## Common questions

- Can it work without GitHub? Yes, local and custom Git backends are supported.
- Should it restore immediately? Preview the candidate session first.
- Does the Tomstack skill include the CLI? No. It resolves the standalone CLI
  from PATH, its legacy plugin, or npm.

## It's working if

The correct backup backend and machine are visible, restore targets are
previewed, and destructive overwrite flags are used only when requested.
