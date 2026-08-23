# Tomstack skills repository contract

This repository is the canonical source for Tom Tang's reusable agent skills.
Standalone tool repositories may keep compatibility snapshots for their own
installers, but new reusable skill work starts here.

Read [docs/SOURCES.md](./docs/SOURCES.md) before changing a migrated skill. It
records the former one-skill repository and any product-specific compatibility
snapshot that still exists.

## Skill lifecycle

Skills live in bucket folders under `skills/`:

- `engineering/`: promoted skills for software delivery and verification.
- `productivity/`: promoted skills for product and agent workflows.
- `in-progress/`: public drafts that are not shipped in the plugin.
- `misc/`: retained skills that are not promoted.
- `deprecated/`: retired skills kept only for history.

Every promoted skill must have all of the following:

1. A `SKILL.md` and `agents/openai.yaml` in its skill directory.
2. A linked entry in the root README and its bucket README.
3. A human-facing page at `docs/<bucket>/<skill-name>.md`.
4. An explicit path in `.claude-plugin/plugin.json`.

Non-promoted skills must not appear in the root README's promoted lists, the
human-facing docs tree, or `.claude-plugin/plugin.json`.

## Invocation policy

Each skill is either user-invoked or model-invoked. User-invoked skills set
`disable-model-invocation: true` in `SKILL.md` and
`policy.allow_implicit_invocation: false` in `agents/openai.yaml`. Model-invoked
skills omit both settings. Keep the two harness contracts in sync.

## Distribution

The root Claude plugin ships exactly the promoted set. Codex and other
Agent-Skills-compatible harnesses install selected skills with `skills@latest`;
do not commit a second flattened copy for a native Codex bundle.

Keep `package.json` and `.claude-plugin/plugin.json` versions equal. After the
initial `0.1.0` bootstrap, every behavioral skill change needs a Changeset. Run
`npm run check` and `claude plugin validate . --strict` before commit.

`scripts/link-skills.sh` is maintainer-only local linking, not the public
installer. It must not silently delete an existing non-symlink skill directory.
