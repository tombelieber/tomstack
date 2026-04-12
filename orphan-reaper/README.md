<div align="center">

# orphan-reaper

**Kill orphan dev processes left by AI agent sessions**

You have 10 AI agents running. Each spawns storybook, vite, esbuild, webpack. The agents finish. The processes don't. Your machine hits 100% CPU and you don't know why.

<p>
  <a href="https://www.npmjs.com/package/orphan-reaper"><img src="https://img.shields.io/npm/v/orphan-reaper.svg" alt="npm version"></a>
  <a href="https://github.com/tombelieber/tomstack"><img src="https://img.shields.io/github/stars/tombelieber/tomstack?style=social" alt="GitHub stars"></a>
  <a href="../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Linux-lightgrey.svg" alt="macOS | Linux">
</p>

```bash
npx orphan-reaper scan
```

</div>

---

## The Problem

AI coding agents (Claude Code, Cursor, Copilot) spawn dev servers as child processes. When the agent session ends, these processes become orphans — no parent, no terminal, invisible, burning CPU and RAM forever.

Your `bun dev` or `npm run dev` pipeline handles cleanup properly. But agents bypass the pipeline and run individual scripts directly. When the agent exits, there's no orchestrator to clean up.

**orphan-reaper finds and kills these orphans. Nothing else.**

---

## Install

| Method | Command |
|--------|---------|
| **npx** (no install) | `npx orphan-reaper scan` |
| **Claude Code plugin** (auto-cleanup) | See [Plugin](#claude-code-plugin) below |
| **Global** | `npm i -g orphan-reaper` |

---

## Usage

```bash
orphan-reaper scan              # List orphan processes (don't kill)
orphan-reaper kill              # Kill all orphans (SIGTERM)
orphan-reaper patterns          # Show matched process patterns
orphan-reaper add 'pattern'     # Add a custom pattern
orphan-reaper version           # Show version
```

### Flags

| Flag | Effect |
|------|--------|
| `--json` | Machine-readable JSON output |
| `--quiet` | Only print if something was killed |

### Example

```bash
$ orphan-reaper scan
  PID 42381  127MB  node .../storybook dev -p 6006
  PID 42399   33MB  node .../esbuild --service --ping
  PID 51002   89MB  node .../vite preview --port 4173

3 orphan(s), ~249MB total

$ orphan-reaper kill
  killed PID 42381  127MB  node .../storybook dev -p 6006
  killed PID 42399   33MB  node .../esbuild --service --ping
  killed PID 51002   89MB  node .../vite preview --port 4173

Killed 3 process(es), freed ~249MB
```

---

## How It Works

A process is an **orphan** if it matches ALL three conditions:

1. **Known dev tool pattern** — matches one of 21 built-in patterns (storybook, vite, esbuild, next, webpack, etc.)
2. **No controlling terminal** — `tty == "??"` means it outlived its parent shell
3. **Not the current script** — self-exclusion to avoid suicide

Processes with a TTY (your intentional terminal sessions) are **never touched**. This is the key safety mechanism — POSIX TTY assignment is the only reliable way to distinguish "user is running this" from "an agent left this behind."

---

## Default Patterns

21 patterns covering the most common dev tools:

| Category | Patterns |
|----------|----------|
| **Component dev** | `storybook dev`, `storybook build` |
| **Bundlers** | `esbuild.*--service.*--ping`, `webpack serve`, `parcel serve`, `rollup.*--watch` |
| **Dev servers** | `vite dev`, `vite preview`, `astro dev`, `astro preview`, `next dev`, `remix dev`, `nuxt dev`, `wrangler dev` |
| **Frameworks** | `angular.*serve`, `turbo.*preview` |
| **Test runners** | `vitest.*--watch`, `jest.*--watch`, `playwright.*test`, `cypress open` |
| **Compilers** | `tsc.*--watch` |

---

## Custom Patterns

Add project-specific patterns to `~/.orphan-reaper/patterns.conf`:

```bash
# Add via CLI
orphan-reaper add 'my-custom-dev-server'

# Or edit directly
echo 'my-custom-dev-server' >> ~/.orphan-reaper/patterns.conf
```

One regex per line. Lines starting with `#` are comments.

---

## JSON Output

All commands support `--json` for scripting and tool integration:

```bash
$ orphan-reaper scan --json
{"ok": true, "count": 2, "total_rss_mb": 160, "orphans": [
  {"pid": 42381, "rss_mb": 127, "command": "node .../storybook dev -p 6006"},
  {"pid": 42399, "rss_mb": 33, "command": "node .../esbuild --service --ping"}
]}

$ orphan-reaper kill --json
{"ok": true, "killed": 2, "freed_rss_mb": 160, "processes": [...]}
```

- Success: `{"ok": true, ...}` with exit code 0
- Error: `{"error": "message"}` on stderr with exit code 1

---

## Claude Code Plugin

orphan-reaper ships as a Claude Code plugin with automatic cleanup on session end.

**Install via marketplace:**

```bash
claude plugin marketplace add tombelieber/tomstack
claude plugin install orphan-reaper@tomstack
```

**What the plugin does:**

| Feature | How |
|---------|-----|
| **`/cleanup` skill** | Type `/cleanup` in Claude Code to scan and kill orphans interactively |
| **Auto-cleanup** | `SessionEnd` hook runs `kill --quiet` when any session ends — zero manual intervention |
| **JSON integration** | All commands output structured JSON for Claude to parse and summarize |

Once installed, orphan processes are cleaned up automatically. You never have to think about it again.

---

## How It Compares

| Approach | Scope | Catches orphans | Safe for user processes | Zero config |
|----------|:-----:|:---------------:|:-----------------------:|:-----------:|
| **orphan-reaper** | Any dev tool | **Yes** (TTY detection) | **Yes** | **Yes** |
| `kill -9 $(lsof -ti :3000)` | Single port | Partial | No | No |
| `pkill -f storybook` | Single pattern | No (kills your terminal too) | **No** | No |
| `concurrently --kill-others` | Same pipeline | No (only co-managed processes) | Yes | Yes |
| Process groups (`setpgid`) | Same group | Yes | Yes | No (requires code changes) |

---

## Requirements

- macOS or Linux
- Bash 4+
- `pgrep`, `ps`, `kill` (pre-installed on macOS and Linux)
- Python 3 (for JSON escaping, pre-installed on macOS)

---

## Part of tomstack

orphan-reaper is part of [tomstack](https://github.com/tombelieber/tomstack), a Claude Code plugin marketplace by [tombelieber](https://github.com/tombelieber).

Other plugins:
- **[claude-backup](https://github.com/tombelieber/claude-backup)** — Back up and restore your Claude Code environment

---

<div align="center">

MIT &copy; 2026

</div>
