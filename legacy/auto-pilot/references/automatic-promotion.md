# In-task ship promotion

Use this for `ship`, `--then-release`, a direct production imperative, or the
`release`, `promote`, and `deploy` aliases. All normalize to the `SHIPPED` goal.

## Continuous ownership

The invoking task owns implementation, PR qualification, admission, merge,
deployment or distribution, production proof, notes, and cleanup. Do not create
a continuation task or require another command after waiting. Native compaction
and ordinary later prompts continue the same active goal. Helpers may return
bounded evidence but never own a stage or production authority.

## Shared PR_READY gate

The same gate qualifies both public `PR_READY` and the internal readiness
transition inside `ship`:

1. Identify the repository release owner, production path, migration/backfill
   and rollback boundaries, required credentials/configuration, release locks,
   notes channel, cleanup policy, and impact-selected production proof.
2. Run dry-run/preflight while the PR is mutable. Fix directly causal in-scope
   failures in the same task.
3. Qualify the exact head against the current promotable base and current
   required CI.
4. Prove `production-regression-compatibility`: every affected existing
   production capability, supported interface/configuration, and representative
   valid current, legacy, and edge-shaped data remains operable; every new or
   tightened release gate accepts that valid baseline.
5. Repair any gate false positive, data compatibility defect, or rollout defect
   while the candidate is mutable, then rerun the affected proof. Do not make a
   working production feature or valid production data fail to satisfy a gate.
6. Record a passed `production-release-ready` check and an exact completion
   inventory. Nothing may remain except the protected production action.

For `pr`, that proves `PR_READY` and no merge occurs. For `ship`, keep it as an
internal artifact and continue; it is not a final answer.

## Attempt-scoped admission

Immediately before mutation, bind the installed contract SHA-256, goal ID,
new attempt ID, live head and base, PR URL, CI, impact scope, release plan, and
recovery inputs. `single_use: true` means the binding cannot authorize a second
mutation attempt. It does not seal the goal, task, or session.

If head, base, contract, CI, scope, or another deterministic input changes,
discard that binding. Repair or wait in this task, then create a new attempt
linked by the prior receipt SHA and change evidence. Never blind-retry the same
unchanged mutation.

## Continue until SHIPPED

After admission, follow [release promotion](release-promotion.md). Merge through
the protected path, deploy the exact candidate, prove every affected new and
existing production capability, publish applicable notes, and finish safe
task-owned cleanup.

The only successful outcome is `SHIPPED`. A blocker or wait creates an
`incomplete` checkpoint and leaves the same goal active. Production live with
unfinished notes or cleanup is still incomplete; resume and finish it here.
