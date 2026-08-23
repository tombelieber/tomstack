# Automatic release continuation

Use this only when the current Auto Pilot invocation explicitly selects `ship` or clearly orders implementation followed by production delivery. This authority permits one fresh release task after `pr_ready`; it never permits production mutation inside the PR controller.

## Normalize the intent

Prefer the unambiguous command:

```text
$auto-pilot ship /path/to/approved-plan.md
```

Also accept a direct current imperative such as “finish this and release it,” “merge and deploy after the PR is ready,” or an equivalent Chinese/Cantonese instruction. Do not select automatic continuation from discussion, a future wish, a question, a quoted example, earlier chat, or any instruction that says not to release.

## Dispatch once after PR readiness

1. Finish the complete PR stage and bind the live PR URL plus its full head SHA. Never create the release task before the PR is open, unmerged, and ready.
2. Form the deterministic title `Auto Pilot Release — <owner/repo>#<PR> @ <12-char-head>`.
3. Reuse the current fresh-stage goal ID. If this is the first fresh stage in the run, generate it once with `node <skill-dir>/scripts/new_goal_id.mjs`.
4. When thread tools exist, list projects and select the matching repository project. List recent tasks and inspect any exact-title match. Reuse an existing task bound to the same PR and head instead of creating a duplicate.
5. Discover lazy-loaded thread tools before declaring task creation unavailable. If no exact task exists, create one fresh task—never a fork or collaboration subagent—using the resolved release model and thinking preference. The built-in default is `gpt-5.6-sol` with `xhigh`. A Git repository should use an isolated worktree unless the user explicitly requested its saved checkout.
6. Start the task with this compact prompt, filled from live evidence:

```text
$auto-pilot release <PR URL> --release-model <RESOLVED MODEL> --release-thinking <RESOLVED THINKING>
<!-- auto-pilot-goal: <GOAL ID> -->
This fresh task is the one authorized continuation of the current user's explicit ship request.
Expected pre-merge candidate head: <FULL HEAD SHA>.
Resolve the live PR and follow the Auto Pilot release contract. Revalidate any changed head; return material new scope to a PR stage. Source pr_ready receipt: <PATH OR IMMUTABLE ID>.
```

Forward the resolved model and thinking values in both the task-creation parameters and the generated command. This preserves a current `ship` invocation override inside the fresh release invocation and keeps its private routing audit aligned with the task that was actually created.

7. Record the task reference, goal ID, and exact candidate head as evidenced checks in the `pr_ready` receipt. For a newly created task, emit `::created-thread{threadId="<REF>"}` (or `clientThreadId`) and use `fresh_release_task` with the same reference and goal ID in the routing marker. For an exact reused task, identify its title/reference and use `reused_release_task` with a reason. End the PR controller; the release task owns merge, deployment, recovery, and production proof.

## Fail closed

- If release intent is ambiguous, use PR-only mode.
- If PR readiness fails, do not dispatch a release task.
- If an exact continuation already exists, reuse it; never create a second release task for the same PR head.
- If fresh-task creation is unavailable, return the exact `$auto-pilot release <PR URL>` command. Never release in the PR controller as a fallback.
- If the configured release model/thinking combination is unavailable, disclose any runtime model fallback before creating the task. Never turn model availability into permission to use a subagent or release inside the PR controller.
- Do not repeat resolved design questions. The release task may still stop for a genuine authority, credential, billing, destructive-data, compatibility, or changed-scope blocker.
