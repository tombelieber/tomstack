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
- Does it authorize a release? Never.

## It's working if

The report names selected and skipped checks, gives current results, and leaves
unknown or release-only boundaries explicit.
