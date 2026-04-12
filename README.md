<div align="center">

# tomstack

**Claude Code plugins by [tombelieber](https://github.com/tombelieber)**

A curated plugin marketplace for Claude Code. Install the marketplace once, then pick any plugin you need.

<p>
  <a href="https://github.com/tombelieber/tomstack"><img src="https://img.shields.io/github/stars/tombelieber/tomstack?style=social" alt="GitHub stars"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
</p>

```bash
claude plugin marketplace add tombelieber/tomstack
```

</div>

---

## Plugins

| Plugin | npm | Description |
|--------|-----|-------------|
| **[orphan-reaper](./orphan-reaper/)** | [![npm](https://img.shields.io/npm/v/orphan-reaper.svg)](https://www.npmjs.com/package/orphan-reaper) | Kill orphan dev processes left by AI agent sessions |
| **[claude-backup](https://github.com/tombelieber/claude-backup)** | [![npm](https://img.shields.io/npm/v/claude-backup.svg)](https://www.npmjs.com/package/claude-backup) | Back up and restore your Claude Code environment |

---

## Install

**Step 1 — Add the marketplace:**

```bash
claude plugin marketplace add tombelieber/tomstack
```

**Step 2 — Install any plugin:**

```bash
claude plugin install orphan-reaper@tomstack
claude plugin install claude-backup@tomstack
```

Each plugin also works standalone via npx — no marketplace required:

```bash
npx orphan-reaper scan
npx claude-backup sync
```

---

## Related

- **[claude-view](https://github.com/tombelieber/claude-view)** — Mission Control for Claude Code. Monitor every agent session, costs, and tools in one dashboard.
- **[claude-backup](https://github.com/tombelieber/claude-backup)** — Claude Code deletes sessions after 30 days. This saves them.
- **[orphan-reaper](./orphan-reaper/)** — Kill orphan dev processes left by AI agent sessions.

---

<div align="center">

MIT &copy; 2026

</div>
