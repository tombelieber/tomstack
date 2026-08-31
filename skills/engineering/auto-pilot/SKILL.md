---
name: auto-pilot
disable-model-invocation: true
description: "Finish one approved software goal at exactly one of two successful boundaries: PR_READY, meaning the open candidate is fully production-release-ready and only the production action remains; or SHIPPED, meaning the exact candidate is live and proven in production with zero scoped leftovers. The invoking task remains accountable and resumable through waits, repairs, retries, and changed external state."
---

# Auto Pilot

Start with one explicit goal mode:

```text
$auto-pilot pr /path/to/approved-plan.md
$auto-pilot ship /path/to/approved-plan.md
```

`release`, `promote`, and `deploy` are compatibility aliases for `ship` starting
from an existing candidate. They are telemetry, not a third goal mode.

Read [receipt schema](references/receipt-schema.md) before producing evidence.
Read [owner-directed execution](references/delegated-implementation.md) before
implementation. For `ship` and its aliases, also read
[in-task promotion](references/automatic-promotion.md) and, before merge or any
production mutation, [release promotion](references/release-promotion.md).

## The only two successful end states

1. `PR_READY` — one open, unmerged PR is fully production-release-ready. The
   exact head and current base are qualified, required CI is current, the real
   release path and preflight are proven, credentials/configuration/migrations/
   recovery inputs are ready or explicitly not applicable, applicable legacy
   production data is proven operable through the new system, existing supported
   production behavior and valid data remain operable, new or tightened release
   gates accept the valid production baseline, and every scoped implementation,
   review, test, documentation, and readiness item is complete.
   The only remaining action is the protected production release.
2. `SHIPPED` — the exact candidate is merged, released or distributed, and
   proven through each affected production capability. Applicable release notes
   and safe task-owned cleanup are complete. There is no scoped TODO, follow-up,
   actionable warning, or leftover.

`waiting`, `blocked`, `incomplete`, and `unknown` are resumable statuses, not
achieved goal end states. An open PR, merge, deploy start, healthy process, or
successful deployment without exact production proof is never `SHIPPED`.

## Keep the invoking task accountable

1. The task that receives the command owns the goal until `PR_READY` or
   `SHIPPED`. Native compaction, Stop, SessionEnd, waiting, a failed attempt, or
   a final response does not transfer ownership and does not make later turns
   read-only.
2. Continue ordinary follow-up in the same task. If the user supplies missing
   input or external state changes, resume there without requiring another
   `$auto-pilot` command, session, or task.
3. Optional collaboration helpers are bounded terminal leaves. They may not
   spawn, fork, create another owner task, delegate, merge, deploy, migrate,
   roll back, or own production. Their result returns to the invoking owner.
4. Never abandon the goal merely because CI, deployment, review, or observation
   takes time. Use bounded status reads or the runtime wait mechanism and keep
   working through normal failures.

## Resolve preferences

Read [configuration](references/configuration.md) and run its resolver once for
a real invocation. Invocation flags override optional user config, which
overrides defaults. Preferences never transfer goal ownership. State the
resolved implementation preference and target end state in one concise update.

## Build one release-ready candidate

1. Resolve the approved artifact and repository truth. Discover the real
   release, migration, rollback, verification, and cleanup owners immediately.
2. Run the release dry-run/preflight while the PR is mutable. Surface affected
   scope, credential presence, configuration, deploy targets, migrations or
   backfills, supported source versions, representative legacy data, mixed-
   version or cutover boundaries, locks/drafts, recovery inputs, notes, cleanup
   policy, the current supported production behavior/data baseline, newly added
   or tightened gates, and the required impact-selected production cases.
3. Implement, review once after integration, fix directly causal in-scope
   defects, verify, commit, push, and open one final PR. Use focused checks while
   the head moves; run the complete required exact-candidate gate on the head
   intended for promotion.
4. Prove the `production-release-ready` check. If any deterministic readiness
   input is missing, safely repair it in the same task while the candidate is
   mutable. When migration applies, also prove `production-data-compatibility`
   by upgrading representative legacy and edge-shaped data and exercising the
   new system's reads, applicable writes, critical workflows, and invariants.
   Always prove `production-regression-compatibility` against existing supported
   capabilities, interfaces, configuration, and representative valid current,
   legacy, and edge-shaped data. If that proof finds a gate false positive, data
   compatibility defect, or rollout defect, repair it before admission; never
   disable working production behavior or strand valid data to make a gate pass.
   Pause only for genuine authority, credential, destructive-data, billing,
   incompatible migration, safety, or ambiguous-remote-state decisions.
5. For `pr`, validate a schema-v10 `PR_READY` receipt and stop before merge. For
   `ship`, treat readiness as an internal transition and continue immediately.

## Ship to production

1. Bind the live head, current promotable base, required CI, impact scope,
   installed contract digest, goal ID, attempt ID, release plan, and recovery
   inputs immediately before irreversible mutation. The binding is immutable
   and single-use for that attempt only; it never seals the task or goal.
2. If a pre-mutation fact changes, do not use the stale binding. Diagnose and
   fix the in-scope cause, or wait for the required state, then create a new
   linked attempt in this same task. Do not blindly rerun an unchanged mutation.
3. Merge through the protected repository path, resolve the exact merged SHA,
   and run the repository release owner. After mutation, reconcile actual remote
   state before any repository-defined bounded recovery; never guess whether a
   failed command changed production.
4. Prove each affected capability through its real actor, credential class,
   resource scope, entry point, runtime principal, representative data, exact
   deployed identity, and terminal outcome. When authorization changed, prove
   both an allowed and denied principal at the real boundary. When production
   data migrated, link the compatibility check to an impact-selected production
   case that operates a migrated legacy record through the new system. Link the
   regression-compatibility check to production cases for the affected existing
   capabilities and prove their expected terminal outcomes still hold.
5. Complete every applicable release-note and safe task-owned cleanup action.
   A failure here is a valid `incomplete` checkpoint even if production is live;
   repair it in the same task before claiming `SHIPPED`.

## Persist without looping or giving up

- Retry ordinary deterministic work only after diagnosing a cause and changing
  the relevant code, input, or external state. Preserve prior receipt hashes
  and use a new attempt ID.
- Authentication, authorization, checksum, source-integrity, candidate, or
  safety failures are never blind-retried.
- A successful migration command, marker, schema version, backfill count, row
  count, or retained data presence never proves compatibility by itself. If the
  new system cannot operate migrated legacy data, the goal remains incomplete.
- External pending state remains active and monitored in this task. Missing user
  authority becomes `waiting` with one exact requested input; once supplied,
  continue in the same task.
- A checkpoint may describe the last safe boundary and next safe action, but it
  must not call itself a third terminal outcome, completion, or permanent seal.

## Prove completion

Create and validate a version-10 receipt:

```bash
python3 <skill-dir>/scripts/validate_receipt.py <receipt.json>
```

An achieved receipt has `goal.achieved` equal to `PR_READY` or `SHIPPED`,
`attempt.result: achieved`, and `open_items: []`. An unfinished attempt has
`goal.achieved: null`, `attempt.result: incomplete`, and at least one structured
`open_items` entry; it keeps the goal active.

Append one routing marker and the receipt marker:

```text
<!-- auto-pilot-routing: {"goal_id":"apg_...","implementation":{"lane":"direct","task_ref":null,"worktree":null,"model":"gpt-5.6-sol","thinking":"xhigh","reason":"The invoking task remained accountable."},"continuation":{"lane":"current_ship_task","task_ref":null,"worktree":null,"model":"gpt-5.6-sol","thinking":"xhigh","reason":"The same task continued through production."}} -->
<!-- auto-pilot-receipt: /absolute/path/to/receipt.json -->
```

Use `continuation.lane: not_requested` for `pr` and `current_ship_task` for
`ship` plus every alias. For `SHIPPED`, the final visible content must end with
the exact Markdown stored in `release.message`. Do not commit agent-control
artifacts unless the repository explicitly requires them.
