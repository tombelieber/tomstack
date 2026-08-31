# Goal-attempt receipt

Schema version 10 records goal truth, one immutable attempt, exact completion
scope, delivery evidence, production regression compatibility, and any remaining
work. It contains no model reasoning or ownership transfer.

## Core shape

```json
{
  "schema_version": 10,
  "goal_mode": "pr",
  "invoked_alias": null,
  "goal": {
    "id": "apg_1234567890abcdef",
    "target": "PR_READY",
    "achieved": "PR_READY"
  },
  "attempt": {
    "id": "apa_1234567890abcdef",
    "result": "achieved",
    "basis": "initial",
    "previous_receipt_sha256": null,
    "change_artifact_ref": null,
    "change_evidence": "Initial bounded attempt."
  },
  "completion_scope": {
    "criteria_ids": ["AC-1"],
    "production_case_ids": [],
    "release_notes": "required",
    "artifact_ref": "impact-scope:run-1",
    "evidence": "Exact scoped completion inventory."
  },
  "open_items": []
}
```

`goal_mode` is only `pr` or `ship`. `invoked_alias` may be `release`,
`promote`, or `deploy` only for ship. `goal.target` and achieved values are
uppercase `PR_READY` or `SHIPPED`.

An achieved attempt requires `goal.achieved == goal.target` and
`open_items: []`. An incomplete attempt requires `goal.achieved: null` and at
least one exact open item:

```json
{
  "id": "OW-1",
  "kind": "blocker",
  "phase": "pre_mutation",
  "category": "credential",
  "reason": "Production credential is unavailable.",
  "evidence": "Preflight failed before merge.",
  "next_safe_action": "Resume this task when the credential is available."
}
```

Kinds are `blocker`, `failure`, `todo`, or `follow_up`. An incomplete receipt
is a resumable checkpoint, never a third achieved end state.

For `repair`, `external_state_change`, or `reconciliation`, use a new attempt ID
and require `previous_receipt_sha256`, `change_artifact_ref`, and concrete change
evidence. The goal ID remains stable. History checks that the prior digest is
the actual last valid incomplete receipt for this goal and that the attempt ID
has not been used; a formatted or cross-goal digest is rejected.
The sealed completion inventory may expand when directly causal work is
discovered, but a later attempt cannot remove prior criteria, production cases,
or a required release-note obligation merely to claim success.

## Common delivery evidence

Both achieved states require approved `plan`, non-empty `summary`, `git`, all
`passed` `criteria` and `checks`, coherent `pull_request`, and `release` evidence.
`completion_scope.criteria_ids` must exactly equal the criterion IDs.

Every achieved receipt has one passed `exact-candidate` check and one passed
`production-release-ready` check:

```json
{
  "name": "production-release-ready",
  "status": "passed",
  "production_path_status": "verified",
  "preflight_status": "passed",
  "credentials_status": "ready",
  "configuration_status": "ready",
  "migration_status": "not_applicable",
  "recovery_status": "ready",
  "next_action": "production_release",
  "evidence": "Only protected merge and the production action remain."
}
```

`migration_status: not_applicable` requires evidence that the release does not
change persisted production data or its interpretation. `migration_status:
ready` requires exactly one passed `production-data-compatibility` check:

```json
{
  "name": "production-data-compatibility",
  "status": "passed",
  "source_data_version": "currently-supported-production-v1",
  "target_data_version": "exact-candidate-v2",
  "representative_legacy_data": "legacy and edge-shaped records from the supported source version",
  "migration_execution_status": "passed",
  "new_system_read_status": "passed",
  "new_system_write_status": "passed",
  "critical_workflow_status": "passed",
  "data_invariants_status": "passed",
  "mixed_version_status": "not_applicable",
  "production_case_id": null,
  "artifact_ref": "test:migration-upgrade-e2e",
  "evidence": "The exact candidate operated migrated data through the new system."
}
```

For `PR_READY`, `production_case_id` is null because production has not been
mutated; the deterministic upgrade proof must already pass. For `SHIPPED`, it
must name one case in `capability_reachability.cases` that uses a migrated legacy
record through the normal production entry point and observes the new system's
terminal outcome. `new_system_write_status` may be `not_applicable` only for
immutable or genuinely read-only data. `mixed_version_status` may be
`not_applicable` only when an explicit downtime or hard-cutover boundary
prevents old and new runtimes from accessing incompatible data concurrently.

A completed migration command, migration-table row, schema version, backfill or
row count, and retained data presence are supporting evidence only. They do not
prove compatibility when the new system cannot discover, read, update when
applicable, or use the migrated data in an impacted critical workflow. Lazy
migration proof exercises both first access and repeat access.

Every achieved schema-v10 receipt also requires exactly one passed
`production-regression-compatibility` check:

```json
{
  "name": "production-regression-compatibility",
  "status": "passed",
  "current_production_baseline": "current supported production capabilities, interfaces, and configuration",
  "representative_existing_data": "current, legacy, and edge-shaped valid production fixtures",
  "existing_behavior_status": "passed",
  "existing_data_status": "passed",
  "release_gate_status": "passed",
  "regression_suite_status": "passed",
  "gaps_detected": false,
  "gap_remediation_status": "not_applicable",
  "gap_artifact_ref": null,
  "production_case_ids": [],
  "artifact_ref": "test:production-regression-compatibility",
  "evidence": "Existing behavior, data, and new release gates passed on the exact candidate."
}
```

This check inventories every affected capability that already works in
production, its supported interfaces and configuration, and representative valid
current, legacy, and edge-shaped data. The exact candidate must preserve their
terminal outcomes and invariants. A new or tightened gate must be exercised
against that valid baseline before enforcement; it may not make working behavior
or valid production data unusable.

If the proof discovers a gate false positive, data compatibility defect, or
rollout defect, set `gaps_detected: true`, name the evidence or repair in
`gap_artifact_ref`, repair the gap while the candidate is mutable, and require
`gap_remediation_status: passed` before admission. If no gap was found,
`gap_remediation_status` is `not_applicable` and `gap_artifact_ref` is null.
Bypass, silent data rejection, and disabling an existing capability are not
remediation.

For `PR_READY`, `production_case_ids` is empty because production has not been
mutated. For `SHIPPED`, it is non-empty and every ID names an impact-selected
existing-capability case in `capability_reachability.cases` that passed through
the normal production entry point after deployment.

`PR_READY` requires an open unmerged PR, current required CI, no production
artifacts, `release.status: not_requested`, no production cases, and no
promotion, notes, cleanup, or capability evidence. It means all non-production
and readiness work is complete—not merely that a PR exists.

## SHIPPED admission

`SHIPPED` requires one attempt-scoped binding:

```json
{
  "name": "release-contract-binding",
  "status": "passed",
  "contract_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "goal_id": "apg_1234567890abcdef",
  "attempt_id": "apa_1234567890abcdef",
  "candidate_base_sha": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "candidate_head_sha": "cccccccccccccccccccccccccccccccccccccccc",
  "pull_request_url": "https://host/owner/repo/pull/1",
  "source_receipt_sha256": null,
  "single_use": true,
  "evidence": "Immutable only for this mutation attempt."
}
```

Get the current contract digest with:

```bash
python3 <skill-dir>/scripts/validate_receipt.py --contract-sha256
```

The binding must match goal, attempt, exact candidate, promotion, and PR. Its
single-use rule seals only this admitted attempt. A later safely changed attempt
uses a new attempt ID and binding in the same task.

`promotion.source` is `live_candidate` with null source fields, or
`pr_ready_receipt` with an absolute readable current v10 PR_READY receipt and
matching SHA-256. A source receipt must identify the same base, head, and PR as
the promoted candidate; another valid PR cannot be substituted. Authority
evidence names the current `ship` command or alias.

## Production proof

`SHIPPED` requires a merged PR, `release.status: passed` with an HTTP(S)
release or deployment artifact URL, exact merged/deployed identity, and at
least one impact-selected capability case. Each case records:

- actor, credential class, resource scope, entry point, runtime principal, and
  representative data;
- equal expected and observed terminal outcomes;
- passed deterministic and production proof with artifact references; and
- when authorization changed, a passed allowed principal with at least one
  binding and a passed denied principal with zero bindings.

`completion_scope.production_case_ids` must exactly equal all proof case IDs.
Deployment, health, enqueue, or boot without this terminal proof is insufficient.
When migration applies, the case linked by `production-data-compatibility` must
operate representative migrated legacy data through the new system; data that
only remains stored but fails on use cannot support `SHIPPED`.
Every ID linked by `production-regression-compatibility` must prove an affected
existing production capability still reaches its supported terminal outcome.

## Notes, cleanup, and final message

```json
"release_notes": {
  "status": "passed",
  "artifact_ref": "https://host/owner/repo/releases/tag/v1",
  "evidence": "Published."
},
"cleanup": {
  "status": "passed",
  "worktree": "removed",
  "local_branch": "deleted",
  "remote_branch": "deleted",
  "remote_branch_policy_ref": null,
  "evidence": "All scoped closeout is complete."
}
```

Successful notes may be `passed` or evidence-backed `not_applicable`. Successful
cleanup uses `removed`/`not_used`, `deleted`/`not_used`, and
`deleted`/`absent`/`not_used`/`retained_by_policy`. Policy retention is complete
only when `remote_branch_policy_ref` names the governing policy and no action
remains.

`failed`, `not_run`, actionable `retained`, a TODO, warning, follow-up, or other
open item prevents `SHIPPED`. Production-live with closeout failure is a valid
`incomplete` receipt and must be repaired in the same task. Any incomplete
checkpoint at or after `post_mutation` must carry the complete admitted
candidate and binding plus one passed remote-state reconciliation artifact;
production-proof, notes, and cleanup phases also carry their applicable
evidence. This prevents an unknown remote state from becoming a retry plan.

The `release.message` begins with `### Release` and must be the exact final
visible Markdown before routing/receipt markers.

## Schema-v9 compatibility

The validator accepts released schema-v9 receipts under frozen v9 semantics and
their known released v9 contract digests. It does not retroactively require
`production-regression-compatibility` on those receipts. New receipts use schema
v10, and a schema-v10 ship promotion may only consume a schema-v10 PR_READY
source receipt. Historical run materialization continues to use the validator
archived with that run.

## Validation and history

Validate before responding:

```bash
python3 <skill-dir>/scripts/validate_receipt.py /absolute/path/to/receipt.json
```

Append:

```text
<!-- auto-pilot-receipt: /absolute/path/to/receipt.json -->
```

History verifies the exact goal mode, goal ID, attempt lineage, and immutable
receipt snapshot. Repeated Stop events cannot replace a captured attempt.
Missing or invalid evidence leaves the goal active. Legacy receipts are
preserved as legacy claims and are not silently upgraded to a current achieved
outcome.
