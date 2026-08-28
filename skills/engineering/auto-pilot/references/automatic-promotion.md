# Automatic release continuation

Use this only when the current Auto Pilot invocation explicitly selects `ship` or clearly orders implementation followed by production delivery. This authority permits one fresh release task after `pr_ready`; it never permits production mutation inside the PR controller.

## Normalize the intent

Prefer the unambiguous command:

```text
$auto-pilot ship /path/to/approved-plan.md
```

Also accept a direct current imperative such as “finish this and release it,” “merge and deploy after the PR is ready,” or an equivalent Chinese/Cantonese instruction. Do not select automatic continuation from discussion, a future wish, a question, a quoted example, earlier chat, or any instruction that says not to release.

## Dispatch once after PR readiness

1. Finish the complete PR stage and bind the live PR URL plus its full head SHA. Never create the release task before the PR is open, unmerged, and backed by promotable PASS exact-candidate evidence plus current required CI for that head. A FAIL, BYPASS, missing, stale, or scope-mismatched result is not ready.
2. Hash the validated source receipt with SHA-256 and read the installed release-contract fingerprint with `python3 <skill-dir>/scripts/validate_receipt.py --contract-sha256`. Re-read the live PR immediately afterward; any changed head makes the receipt stale and blocks dispatch.
3. Form the deterministic title `Auto Pilot Release — <owner/repo>#<PR> @ <12-char-head> / <12-char-receipt-sha>`.
4. Reuse the current fresh-stage goal ID. If this is the first fresh stage in the run, generate it once with `node <skill-dir>/scripts/new_goal_id.mjs`.
5. When thread tools exist, list projects and select the matching repository project. List recent tasks and inspect any exact-title match. If the exact attempt is currently active, identify it and do not send another prompt. If it has any completed terminal release turn, it is sealed: never reuse or resume it. A later explicitly authorized attempt must be a fresh task with a newly validated source receipt.
6. Discover lazy-loaded thread tools before declaring task creation unavailable. If no active exact attempt exists, create one fresh task—never a fork or collaboration subagent—using the resolved release model and thinking preference. The built-in default is `gpt-5.6-sol` with `xhigh`. A Git repository should use an isolated worktree unless the user explicitly requested its saved checkout.
7. Start the task with this compact prompt, filled from live evidence:

```text
$auto-pilot release <PR URL> --release-model <RESOLVED MODEL> --release-thinking <RESOLVED THINKING>
<!-- auto-pilot-goal: <GOAL ID> -->
This fresh task is the one authorized continuation of the current user's explicit ship request.
Expected pre-merge candidate head: <FULL HEAD SHA>.
Installed release-contract SHA-256: <CONTRACT SHA-256>.
Source pr_ready receipt: <ABSOLUTE LOCAL PATH>.
Source receipt SHA-256: <RECEIPT SHA-256>.
This release task is single-use. At the start of every turn, reload the installed Auto Pilot release contract and recompute both hashes. A mismatch, changed live head, stale receipt, or prior terminal release turn must stop blocked before mutation; never resume a terminal task.
Treat the source candidate as immutable: do not edit code, create a commit or branch, or open another PR in the release task. Unless the repository or user declared a different bound before promotion, use a 10-minute whole-task wall-clock release-control budget from live-PR binding. On a deterministic blocker or exhausted budget, stop safely and report blocked instead of implementing a repair.
```

Forward the resolved model and thinking values in both the task-creation parameters and the generated command. This preserves a current `ship` invocation override inside the fresh release invocation and keeps its private routing audit aligned with the task that was actually created.

8. Record the task reference, goal ID, exact candidate head, contract fingerprint, and source-receipt digest as evidenced checks in the `pr_ready` receipt. For a newly created task, emit `::created-thread{threadId="<REF>"}` (or `clientThreadId`) and use `fresh_release_task` with the same reference and goal ID in the routing marker. For an already-active exact attempt, identify its title/reference without sending a prompt and use `reused_release_task` with that reason. End the PR controller; the release task owns merge, deployment, recovery, and production proof.

## Fail closed

- If release intent is ambiguous, use PR-only mode.
- If PR readiness fails, do not dispatch a release task. Keep an in-scope fix on the original open PR or return `blocked`; never use a release task to complete qualification.
- If an exact attempt is active, do not duplicate or prompt it. If it already returned `blocked`, `merged_main`, or `released`, never resume it; a later authorized attempt requires a fresh task and fresh receipt binding.
- If fresh-task creation is unavailable, return the exact `$auto-pilot release <PR URL>` command. Never release in the PR controller as a fallback.
- If the configured release model/thinking combination is unavailable, disclose any runtime model fallback before creating the task. Never turn model availability into permission to use a subagent or release inside the PR controller.
- Do not repeat resolved design questions. The release task may still stop for a genuine authority, credential, billing, destructive-data, compatibility, or changed-scope blocker.
