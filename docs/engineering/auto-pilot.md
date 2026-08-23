# Auto Pilot

## What it does

Carries one approved software goal through a verified PR and, only when the
user explicitly authorizes it, into a separate release task with deterministic
evidence.

## When to reach for it

Invoke `$auto-pilot` after a plan is approved and the desired boundary is clear:
PR only, PR followed by release, or release of an existing PR.

## Common questions

- Does PR mode deploy? No. Production authority remains separate.
- Does it require subagents? No. One accountable owner chooses the smallest
  useful execution shape.
- Can release happen automatically? Only from an explicit `ship` or release
  instruction in the same invocation.

## It's working if

The exact candidate has a reviewable PR, machine-checkable evidence, and no
production mutation unless the user granted release authority.
