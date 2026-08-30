# Owner-directed PR execution

Keep one Sol owner accountable for the approved goal, repository truth, final
quality, and requested terminal boundary. Direct execution is valid for any
scope the owner can reliably finish in its current session. In `ship`, that
owner stays in the current task through production; optional leaf workers are
bounded context tools, not a change of ownership.

```text
approved artifact
  -> Sol owner: resolve truth and choose the execution shape
  -> direct work, optional fresh owner stages, or optional leaf workers
  -> owner: integrate, review once, verify, and open the PR
  -> pr: terminal pr_ready; ship: internal pr_ready transition
```

## Let the owner choose

Treat `tiny` and `substantive` as advisory scope metadata. They do not require a
handoff, a fresh task, a subagent, or a particular model. With the default
`implementation.substantive_executor=auto`, the active owner decides whether
the expected context cost or useful parallelism justifies another execution
context.

An explicit `direct`, `task`, or `subagent` executor preference still overrides
that default in PR-only mode. State the resolved preference before dispatch,
and record the actual route. A `ship` invocation does not hand its terminal
promise to another user-visible task. An independent user-visible task and an
in-turn collaboration subagent remain different execution kinds; never present
one as the other.

Native context compaction continues the same session and stage. PR-only mode
may explicitly choose a new owner stage. `ship` must not hand unfinished work
or release authority to a new session; normal compaction is the supported
continuation.

## Conditional leaf-worker contract

Do not prescribe worker use, worker count, or wave cadence. If an owner session
independently chooses collaboration, resolve the configured leaf-model
preference and give every spawned helper exactly one role:

- `stage_owner`: owns a bounded stage and may choose its own leaf workers;
- `leaf_worker`: owns only its assigned packet and must not spawn, fork, create
  another task, or delegate to another agent.

The rule is role-scoped, not raw task-tree depth. A fresh stage owner may itself
be a child task and may still spawn leaf workers. A leaf worker may not. Put the
no-delegation rule in every leaf prompt because the current Codex runtime does
not expose a repository-controlled hard depth switch.

Keep write ownership explicit. Parallel writers must own non-overlapping paths
or isolated worktrees; when work overlaps, the owner should integrate it rather
than relying on concurrent mutation. A leaf never becomes the PR or release
authority.

After the owner-selected work finishes, fan results back to the owner. Review
the integrated candidate once rather than reviewing each worker, commit, or
partial change. The same owner may perform that consolidated review, or it may
choose a fresh review stage when a clean context materially helps.

## PR-only fresh owner-stage handoff

When a PR-only owner chooses a fresh stage, bind it to the approved artifact and
real Git state. Provide only the information needed to continue:

Generate one opaque goal ID at the first fresh-stage boundary with
`node <skill-dir>/scripts/new_goal_id.mjs`. Put
`<!-- auto-pilot-goal: <ID> -->` in the receiving Auto Pilot prompt and the
same `goal_id` in the dispatching owner's final routing marker. Reuse that ID
across later fresh stages. This breadcrumb exists only to join local lifecycle
records; it carries no hidden reasoning and does not add hook context.

1. approved artifact and relevant repository instructions;
2. repository path, base SHA, owned branch or worktree, and bounded scope;
3. current completed and remaining outcomes;
4. focused verification required by repository policy; and
5. explicit authority boundaries.

The receiving owner must preserve unrelated work, implement the owned outcome,
run focused verification, and return repository evidence rather than copied
conversation history or hidden reasoning.

```json
{
  "objective": "bounded stage outcome",
  "git": {"base_sha": "...", "branch": "...", "head_sha": "..."},
  "completed": ["..."],
  "remaining": ["..."],
  "changed_paths": ["..."],
  "checks": [{"name": "...", "status": "passed", "evidence": "..."}],
  "failures": [],
  "open_risks": [],
  "blockers": []
}
```

## Consolidate and deliver

The accountable PR owner must:

1. verify every returned branch or head against the expected base;
2. inspect the complete integrated diff and runtime wiring;
3. perform one consolidated correctness, architecture, security, performance,
   and test-quality review;
4. patch findings without creating a review ping-pong loop; and
5. use focused evidence while the head is moving, then run the complete
   exact-candidate gate for the final live PR head and validate `pr_ready` only
   from promotable PASS evidence. Stop without merge only in `pr`; in `ship`,
   retain the receipt as an internal handoff and continue in the same task.

Keep directly causal in-scope fixes on that same PR before `pr_ready`. Do not
defer a known deterministic release-readiness defect to the release task, and
do not create intermediate PRs merely to run another full promotion cycle.

For a PR-only user-visible stage task, emit its created-thread directive and
record the actual primary implementation lane. `ship` must not emit a release
task directive. Leaf nesting remains best-effort routing evidence when the
runtime does not expose its complete relationship; mark that evidence
unverified instead of inventing certainty.
