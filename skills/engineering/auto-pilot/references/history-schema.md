# Local Run History Schema

Automatic history collection writes one private directory per explicit Auto
Pilot invocation. New schema-v5 runs use thin markers first and derived files
later:

```text
~/.codex-auto-pilot/history/runs/<session-id>--<turn-id>/
├── manifest.json
├── terminal.json                 # after Stop or SessionEnd
├── receipt-source.json           # small ephemeral source snapshot, when present
├── agents/
│   ├── <agent-id>.marker.json
│   └── <agent-id>.json           # derived metadata
├── metrics.json                  # post-hoc derived
├── receipt.json                  # post-hoc validated terminal receipt
└── outcome.json                  # post-hoc derived
```

The collector never writes model context. Only a leading `$auto-pilot ...`
command or leading Auto Pilot skill selection starts a run. Inline mentions,
design discussions, optimization requests, and explicit “do not start” prompts
are excluded.

## Thin synchronous markers

`UserPromptSubmit` writes `manifest.json` with the invocation mode, requested
release continuation, session/turn IDs, source transcript path and byte
boundary, prompt hash, model, permission mode, resolved preferences, immutable
invocation-schema version, and exact installed skill-bundle identity. The
bundle is archived once per hash because the exact runtime instructions and
validator cannot be reconstructed after an upgrade. It does not scan transcript
token events.

`SubagentStop` writes only agent ID/type, transcript path, terminal byte size,
and timestamp. It does not copy, hash, or parse the transcript.

`Stop` writes `terminal.json`, updates the manifest to
`pending_materialization`, and snapshots a referenced receipt file of at most
1 MiB before a temporary source can disappear. It stores the final-message hash
but not a second copy of the message. `SessionEnd` writes the same boundary for
recoverable unfinished runs. Hooks return inert `{}` and never call a model or
upload data.

## Post-hoc materialization

`codex-auto-pilot history materialize` reads each referenced Codex JSONL only
through its recorded terminal byte boundary. `history list`, `history goals`,
and `history report` materialize pending runs automatically. If Codex moved a
recorded active-session file, the materializer checks the corresponding local
`archived_sessions` filename before declaring it unavailable. The parser:

- uses `last_token_usage` as the primary per-event increment;
- uses cumulative totals only for exact-duplicate, stale-regression, and reset
  detection, with a legacy cumulative-only fallback;
- clamps cached input to input and reasoning output to output, because those
  buckets overlap rather than add to the reported total;
- counts both legacy `context_compacted` and current top-level `compacted`
  records;
- derives raw model/effort, tools, final assistant message, and subagent
  session/parent/depth metadata; and
- keeps parse warnings, parse errors, source availability, and final-message
  hash agreement explicit.

Token data is `null` when no trustworthy token event exists. Source loss,
message mismatch, malformed receipt evidence, and incomplete lineage never
become a real zero or a successful benchmark run.

Root and agent token evidence stays separate. Schema v5 does not yet claim a
complete lifecycle token total for runs with collaboration agents because
forked agent JSONL can replay parent history. Those runs keep per-agent
unverified token metadata and topology evidence but remain outside token-cost
benchmark cohorts until semantic replay deduplication is proven by a later
parser version.

The marker schema, Codex parser version, and materializer version are tracked
independently. A parser/materializer version change rebuilds schema-v5 derived
files when their terminal marker and source evidence remain available. The
derived manifest keeps the original `invocation_schema_version`, so repeated
materialization cannot reinterpret a legacy `ship` boundary. Runs written
before schema v5 remain readable and are not assigned invented lineage.

## Outcome and routing evidence

Post-hoc receipt validation uses the validator archived with the invocation's
exact bundle; new runs use receipt schema v8. It accepts a terminal state only
from the preserved receipt plus the exact final assistant message reconstructed
from JSONL. Missing, invalid, oversized, mode-mismatched,
routing-mismatched, or release-message-mismatched evidence produces `unknown`.
Retained cleanup is a closeout warning in an otherwise valid released receipt.

Routing audit remains separate from delivery authority. A `ship` invocation is
validated against a final mode `release` receipt, and its routing marker must
show `current_ship_task`; a fresh or fallback release continuation is a
deviation. The audit records `passed`, `fallback`, `deviation`, or `unknown`
from the final routing marker, created-task directives, resolved preferences,
and observed agent metadata. It does not rewrite the stored receipt, but a new
`released` outcome becomes `unknown` unless the current invocation proves its
required `current_ship_task` or `current_release_task` lane.

## Fresh-stage goal lineage

Direct one-session work needs no extra telemetry action and uses its run ID as
its local goal ID. When a PR-only owner actually creates a fresh Auto Pilot
stage, it generates one opaque `apg_...` ID and places it on both sides:

```text
receiving prompt: <!-- auto-pilot-goal: apg_... -->
dispatching final routing marker: {"goal_id":"apg_...", ...}
```

A group with both a routing-side and invocation-side breadcrumb is `linked`.
One-sided or mismatched groups are `unverified`. Goal metrics preserve wall
duration (minimum start to maximum end), summed active duration, complete token
totals, tools, compactions, observed depth, models, and terminal states. They do
not collapse quality and cost into an arbitrary scalar score.

The delivery cohort requires valid receipts and complete token accounting. The
strict benchmark cohort additionally requires passed routing and one exact
skill-bundle hash; `history report` exposes separate bundle cohorts and flags
cross-bundle results as incomparable. Goal cohorts also require one bundle
across their full linked chain. Compare comparable work by quality first, then
median/p95 tokens and wall time.

## Storage and privacy

The original local Codex JSONL is canonical evidence and is not duplicated for
new runs. Legacy schema-v3 transcript copies and schema-v4/v5 receipt-source
snapshots obey the configured raw retention period; derived manifests,
validated receipts, metrics, and outcomes remain. Receipt source snapshots are
private local evidence and must not be uploaded.

All collection and materialization is local, deterministic, network-free, and
model-free. Do not commit or upload the history archive.
