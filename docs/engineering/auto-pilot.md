# Auto Pilot

Thin guidance for two actions with one fully verified release-readiness bar:

- `pr` → `PR_READY`: finish implementation, review, tests/CI, compatibility and
  migration rehearsals, release preflight and all required inputs. Prepare
  rollback and production proof. Only merge and production release actions,
  including their post-release checks, remain; keep the PR unmerged.
- `ship` → `SHIPPED`: meet the same prerequisites, then merge, release, prove
  affected capabilities on the exact deployed candidate and finish closeout.

Use `$auto-pilot pr <goal or PR>` or `$auto-pilot ship <goal or PR>`.
`release`, `promote` and `deploy` remain ship aliases. Routine questions and
coding do not invoke Auto Pilot automatically.

The agent finds facts itself. If consequential decisions are missing, it uses
[Batch Grill Me](batch-grill-me.md), records the agreed goal/spec and confirms
shared understanding before implementation. Install both skills when selecting
individual skills rather than the complete plugin.

The agent uses existing repository tools, reuses still-valid evidence, and
remains accountable through waits and repairs. There is no required receipt,
validator, configuration resolver, routing marker or history hook. A concise
summary links the actual verification evidence and remaining work. Repository
release requirements still apply; reducing paperwork never reduces quality.

The old receipt implementation lives outside skill discovery in
`legacy/auto-pilot/`, preserving historical validation semantics. The Codex
marketplace selects the published standalone version pinned in its manifest;
canonical skill and standalone releases are verified separately.
