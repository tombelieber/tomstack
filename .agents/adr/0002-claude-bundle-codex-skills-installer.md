# Bundle promoted skills for Claude and use the open installer for Codex

## Context

Claude plugin manifests can list promoted skill directories explicitly. Codex
plugin manifests currently select one skills path and discover recursively,
which cannot safely exclude `in-progress`, `misc`, and `deprecated` buckets.

## Decision

The Claude plugin lists every promoted skill explicitly. Codex and other Agent
Skills-compatible harnesses use `npx skills@latest add tombelieber/tomstack`
to select skills. Do not create a duplicated flattened promoted directory.
