# Ship production phase

Use this after the shared PR_READY gate for `ship` or when `release`, `promote`,
or `deploy` starts the same SHIPPED goal from an existing candidate. An alias
does not make the candidate permanently immutable on entry: finish safe,
directly causal readiness work first, then bind the exact mutation attempt.

## Pre-mutation admission

1. Reload the installed Auto Pilot contract and resolve the live PR, current
   base/head, required checks/reviews, mergeability, affected production
   surfaces, and repository release owner.
2. Prove the candidate satisfies the complete PR_READY gate. If a deterministic
   in-scope defect is repairable before mutation, fix it in this task and
   requalify the new head.
3. Bind contract SHA-256, goal ID, attempt ID, exact base/head/PR, required CI,
   impact scope, credentials, dry-run plan, rollback boundary, and recovery
   inputs. Recheck last-moment inputs before mutation.
4. If a required input is missing, do not merge. Record an `incomplete`
   checkpoint with the exact evidence and next safe action. Keep this task
   active; after the input or state changes, create a linked attempt here.

Admission is immutable for one attempt. A moved base, changed head, stale CI,
contract mismatch, or changed scope invalidates that attempt, not the task.

## Promote and verify

1. Merge through the repository's normal protected path.
2. Resolve the exact merged SHA and execute the release from a clean checkout at
   that identity. Do not recompute scope or rerun the pre-merge gate after merge.
3. Run the repository release owner once. Let it perform approved migrations,
   backfills, deployment/distribution, checkpoints, and domain verification.
4. Wait in this task for CI, rollout, and observation using bounded status reads
   or the runtime wait mechanism. Elapsed conversation time is not a blocker.
5. Verify the exact deployed identity and every affected capability through its
   real actor, credential class, resource scope, entry point, runtime principal,
   representative data, and expected terminal outcome. Deployment, enqueue,
   boot, health, or a neighboring provider response is insufficient.

Production canaries are impact-selected and release-only. Use runtime-supplied
dedicated resources through the normal integration. When authorization changed,
prove both allowed and denied principals at the actual boundary.

## Recover without blind loops

- Before mutation, diagnose a blocker and change the relevant code, input, or
  external state before creating another linked attempt.
- After mutation begins, reconcile actual remote state before any retry. Use
  only the repository-defined bounded recovery for the unchanged admitted plan.
- Never retry authentication, authorization, checksum, contract, candidate,
  scope, source-integrity, or safety failures without changed evidence.
- Waiting and failure remain resumable in this task. No response seals the task
  or makes future turns read-only.

## Closeout is part of SHIPPED

Publish or update every applicable release note. Persist the receipt outside a
task-owned worktree, inspect clean/unlocked state and merged reachability, then
remove or policy-complete task-owned worktrees and branches without force.

`SHIPPED` requires successful production proof plus complete applicable notes
and cleanup. `not_applicable` or `retained_by_policy` is complete only with
evidence that no action remains. Any actionable failure, `not_run`, retained
work, TODO, warning, or follow-up keeps `goal.achieved` null and the task active.
