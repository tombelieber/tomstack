# In-task ship promotion

Use this only when the current invocation explicitly selects `ship`,
`--then-release`, or directly orders implementation followed by production
delivery. The command grants one continuous in-scope delivery mandate.

## Keep ownership continuous

Do not create, fork, or hand off to another user-visible task. The current
accountable owner stays active through implementation, PR creation, admission,
merge, deploy or distribution, production proof, and closeout. Native context
compaction is still the same task. Optional bounded helpers return to this owner
and never receive release authority.

Do not send a final answer at PR readiness. Store a validated `pr_ready` receipt
as an internal handoff and continue immediately. If progress requires waiting,
wait for CI, deployment, and observation inside the current task with bounded
status reads or the runtime's wait mechanism.

## Make the PR releasable before final admission

1. Read the repository release, migration, verification, and rollback contracts
   before the final candidate gate.
2. Prove a production release path before merge. A repository with no deploy or
   public distribution owner cannot satisfy `ship`; stop before merge instead
   of treating merge as success.
3. Run the repository dry-run/preflight while the PR can still change. Resolve
   deterministic scope, credential presence, environment, deploy targets,
   migration/backfill compatibility, release lock/draft state, recovery inputs,
   and impact-selected production proof.
4. Fix directly causal in-scope readiness defects on the same PR, then run the
   final exact-candidate gate and current required CI on the intended head.
5. Create the internal `pr_ready` receipt, hash it, compute the installed
   release-contract SHA-256, and re-read the live PR and current base. Any head
   or base change invalidates admission and ends this attempt.

This ordering prevents the release stage from discovering deterministic inputs
that the PR stage could have supplied. Do not repeatedly open PRs or rerun an
unchanged full gate merely to move between stages.

## Continue to the terminal promise

After admission, treat the candidate as immutable and follow
[release promotion](release-promotion.md) in the same task. The explicit `ship`
command is the production authority recorded in `promotion.authority_evidence`.
Do not ask whether to merge, deploy, publish, run an impact-selected canary, or
finish closeout when those actions remain inside the approved scope.

End only as:

- `released`: the exact merged candidate is deployed or publicly distributed
  and its affected capability reached the required production terminal outcome;
  or
- `blocked`: a genuine authority, credential, safety, compatibility, changed
  candidate/base, provider, or ambiguous-remote-state barrier prevents that
  outcome.

An open PR, `pr_ready`, merge success, deploy start, deployment without terminal
proof, elapsed time, and unavailable task creation are never successful `ship`
outcomes. A blocker ends this attempt with one bounded repair packet; do not
create or start another attempt automatically.
