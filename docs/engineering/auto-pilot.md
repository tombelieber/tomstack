# Auto Pilot

## What it does

Carries one approved software goal to the boundary named by the current
command. `pr` delivers a verified open, unmerged PR. `ship` keeps the invoking
task accountable through implementation, PR qualification, merge, deployment
or public distribution, and production proof. Direct `release` promotes an
existing PR in its invoking task.

`pr_ready` is terminal only for `pr`; it is an internal admission artifact in
`ship`. `ship` and `release` finish only as `released` or `blocked`. A merge or
successful deploy without exact production reachability is not completion.

## When to reach for it

Invoke `$auto-pilot` after a plan is approved and the desired boundary is clear:
PR only, same-task PR-to-production delivery, or production promotion of an
existing PR.

## Common questions

- Does `pr` deploy? No. It stops at a verified unmerged PR.
- Does `ship` create a release task? No. The same task owns the full production
  outcome; optional helpers remain bounded terminal leaves.
- Can Auto Pilot fix release readiness defects? During `ship`, it fixes directly
  causal in-scope defects while the PR is still mutable. Direct `release` and an
  admitted ship candidate remain immutable.
- Is there a release timer? No arbitrary conversation or whole-task cutoff.
  Auto Pilot waits through bounded status reads; a real provider or repository
  timeout can still block.
- What if no production path exists? It blocks before merge and returns one
  bounded repair packet.

## It's working if

A `pr` result has an exact-candidate-qualified open PR. A `ship` or `release`
result binds the admitted candidate and installed contract, reaches production
through the repository-owned path, and proves the exact deployed capability.
Release-note or task-owned local cleanup failures after live proof remain
explicit closeout warnings; they do not rewrite `released` as `blocked`.
