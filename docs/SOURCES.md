# Skill source map

Tomstack is the canonical source for the reusable skill contracts below. The
former repositories redirect skill users here and remain available only where
they also ship a CLI, hooks, tracking infrastructure, or an existing public
install path.

| Skill | Canonical Tomstack path | Former or compatibility source |
|---|---|---|
| `auto-pilot` | `skills/engineering/auto-pilot` | [`tombelieber/codex-auto-pilot`](https://github.com/tombelieber/codex-auto-pilot) still owns the CLI, hooks, release receipts, and standalone Codex plugin |
| `impact-aware-qa` | `skills/engineering/impact-aware-qa` | [`tombelieber/impact-aware-qa`](https://github.com/tombelieber/impact-aware-qa) is a frozen historical distribution that redirects here |
| `backup` | `skills/productivity/backup` | [`tombelieber/claude-backup`](https://github.com/tombelieber/claude-backup) still owns the CLI, scheduler, npm package, and standalone Claude plugin |
| `chatgpt-share-dump` | `skills/productivity/chatgpt-share-dump` | [`tombelieber/chatgpt-share-dump`](https://github.com/tombelieber/chatgpt-share-dump) still owns the CLI, tracked installer, and archive implementation |
| `cleanup` | `skills/productivity/cleanup` | `orphan-reaper/skills/cleanup` remains a product-plugin compatibility snapshot until the CLI is extracted from this repository |
| `first-principles-xy-problems` | `skills/productivity/first-principles-xy-problems` | Migrated from the former local-only Codex skill |
| `pain-point-mining` | `skills/productivity/pain-point-mining` | [`tombelieber/pain-point-mining-agent`](https://github.com/tombelieber/pain-point-mining-agent) still owns its CLI installer and tracked distribution |

Edit reusable decision logic in Tomstack first. Product repositories own
runtime implementation and may keep narrowly adapted skill snapshots while
their legacy install paths remain supported. Do not replace those snapshots
with symlinks: plugin packaging and GitHub installs must preserve real files.
