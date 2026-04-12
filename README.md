# tomstack

Claude Code plugins by [tombelieber](https://github.com/tombelieber).

## Install

```bash
/plugin marketplace add tombelieber/tomstack
```

Then install any plugin:

```bash
/plugin install claude-backup@tomstack
/plugin install orphan-reaper@tomstack
```

## Plugins

### [claude-backup](https://github.com/tombelieber/claude-backup)

Back up and restore your Claude Code environment — config, sessions, daily auto-sync.

```bash
npx claude-backup sync
```

### orphan-reaper

Kill orphan dev processes (storybook, vite, esbuild, etc.) left behind by AI agent sessions. Auto-cleans on session end via `SessionEnd` hook.

```bash
npx orphan-reaper scan    # list orphans
npx orphan-reaper kill    # kill them
```

An "orphan" is a dev process with no controlling terminal — it outlived the agent session that spawned it. Your intentional terminal processes are never touched.
