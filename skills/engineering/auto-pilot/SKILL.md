---
name: auto-pilot
description: "Finish one approved software goal at the boundary named by the current command. `pr` delivers a verified unmerged PR. `ship` keeps the same accountable task through PR, merge, deploy or distribution, and production proof. `release` promotes an existing PR in the current task. Ship and release end only as released or blocked, never at PR readiness or merge-only."
disable-model-invocation: true
---

# Auto Pilot

Use one explicit command at the start of the prompt:

```text
$auto-pilot pr /path/to/approved-plan.md
$auto-pilot ship /path/to/approved-plan.md
$auto-pilot release <PR URL or number>
```

`pr` owns implementation through an open, unmerged, production-ready PR.
`ship` is one end-to-end production mandate: the same accountable task owns
implementation, PR, merge, deployment, and production proof. `release` starts
from a live existing PR and owns promotion in the current task. Do not create a
user-visible continuation task for either command.

Read [receipt schema](references/receipt-schema.md) before recording an internal
`pr_ready` handoff or any terminal result. For implementation, read
[owner-directed execution](references/delegated-implementation.md). For `ship`,
read [in-task promotion](references/automatic-promotion.md). Before any merge or
external mutation, read [release promotion](references/release-promotion.md).

## Resolve preferences

Read [configuration](references/configuration.md) and run its resolver once for
a real invocation. Current-invocation flags override optional user config,
which overrides defaults. Model and thinking values are preferences, not
evidence or authority. They never cause a `ship` or `release` handoff.

State the resolved implementation preference and the requested terminal
boundary in one concise commentary update. Never describe a collaboration
subagent as an independent Codex task or substitute one execution kind for
another.

## Select the terminal promise

1. Use `pr` by default: implement, verify, open the PR, and finish as `pr_ready`
   or `blocked`. It grants no merge or production authority.
2. Use `ship` only from the explicit subcommand, `--then-release`, or a direct
   current imperative to implement and go live. It grants routine in-scope PR
   merge, migration, deploy, distribution, impact-selected canary, production
   verification, and release-note actions without another confirmation.
3. Use `release` only from an explicit current `release` or `promote` command
   naming an existing candidate.
4. A `ship` or `release` invocation ends only as `released` or `blocked`.
   `pr_ready`, an open PR, a merge, a deployment start, and a successful deploy
   without production proof are not terminal success.
5. If no production or public distribution path exists, return `blocked`
   before merge. Never convert that absence into merge-only success.

Production authority remains bounded to the approved scope. Stop for destructive
user-data repair, a changed product scope, a new secret or permission, billing
or material spend, an incompatible migration decision, or ambiguous remote
state. Routine release mechanics already covered by `ship` or `release` do not
need another prompt.

## Keep one accountable controller

1. The active owner works directly and remains responsible for the terminal
   promise. Native compaction continues the same task.
2. A `ship` run must not hand unfinished implementation or release ownership to
   another user-visible task. If collaboration is explicitly available and
   useful, bounded helpers are terminal leaves; they cannot spawn, fork, create
   another task, delegate, merge, deploy, migrate, roll back, or own production.
3. Give parallel writers non-overlapping paths or isolated worktrees. Fan
   results back once, then review the integrated candidate once rather than
   reviewing each worker, commit, or partial change.
4. Share repository state, Git identities, test artifacts, and compact
   handoffs—not copied conversation history or hidden reasoning.

## PR and ship preparation

1. Resolve the approved artifact and repository truth. For `ship`, discover the
   real release owner and prove a production or distribution path immediately,
   before spending the final exact-candidate gate.
2. Run the repository dry-run/preflight early enough to expose deterministic
   release inputs: affected scope, credential presence, migration/backfill and
   rollback boundaries, release lock/draft state, deploy targets, and required
   production proof. Fix directly causal in-scope defects on the same PR while
   it is still mutable.
3. Integrate implementation, perform one consolidated review, patch findings,
   commit, push, and open one final PR. Use focused evidence while the head is
   moving; run the complete repository-required exact-candidate gate only on
   the head intended to merge.
4. An open PR reaches `pr_ready` only with promotable PASS exact-candidate
   evidence and current required CI for its live head. FAIL, BYPASS, missing,
   stale, unpromotable, or scope-mismatched evidence is not ready.
5. In `pr`, emit the terminal `pr_ready` receipt and stop without merge or
   production mutation. In `ship`, write and hash that receipt as an internal
   immutable handoff, but do not send a final response: `pr_ready` is an
   internal transition, never the final result of `ship`.
6. Immediately bind the admitted candidate to the current promotable base. If
   the base or head changes after admission, stop `blocked`; do not refresh,
   requalify, re-admit, or start another attempt automatically.

## Release execution

1. At the start of every release turn, reload this installed `SKILL.md`,
   [release promotion](references/release-promotion.md), and
   [receipt schema](references/receipt-schema.md).
2. For direct `release`, create a fresh read-only `pr_ready` receipt from the
   live exact candidate when no valid prior receipt is available. Do not treat
   a missing file from another task as a blocker when current repository
   evidence can establish the same facts. The candidate remains immutable:
   do not repeat implementation, edit source, create commits or branches, open
   another PR, or repair CI or release tooling in release mode.
3. Complete one pre-mutation admission packet and bind its receipt SHA-256,
   installed contract SHA-256, current base/head, required CI, impact scope,
   dry-run plan, credential presence, and recovery inputs.
4. Do not impose an arbitrary whole-task wall-clock cutoff. Wait for CI,
   deployment, and observation in the current task using bounded status reads
   or the product wait mechanism. A provider or repository timeout may still be
   a real blocker; elapsed conversation time or approval waiting is not.
5. Merge through the normal protected path, re-resolve the merge SHA, then run
   the repository release owner once. Use only its declared bounded recovery
   for eligible transient or incomplete post-mutation phases of the unchanged
   admitted plan.
6. Prove the exact deployed candidate and each affected capability through its
   actor, credential class, resource scope, entry point, runtime principal,
   representative data, and terminal outcome. Deployment alone is not proof.
7. Publish the canonical note when the repository has one and attempt safe
   task-owned worktree/branch cleanup. Note or local cleanup failures must be
   reported as closeout warnings. Local cleanup failure does not rewrite a
   proven live production release as blocked.

## Stop without looping

- Before mutation, a genuine deterministic blocker ends the single attempt with
  one bounded repair packet. Do not repair, requalify, create a follow-up PR, or
  start a fresh release attempt automatically.
- After mutation, reconcile exact remote state before the one repository-defined
  bounded recovery. Never blindly retry or guess whether a command mutated
  production.
- PR readiness, merge success, unavailable task/thread creation, elapsed time,
  approval waiting, a missing separately published note after production is
  proven live, and local cleanup are not production blockers.
- A terminal `blocked` or `released` response permanently seals the release
  attempt. Later turns are read-only discussion.

## Prove completion

Create and validate the version 8 receipt:

```bash
python3 <skill-dir>/scripts/validate_receipt.py <receipt.json>
```

For a final `ship` or `release` result, use receipt mode `release` and terminal
state `released` or `blocked`. Never emit a merge-only terminal state.
`released` requires exact production/distribution reachability; closeout
warnings stay explicit in the receipt. The final visible content for `released`
must end with the exact Markdown stored in `release.message`.

Append one routing marker, then the receipt marker:

```text
<!-- auto-pilot-routing: {"goal_id":null,"implementation":{"lane":"direct","task_ref":null,"worktree":null,"model":"gpt-5.6-sol","thinking":"xhigh","reason":"Owner completed the work in the current task."},"continuation":{"lane":"current_ship_task","task_ref":null,"worktree":null,"model":"gpt-5.6-sol","thinking":"xhigh","reason":"The same task continued through production."}} -->
<!-- auto-pilot-receipt: /absolute/path/to/receipt.json -->
```

Use `not_requested` for `pr` and `current_release_task` for direct `release`.
Optional helpers do not replace the accountable implementation lane. Do not
commit agent-control artifacts unless the repository explicitly requires them.
