# Auto Pilot configuration

Configuration selects execution preferences; it cannot change goal authority,
end states, evidence requirements, or same-task ownership.

Run once at the start of a real invocation, forwarding only flags explicitly
present in that command:

```bash
node <skill-dir>/scripts/resolve_config.mjs [override flags]
```

Resolution order is invocation flags, optional user config, then defaults. The
default path is `~/.codex-auto-pilot/config.json`; set
`CODEX_AUTO_PILOT_CONFIG` to another absolute path. The resolver is read-only.

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

`release` is the legacy config key for the production phase of `ship` and its
aliases; it is not a third goal mode and cannot create a handoff. Likewise,
legacy executor value `task` may be parsed for backward compatibility but must
fall back visibly to the invoking owner under the current same-task contract.

Supported flags remain:

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

`auto` leaves execution-shape judgment with the owner. `off` forbids helpers.
Every helper is a terminal leaf and may not spawn, fork, create another task,
delegate, merge, deploy, migrate, roll back, or own production. A model or
thinking preference is never delivery evidence.

Configuration cannot change these invariants:

- only `pr` and `ship` are goal modes;
- only `PR_READY` and `SHIPPED` are achieved end states;
- aliases normalize to `ship`;
- the invoking task remains owner and resumable;
- `PR_READY` has no remaining non-production or readiness work;
- `SHIPPED` has exact production proof and zero scoped leftovers; and
- immutable admission binds one attempt, never the task or goal.
