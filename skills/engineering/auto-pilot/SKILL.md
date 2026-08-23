---
name: auto-pilot
description: "Deliver one approved software goal through a production-ready PR, with an optional explicitly authorized release in a fresh task."
disable-model-invocation: true
---

# Auto Pilot

Deliver one approved artifact through a verified PR boundary and a deliberately
separate production-authority boundary. Within either stage, keep one
accountable owner and let that owner choose the fewest useful contexts:

```text
$auto-pilot pr /path/to/approved-plan.md
$auto-pilot ship /path/to/approved-plan.md
$auto-pilot release <PR URL or number>
```

Put the command at the start of the prompt so private run history records only real executions. `pr` ends at a production-ready PR. `ship` completes that PR, then creates one fresh release task automatically unless the exact continuation already exists. `release` starts directly from an existing candidate. Never merge or mutate production inside the PR controller.

Read [receipt schema](references/receipt-schema.md) before declaring a terminal result. In the PR stage, read [owner-directed execution](references/delegated-implementation.md) completely before choosing an execution shape. For `ship`, read [automatic promotion](references/automatic-promotion.md) before dispatching the continuation. In the release stage, read [release promotion](references/release-promotion.md) completely before any merge or external mutation.

## Resolve preferences

Before selecting an execution shape for a real run, read [configuration](references/configuration.md) and resolve the effective settings with its deterministic script. The reference defaults keep `gpt-5.6-sol` with `xhigh` thinking as the accountable implementation and release owner, set `implementation.substantive_executor=auto`, and prefer `gpt-5.6-luna` with `max` thinking only when an owner independently chooses leaf workers. Current-invocation flags override the optional user config, which overrides these defaults.

Model and thinking settings are preferences, not evidence or authority. Runtime availability may require a disclosed fallback. Fresh-task identity and isolation when used, the PR/release authority boundary, exact-candidate verification, and production proof are invariants and are not configurable.

State the resolved owner model/thinking, executor preference, leaf-worker preference, and requested release continuation in one concise commentary update before dispatching another context. Never describe a collaboration subagent as an independent Codex task or silently substitute one execution kind for another.

## Select the stage

1. Default to `pr` when no subcommand or current production-delivery imperative is supplied: resolve the approved artifact, implement it, verify it, and stop at an open unmerged PR.
2. Select `ship` when the current invocation explicitly uses `ship`, `--then-release`, or directly and unambiguously orders implementation followed by merge/deploy/release/go-live. Do not infer it from a future wish, question, hypothetical, quoted example, prior chat, “do all,” or negated release request.
3. Select `release` only when the current invocation explicitly uses `release` or `promote` and identifies an existing PR/candidate.
4. Treat `ship` as authority to create and run one fresh user-visible release task, never a subagent or fork, after `pr_ready`; it is not authority for the PR controller to mutate production. The generated task begins with an explicit `$auto-pilot release <PR>` command and rebinds live candidate state.

## Minimize contexts

1. Keep the active Sol owner accountable for the complete goal. Let it work directly whenever it can reliably finish in the current session; `tiny` and `substantive` are advisory scope metadata, not routing triggers.
2. If the owner judges the goal too large for one useful context, it may create a fresh owner stage and pass compact repository evidence. Native compaction stays in the same session and stage; a new session is a new stage.
   When the first fresh stage is actually needed, generate one opaque goal ID with `node <skill-dir>/scripts/new_goal_id.mjs`. Reuse it in every fresh Auto Pilot stage prompt as `<!-- auto-pilot-goal: <ID> -->` and in the parent routing marker. Do not generate an ID for direct work merely for telemetry.
3. Do not prescribe collaboration. If any owner independently chooses leaf workers, mark them as terminal leaves: they must not spawn, fork, create another task, or delegate. A fresh stage owner may itself be a child task and may still choose its own leaves.
4. Give parallel writers non-overlapping ownership or isolated worktrees. Fan results back to the owner, then review the integrated candidate once rather than reviewing each worker, commit, or partial change. The owner may choose a fresh review stage when a clean context materially helps.
5. Share truth through the approved artifact, Git SHAs, diff, test artifacts, and compact handoffs—not copied conversation history or hidden reasoning.

## PR stage

1. Refresh only the repository truth needed to own the goal and choose an execution shape. Avoid deeply reading the implementation surface twice.
2. Batch deterministic inventory, status, and verification work. Follow [owner-directed execution](references/delegated-implementation.md) whether the owner works directly or chooses optional fresh stages or leaf workers.
3. After implementation is integrated, let the accountable owner perform one consolidated review, patch findings without review ping-pong, run exact-candidate gates, clean task-owned runtime resources, commit, push, and create the final PR/MR. Keep the delivery worktree and branch while the PR is open.
4. Once the open PR reaches `pr_ready`, stop PR writes. Do not merge, deploy, migrate, rotate secrets, or mutate production in this session.
5. For `ship`, dispatch one fresh release task or reuse the exact existing task for the exact PR head by following [automatic promotion](references/automatic-promotion.md). Do not wait in a second controller loop.
6. Only after the continuation outcome is known, validate the final `pr_ready` receipt with either the created/reused task evidence or the exact unavailable-task fallback. Then end the PR controller.

## Release stage

1. Start from the live existing PR, not a remembered branch. Bind its exact base SHA, head SHA, current checks, reviews, mergeability, and release scope.
2. Reuse unchanged deterministic evidence by hash. Re-run only repository-required candidate and release gates; do not repeat implementation or create another implementer.
3. Keep one controller as release owner. A release task generated by `ship` uses the resolved release model and thinking preference. Conditional leaf workers remain terminal leaves and never receive merge, deploy, migration, rollback, or production authority. Use repository harnesses for dry-runs and evidence.
4. Merge through the normal protected path, then use the repository release owner for approved migrations, backfills, deploys, recovery, rollback decisions, and real post-release verification.
5. Publish the canonical release note for the exact released candidate and prepare the compact release message that will end the final visible response. A draft, generated changelog with no concrete outcome, or deployment-only message is not release completion.
6. After merge or release, automatically clean the task-owned local worktree and delivery branch. First persist the receipt outside that worktree and prove the PR merged, the worktree is clean and unlocked, every task commit is pushed and reachable from the remote base, and no other task owns it. Run removal from the primary checkout, never from inside the target worktree; use `git worktree remove`, prune stale metadata, safe-delete the local branch, and delete the remote branch when repository policy permits. Never force removal. If any check or cleanup step fails, retain the evidence and report `blocked`, not success.
7. If no deployment mechanism exists, stop at `merged_main`; otherwise stop only at `released`. Follow [release promotion](references/release-promotion.md).

## Prove completion

Use repository-defined deterministic evidence first. Do not invent checks, reviews, deployments, migrations, or observations. A production deployment is not a released capability until the exact affected actor, credential, scope, entry point, runtime principal, representative data case, and terminal outcome are proven against the deployed candidate. Production canaries are impact-selected release evidence, never per-edit or per-commit checks.

Create a temporary v7 completion receipt and validate it:

```bash
python3 <skill-dir>/scripts/validate_receipt.py <receipt.json>
```

Keep the validated file until the local history hook copies it. Append this hidden marker to the final answer:

```text
<!-- auto-pilot-receipt: /absolute/path/to/receipt.json -->
```

Immediately before the receipt marker, append one single-line routing marker so private history can audit declared execution separately from delivery evidence:

```text
<!-- auto-pilot-routing: {"goal_id":null,"implementation":{"lane":"direct","task_ref":null,"worktree":null,"model":"gpt-5.6-sol","thinking":"xhigh","reason":"Owner completed the PR stage in the current session."},"continuation":{"lane":"not_requested","task_ref":null,"worktree":null,"model":null,"thinking":null,"reason":null}} -->
```

Use `independent_task` when the owner chose a fresh primary implementation stage, `collaboration_subagent` only for a legacy or explicitly configured primary-subagent route, and `not_applicable` in release mode. Optional leaf workers do not replace the accountable implementation lane. Use `fresh_release_task`, `reused_release_task`, `fallback_command`, `not_requested`, or `current_release_task` for continuation. Include a short `reason` for direct work, an explicitly configured primary subagent, a reused task, a runtime fallback, or an unavailable task mechanism. When a user-visible task was created, also emit `::created-thread{threadId="<REF>"}` (or `clientThreadId`) and use the primary stage reference in the routing marker. Additional owner stages and leaf ancestry are best-effort routing evidence when the runtime does not expose their complete relationship; record them as unverified rather than inventing certainty. A missing or inconsistent routing marker does not change a valid delivery receipt.

Set top-level `goal_id` only when a fresh Auto Pilot stage was actually created. The receiving prompt and the dispatching routing marker must carry the same ID; one-sided or mismatched evidence remains unverified and is excluded from goal-level benchmarks.

For `released`, the final visible content must end with the exact Markdown stored in `release.message`; append the routing and receipt markers after it. Report exactly one terminal state: `pr_ready`, `merged_main`, `released`, or `blocked`. Do not commit agent-control artifacts unless the repository explicitly requires them.

For an automatic continuation, record the created/reused release task and exact candidate head as normal evidenced checks in the `pr_ready` receipt. If the runtime cannot create a new task, return the exact `$auto-pilot release <PR>` fallback command without performing release work in the PR session.
