# Owner-directed execution

The task that receives `$auto-pilot` remains accountable for the goal and its
requested end state. Direct work is valid at any size. Native compaction is the
supported way to continue a long task; do not create a new owner stage merely
to refresh context.

```text
approved goal
  -> invoking owner resolves truth and readiness
  -> direct work plus optional bounded terminal helpers
  -> owner integrates, reviews, verifies, and reaches PR_READY or SHIPPED
```

## Choose execution shape without transferring ownership

`tiny` and `substantive` are advisory. `implementation.substantive_executor`
may prefer `direct`, `subagent`, or `auto`; legacy `task` configuration is read
for compatibility but cannot create a current-contract owner task. If the
preferred interface is unavailable, disclose the fallback and continue in the
invoking task when it meets the capability floor.

Optional helpers must receive a narrow packet:

- exact objective and acceptance boundary;
- allowed files or read-only scope;
- repository and verification commands;
- explicit prohibition on spawning, forking, creating another task, delegating,
  merging, deploying, migrating, rolling back, or mutating production; and
- a bounded result format returning evidence to the owner.

Use isolated worktrees or non-overlapping paths for parallel writers. Integrate
once, then conduct one consolidated review against the approved goal and live
repository state. Do not substitute per-helper review for integrated review.

## Same-task persistence

Stop, SessionEnd, missing receipt evidence, CI waiting, an incomplete attempt,
or a changed external state ends only the current turn/attempt checkpoint. The
active goal remains attached to the same task, and an ordinary follow-up resumes
it without another `$auto-pilot` command.

If an attempt was bound for mutation, keep its evidence immutable. A safe repair
or changed external state creates a new linked attempt under the same goal ID.
That is evidence lineage, not a new owner session.

## Handoff boundary

For `PR_READY`, the invoking owner returns the complete v9 receipt only after
all non-production scope and release readiness are complete. For `SHIPPED`, no
helper or intermediate PR handoff may become the final response; the owner
continues through production proof, applicable notes, cleanup, and an empty
`open_items` list.

Historical cross-task goal breadcrumbs remain readable in history but are not
an allowed current execution route.
