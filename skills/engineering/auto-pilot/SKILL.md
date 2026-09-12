---
name: auto-pilot
disable-model-invocation: true
description: "Guide explicit PR or ship requests; PR stops before merge, ship qualifies and verifies production."
---

# Auto Pilot

```text
$auto-pilot pr <goal, spec, plan, or PR>
$auto-pilot ship <goal, spec, plan, or PR>
```

`release`, `promote`, and `deploy` are aliases for `ship`.

## One quality bar, two actions

Both modes require the same fully verified, shippable candidate.

- **`pr` → `PR_READY`:** all implementation, review, verification and release
  prerequisites are complete. The exact candidate is ready to release; only
  merge and production release actions, including their post-release checks,
  remain. Keep the PR open and unmerged; do not mutate production.
- **`ship` → `SHIPPED`:** reach that same readiness, then merge, release and
  verify the exact candidate in production. Finish applicable release notes and
  safe task-owned cleanup, with no scoped leftovers.

An open PR alone is not `PR_READY`. A deployment or health check alone is not
`SHIPPED`.

## Pin down the outcome

Inspect the repository and environment to resolve facts yourself. If context
leaves consequential scope, acceptance, rollout or authority decisions open,
use the bundled `$batch-grill-me`: ask the current decision frontier together,
give recommendations, and wait for answers before dependent decisions or work.
Record the agreed goal/spec and obtain confirmation of shared understanding
before implementation. Reuse prior confirmed decisions; do not interview again
for a clear technical fix or a fact you can inspect.

## Reach release readiness

Use the repository's existing instructions, tools and verification paths.
Implement, review, fix, verify, commit, push and prepare the PR. Use focused
checks while editing, then complete every applicable release prerequisite
against the exact candidate and current base:

- Required tests and CI, integration checks, and representative existing
  production behavior/data, including legacy and edge cases. New gates must
  accept valid supported state.
- Applicable migration/upgrade rehearsals proving the new system can operate
  migrated data, plus rollout order, mixed-version compatibility or cutover.
- Release dry-run/preflight, required credentials/permissions/configuration,
  exact deployment steps, rollback/recovery, and impact-selected production
  proof steps with their required resources ready.

Missing evidence, a failed check or an unresolved prerequisite means not ready.
Repair in scope and requalify. Reuse evidence only while its candidate, inputs,
toolchain and environment remain valid; recheck freshness before promotion.
In `pr`, report `PR_READY` with the PR/candidate and concise verification evidence.

## Release in ship mode

Execute the approved release through the repository's normal path. If the
candidate, base or release inputs change, requalify before mutation. After an
uncertain mutation, reconcile actual state before the defined bounded recovery.
Do not blindly retry.

Verify affected capabilities through their real production entry points, actor,
credential and resource scope, using representative data and observing terminal
outcomes on the exact deployed candidate. Include existing behavior, migrated
legacy data when applicable, and allowed/denied principals for authorization
changes. Report `SHIPPED` only after this proof and all scoped closeout work.

## Keep execution light

Stay accountable in this task through repairs, waits and compaction. Continue
independent work while dependencies run; use completion events or bounded waits.
Pause only for a real missing decision/authority/input or an unresolved unsafe
state. An incomplete checkpoint remains resumable in the same task.

This skill supplies guidance, not a harness. Use concise evidence and remaining
work in ordinary prose. Do not create scripts, receipt schemas, IDs, routing
markers or status files just to satisfy Auto Pilot; it requires no configuration
resolver, validator or history hooks. Repository-required artifacts and useful
reusable product tests still apply. Inherit the session's execution preferences.
