# Auto Pilot

## What it does

Carries one approved software goal through a verified PR and, only when the
user explicitly authorizes it, into a separate release task with deterministic
evidence. The PR stage owns implementation and exact-candidate qualification;
the release task promotes that immutable candidate or stops blocked.

## When to reach for it

Invoke `$auto-pilot` after a plan is approved and the desired boundary is clear:
PR only, PR followed by release, or release of an existing PR.

## Common questions

- Does PR mode deploy? No. Production authority remains separate.
- Does it require subagents? No. One accountable owner chooses the smallest
  useful execution shape.
- Can release happen automatically? Only from an explicit `ship` or release
  instruction in the same invocation.
- Can a blocked release task repair the PR? No. Release tasks are single-use
  and cannot edit code, open another PR, or resume after a terminal result.
- How long should release control take? The default whole-task budget is 10
  minutes from live-PR binding, unless the user or repository declares another
  bound before promotion begins. Unsafe in-flight mutation still reaches its
  next repository-defined safe boundary before stopping.

## It's working if

The exact candidate has a reviewable PR, machine-checkable evidence, and no
production mutation unless the user granted release authority. A successful
release also binds the live head, source-receipt SHA-256, installed contract
SHA-256, and complete-task timing in its validated receipt.
