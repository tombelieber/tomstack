# Tomstack

Tom Tang's canonical collection of reusable agent skills, plus the public
marketplace for standalone agent tools.

Skills are maintained together here so invocation metadata, documentation,
release versions, and install paths do not drift one repository at a time.
Standalone products keep their own repositories when they have a CLI, runtime,
MCP server, or independent release lifecycle.

## Install the skills

### Claude Code managed bundle

```bash
claude plugin marketplace add tombelieber/tomstack
claude plugin install tomstack-skills@tomstack
```

The plugin is a managed, read-only bundle of every promoted skill.

### Codex and other agents

```bash
npx skills@latest add tombelieber/tomstack
```

Choose the skills and target agents you want. Installing both the Claude bundle
and copied Claude skills creates duplicates, so use one Claude route.

Install or update one skill:

```bash
npx skills@latest add tombelieber/tomstack --skill=<name>
npx skills@latest update <name>
```

## Skills

### Engineering

**User-invoked**

- **[auto-pilot](./skills/engineering/auto-pilot/SKILL.md):** Reach exactly `PR_READY` or `SHIPPED`; keep the invoking task resumable through waits and repairs, and allow no scoped leftovers at success.

**Model-invoked**

- **[impact-aware-qa](./skills/engineering/impact-aware-qa/SKILL.md):** Choose the smallest sufficient repository verification without losing correctness.

### Productivity

**User-invoked**

- **[first-principles-xy-problems](./skills/productivity/first-principles-xy-problems/SKILL.md):** Deep, design-only problem discovery before choosing a solution.

**Model-invoked**

- **[backup](./skills/productivity/backup/SKILL.md):** Manage and restore Claude Code backups.
- **[chatgpt-share-dump](./skills/productivity/chatgpt-share-dump/SKILL.md):** Archive ChatGPT share links into agent-readable context.
- **[cleanup](./skills/productivity/cleanup/SKILL.md):** Find and clean orphaned development processes safely.
- **[pain-point-mining](./skills/productivity/pain-point-mining/SKILL.md):** Turn real interaction history into ranked product pain points and requirements.

Draft, retained, and retired skills live in `skills/in-progress`, `skills/misc`,
and `skills/deprecated`; they are not shipped in the managed plugin.

[Source map and compatibility boundaries](./docs/SOURCES.md)

## Standalone tools marketplace

These products retain independent repositories and releases because they ship
more than a skill:

| Product | Distribution | Purpose |
|---|---|---|
| [codex-auto-pilot](https://github.com/tombelieber/codex-auto-pilot) | Codex marketplace, GitHub | Two-outcome PR_READY/SHIPPED delivery with resumable same-task ownership |
| [claude-backup](https://github.com/tombelieber/claude-backup) | Claude marketplace, npm | Claude Code backup and restore CLI |
| [chatgpt-share-dump](https://github.com/tombelieber/chatgpt-share-dump) | Claude marketplace, GitHub | ChatGPT share archive CLI |
| [pain-point-mining-agent](https://github.com/tombelieber/pain-point-mining-agent) | Claude marketplace, GitHub | Product-signal mining workflow |
| [orphan-reaper](./orphan-reaper/) | Claude marketplace, npm | Orphan development-process cleanup CLI |

Install individual plugins from the same marketplace when you need their
bundled executable or hooks:

```bash
claude plugin install orphan-reaper@tomstack
claude plugin install claude-backup@tomstack
claude plugin install chatgpt-share-dump@tomstack
claude plugin install pain-point-mining-agent@tomstack
```

## Maintainer workflow

```bash
npm install
npm run check
claude plugin validate . --strict
```

Add new work under `skills/in-progress`. Promotion into `engineering` or
`productivity` requires root and bucket README entries, a human-facing docs
page, `agents/openai.yaml`, and an explicit Claude plugin manifest path.

For local development, `scripts/link-skills.sh` links repository skills into
`~/.claude/skills` and the Agent Skills-compatible `~/.agents/skills` root. It
refuses to replace existing directories unless `--replace` is provided, in
which case it moves them to timestamped backups first.

MIT © 2026 Tom Tang
