# Release promotion

Use this workflow for the in-task release phase of `ship` or for a current
explicit `$auto-pilot release <PR>` / `promote <PR>` invocation. The same task
that owns the command owns its terminal result.

## Establish admission without a handoff dependency

1. Reload the installed Auto Pilot release contract at the start of every turn.
2. Resolve the live PR/MR, current base SHA, head SHA, checks, reviews,
   mergeability, changed production surfaces, and repository release owner.
3. Obtain a promotable `pr_ready` receipt for the live head. Reuse the internal
   receipt created earlier in the same `ship` task. In direct `release`, if no
   valid receipt file is available, run the repository's read-only exact-head
   qualification and create one now. Do not require another task to have left a
   local artifact behind.
4. Hash that receipt and the installed release contract. Bind both hashes, the
   live candidate, current promotable base, impact scope, required credential
   presence, release lock/draft state, dry-run plan, rollback boundary, and
   recovery inputs in one pre-mutation admission packet.
5. If no production or distribution path exists, block before merge. A merge
   cannot satisfy a command whose terminal promise is production delivery.

For `ship`, directly causal release-readiness defects must be fixed while the
PR is still mutable and before this admission is sealed. For direct `release`,
the existing candidate is immutable: do not repeat implementation, edit source,
create commits or branches, open another PR, or repair CI or release tooling.

Admission binds the exact open candidate to current `origin/main` immediately
before irreversible promotion. A changed head, moved base, stale or
scope-mismatched receipt, FAIL/BYPASS evidence, missing deterministic input, or
contract mismatch stops before mutation. Never refresh or start another
attempt automatically.

## Promote once and stay with it

1. Merge through the repository's normal protected path after admission passes.
2. Re-resolve the exact merge SHA and execute from a clean checkout at that
   identity. Do not recompute impact scope or rerun the pre-merge gate after
   merge.
3. Run the repository release owner once. Let it perform approved migrations,
   backfills, deploys, public distribution, checkpoints, smoke, and domain proof
   without duplicating its owned gate immediately beforehand.
4. Wait in the current task for CI, deploy, rollout, and observation. Use bounded
   status reads, event-based wait tools, or the repository monitor. Do not stop
   because an arbitrary conversation timer elapsed or an approval took time.
5. Verify the exact deployed identity, preserved state, health/queue/error
   signals, and each affected capability through its real actor, credential
   class, resource scope, entry point, runtime principal, representative data,
   and expected terminal outcome. Deployment, enqueue, boot, or a neighboring
   provider response is not release proof.

Select production canaries from release impact. Use a runtime-supplied dedicated
test resource through the normal production integration. A provider-specific
change gets one bounded operation for that provider and capability; shared
cross-provider code gets one for each provider actually affected. When
authorization changed, prove both an allowed and denied principal at the exact
boundary.

## Recover without looping

- Before mutation, any genuine deterministic blocker ends this single attempt
  with the exact candidate, last safe boundary, evidence, and one bounded repair
  packet. Never create or run the repair automatically from release mode.
- During a migration or incomplete deploy, reconcile actual remote state before
  deciding anything. Never assume a failed command made no change.
- After mutation begins, use at most one repository-declared bounded recovery
  for the unchanged admitted plan and only after reconciliation. Do not retry
  authentication, authorization, checksum, contract, scope, candidate, or
  source-integrity failures.
- A terminal `blocked` or `released` response seals the release attempt. Later
  turns are read-only.

## Close out without rewriting production truth

Publish or update the canonical release note when the repository has one. The
compact final `release.message` must state what is live and cite exact
production/distribution proof; link the canonical note when it exists.

Attempt safe cleanup only for the task-owned local worktree and branches. First
persist the receipt outside the worktree and inspect clean/unlocked state,
upstream reachability, PR merge state, and ownership. Use `git worktree remove`
from a stable checkout, prune metadata, and safe-delete branches when policy
permits. Never force removal.

Release notes and local cleanup are closeout, not deployment. If production is
already proven live, a note publication or safe local cleanup failure is a
warning recorded in `release` or `cleanup`; it does not change the terminal
state back to `blocked`. Do not hide the warning or claim the closeout step
passed.

## Terminal result

- `released`: the exact merged candidate is deployed or publicly distributed,
  every required affected capability reaches its production terminal outcome,
  and the receipt records any closeout warnings.
- `blocked`: production delivery or proof cannot safely reach that outcome.

There is no merge-only success state for a production command. The release
receipt uses schema version 8 with `promotion`, `release`, `cleanup`, and
`capability_reachability` evidence as described in
[receipt schema](receipt-schema.md).
