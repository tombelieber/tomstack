# Auto Pilot configuration

Auto Pilot has portable reference defaults and one optional user-level JSON
file. Configuration expresses routing and model preferences; it never grants
merge, release, production, secret, billing, or destructive-data authority.

## Resolve settings

Run this once at the start of a real invocation, forwarding only override flags
explicitly present in the current command:

```bash
node <skill-dir>/scripts/resolve_config.mjs [override flags]
```

Resolution order is:

1. Explicit current-invocation flags.
2. The optional user config.
3. Built-in reference defaults.

The default config path is `~/.codex-auto-pilot/config.json`. Set
`CODEX_AUTO_PILOT_CONFIG` to another absolute path. The resolver reads
configuration but never creates or rewrites it.

## Schema and reference defaults

```json
{
  "schema_version": 1,
  "implementation": {
    "substantive_executor": "auto",
    "model": "gpt-5.6-sol",
    "thinking": "xhigh"
  },
  "release": {
    "model": "gpt-5.6-sol",
    "thinking": "xhigh"
  },
  "collaboration": {
    "policy": "auto",
    "model": "gpt-5.6-luna",
    "thinking": "max"
  }
}
```

These are preferences, not mandatory topology. `auto` leaves the active Sol
owner responsible for direct work and optional terminal leaf workers. It does
not actively recommend multi-agent execution, and it never creates a release
handoff.

`implementation.substantive_executor` accepts `task`, `direct`, `subagent`, or
`auto`. `tiny` and `substantive` remain advisory scope labels; only an explicit
executor preference constrains the route. `implementation.model` and
`implementation.thinking` apply to an explicitly selected implementation
context. A `ship` owner still remains accountable in the current task.

`release.model` and `release.thinking` describe the preferred owner for a task
that was itself started as `release`. They cannot switch the current task's
model and never cause `ship` to create another task. Disclose an unavailable or
different current model, then continue in place when it still meets the task's
capability floor.

`collaboration.policy` accepts `auto` or `off`. `auto` makes collaboration
available when an owner independently chooses it. `off` forbids both helper
subagents and an explicitly selected primary subagent lane. The collaboration
model and thinking values are the reference leaf-worker preference; the owner
may select another configured or runtime-available model when the packet needs
a different capability floor.

Every leaf worker must be prompted as a terminal leaf: it may not spawn, fork,
create another task, or delegate. This is role-scoped. A fresh stage owner may
itself be a child task and may still choose its own leaf workers.

## Per-run overrides

Supported flags are:

```text
--implementation-executor task|direct|subagent|auto
--implementation-model MODEL
--implementation-thinking none|minimal|low|medium|high|xhigh|max|ultra
--release-model MODEL
--release-thinking none|minimal|low|medium|high|xhigh|max|ultra
--collaboration auto|off
--collaboration-model MODEL
--collaboration-thinking none|minimal|low|medium|high|xhigh|max|ultra
```

The resolver validates merged settings. Runtime model availability remains
authoritative: disclose a fallback before dispatch and record it in routing
evidence. Never turn a model preference failure into a silent execution-kind
substitution.

## Fixed boundaries

Configuration cannot change these rules:

- `pr` never merges or mutates production;
- `ship` keeps implementation and production delivery in the current
  accountable task and never generates a continuation task;
- leaf workers never delegate, while a fresh stage owner may choose leaves;
- Git write work uses an isolated worktree unless it remains directly in its
  owning session's checkout;
- completion receipts prove delivery and authority, not model or orchestration
  choices; and
- production release requires exact-candidate and capability-reachability
  evidence.
