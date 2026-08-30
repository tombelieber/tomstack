# Goal-attempt receipt

Schema version 9 records goal truth, one immutable attempt, exact completion
scope, delivery evidence, and any remaining work. It contains no model reasoning
or ownership transfer.

## Core shape

```json
{
  "schema_version": 9,
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
`pr_ready_receipt` with an absolute readable current v9 PR_READY receipt and
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
preserved as legacy claims and are not silently upgraded to a v9 achieved
outcome.
