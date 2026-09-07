# Local run history schema

Schema v6 separates a durable goal from turn-level runs and immutable attempts.
History remains private, local, deterministic, network-free, and model-free.

```text
~/.codex-auto-pilot/history/
├── active-goals/<session-id>.json
└── runs/<session-id>--<turn-id>/
    ├── manifest.json
    ├── terminal.json
    ├── receipt-source.json
    ├── agents/<agent-id>.marker.json
    ├── agents/<agent-id>.json
    ├── metrics.json
    ├── receipt.json
    └── outcome.json
```

## Active goal and turn checkpoints

An explicit invocation creates or resumes one active goal:

- `goal_mode`: `pr` or `ship`;
- `goal_target`: `PR_READY` or `SHIPPED`;
- `invoked_alias`: `release`, `promote`, `deploy`, or null;
- one opaque `goal_id`; and
- `goal_status`: `active`, `waiting`, or `achieved`.

While a goal is active, an ordinary later prompt in the same task/session starts
a new run with the same goal ID and `invocation_source: active_goal_resume`.
The user does not need another command. A Stop or SessionEnd records a turn
checkpoint; it does not complete or lock the goal. Only a validated current
schema-v10 achieved receipt clears the active-goal record.
receipt clears the active-goal record.

Each receipt has a separate attempt ID and `attempt_result` of `achieved` or
`incomplete`. An incomplete or missing receipt leaves the goal active. A later
repair, changed external state, or reconciliation keeps the goal ID, creates a
new attempt ID, and links the actual prior receipt SHA-256. The active record
stores the last valid receipt digest and used attempt IDs; duplicate IDs,
fabricated digests, and cross-goal lineage fail closed.
The normalized completion-scope digest is retained as evidence, and linked
attempts may expand but never shrink the prior criteria, production cases, or
release-note requirement.

## Thin hooks and materialization

`UserPromptSubmit` writes the invocation and transcript byte boundary.
`SubagentStop` records only bounded agent metadata. `Stop` or `SessionEnd`
snapshots a referenced receipt of at most 1 MiB, records the final-message hash,
and marks that run `pending_materialization`. Hooks never add model context,
upload data, or copy hidden reasoning. Repeated Stop/SessionEnd delivery is
idempotent and cannot overwrite the first attempt snapshot.

Post-hoc materialization reads only through recorded byte boundaries. It derives
tokens, model/effort, tools, compactions, topology, routing telemetry, receipt
evidence, and normalized fields:

```text
receipt_schema_version
attempt_result: achieved | incomplete | unknown
goal_target: PR_READY | SHIPPED | null
goal_outcome: PR_READY | SHIPPED | null
legacy_terminal_state
```

Routing is telemetry, not outcome authority for v6. A valid v9 or v10 outcome remains
authoritative even if routing metadata is missing or records a deviation. New
ship runs and all aliases use `current_ship_task`; `current_release_task` is
legacy-only.

Post-hoc materialization is the sole authority that clears or advances an
active goal. It requires the transcript final-message hash, the immutable
snapshot, and the validator archived with that run. Synchronous hook handling
never clears a goal. A missing archived validator fails closed for every
schema version rather than falling back to the currently installed contract.

## Benchmarks

Run-level delivery benchmarks include only valid schema-v9-or-newer achieved outcomes.
Incomplete, blocked, missing, invalid, or legacy claims never count as achieved.
Goal lifecycle metrics include the tokens and time of earlier linked attempts,
waits, repairs, and retries before the final `PR_READY` or `SHIPPED` outcome.

Reports expose `goal_outcomes`, `attempt_results`, and
`legacy_terminal_states` separately. Strict comparable cohorts additionally
require trustworthy token accounting, one exact archived skill-bundle hash,
and a `passed` routing audit on the run that achieved the goal. Earlier linked
attempt costs remain included in the goal total.

## Legacy compatibility

Archived validators remain authoritative for their original receipts. v8 and
older `pr_ready`, `released`, and `blocked` values are preserved under
`legacy_terminal_state`; they are never silently promoted into a current
achieved benchmark or described as a resumable current goal. Their goal status
is `legacy_unknown`. A missing archived validator fails closed instead of
using the newest validator to reinterpret old data. Released schema-v9 receipts
remain valid under their frozen v9 contract semantics; the schema-v10 regression
gate is not applied retroactively.

Historical cross-task breadcrumbs and `mode: release` remain readable. They do
not authorize current cross-task ownership or a third goal mode.

Raw transcript references and receipt snapshots obey configured retention;
derived evidence remains. Never commit or upload the history archive.
