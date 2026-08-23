# Bundle promoted skills for Claude and use the open installer for Codex

## Context

Claude plugin manifests can list promoted skill directories explicitly. Codex
plugin manifests currently select one skills path and discover recursively,
which cannot safely exclude `in-progress`, `misc`, and `deprecated` buckets.

## Decision

The Claude plugin lists every promoted skill explicitly. Codex and other Agent
Skills-compatible harnesses use `npx skills@latest add tombelieber/tomstack`
to select skills. The installer writes Agent Skills-compatible copies under
`.agents/skills`; the maintainer linker mirrors that convention. Do not create
a duplicated flattened promoted directory.

## Validation boundary

Cross-harness validation requires both real distribution paths. Claude strict
plugin validation owns Claude-only frontmatter such as
`disable-model-invocation`; the Agent Skills installer owns Codex discovery and
copying, while `agents/openai.yaml` owns Codex invocation policy. A Codex-only
frontmatter validator may reject that Claude extension on user-invoked skills,
so it is not sufficient evidence for the shared bundle by itself.
