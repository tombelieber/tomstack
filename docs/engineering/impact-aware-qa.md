# Impact-Aware QA

## What it does

Selects the smallest repository-defined checks that can falsify a change while
escalating unknown, shared, and safety-critical impact.

## When to reach for it

Use it while implementing or reviewing a change, choosing pre-push evidence,
or deciding whether a detached surface needs verification.

## Common questions

- Does it skip tests by default? No. It selects evidence from actual impact.
- Does a passing cached result qualify a new candidate? Only when identity and
  relevant inputs still match.
- How do I know selection is actually faster and safe? Run representative
  candidates in shadow mode and summarize v2 receipts; selected green/full red
  is a false negative and blocks promotion.
- What if main is already red? Record a referenced known failure, but keep the
  candidate outcome failed. Baseline ownership is not a waiver.
- Does it authorize a release? Never.

## It's working if

The report names selected and skipped checks, gives current results, and leaves
unknown or release-only boundaries explicit. Repository classifiers remain in
their repository owner; this skill does not create a second path map or runner.
