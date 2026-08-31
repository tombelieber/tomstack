# Auto Pilot

## What it does

Carries one approved software goal to exactly one of two successful outcomes:

- `PR_READY`: an open, unmerged PR is fully production-release-ready. Its only
  remaining product action is production release or deployment.
- `SHIPPED`: the exact candidate is merged, released or distributed, deployed
  where applicable, proven on the real production capability, documented, and
  cleaned up with zero scoped leftovers.

`pr` targets `PR_READY`. `ship` targets `SHIPPED`; `release`, `promote`, and
`deploy` are aliases for that same goal, not separate modes. A merge, tag, or
successful deployment without exact production proof is not `SHIPPED`.

An attempt may end as incomplete, waiting, blocked, or failed without ending
the goal. The invoking task stays accountable and resumes through safe repair,
changed evidence, or external-state progress until it reaches its requested
outcome.

## When to reach for it

Invoke `$auto-pilot` after a plan is approved and the desired boundary is clear:
production-ready PR, or complete same-task delivery to production.

## Common questions

- Does `pr` deploy? No. It stops only at `PR_READY`.
- Does `ship` create a release task? No. The same task owns the full `SHIPPED`
  outcome; optional helpers remain bounded leaves.
- Can Auto Pilot fix release-readiness defects? Yes. It repairs directly causal,
  in-scope defects before binding an immutable attempt. If evidence changes or
  an attempt fails safely, it creates a linked attempt in the same task rather
  than locking the goal or blindly replaying a mutation.
- Is there a release timer? No arbitrary conversation or whole-task cutoff.
  Auto Pilot waits through bounded status reads and resumes after real external
  progress.
- What if production is temporarily unreachable? Record an incomplete attempt,
  preserve the evidence, and continue the active goal in this same task when
  safe progress becomes possible.
- What proves a production migration? Representative data from the supported
  old production version must pass the real upgrade path, then work through the
  new system's reads, applicable writes, and impacted critical workflows. A
  migration marker, row count, or retained record alone does not qualify.
- Can a new release gate reject a working production path? No. Every candidate
  must prove affected existing behavior, supported interfaces/configuration,
  and representative valid current, legacy, and edge-shaped data still work.
  New or tightened gates are tested against that baseline. False positives and
  compatibility gaps are repaired before admission; working behavior or valid
  data is never disabled merely to make the gate pass.

## It's working if

A `PR_READY` result has an exact-candidate-qualified open PR whose only next
product action is production release or deployment. A `SHIPPED` result binds
the admitted candidate and installed contract, reaches production through the
repository-owned path, proves the exact deployed capability and any migrated
legacy data through the new system, re-proves affected existing production
capabilities, completes release notes and task-owned cleanup, and leaves no
scoped TODO or follow-up.
