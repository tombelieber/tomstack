# Completion receipt

Create a temporary JSON document with schema version 8. It records delivery and
authority evidence, not model reasoning or orchestration choices.

## PR-only result

```json
{
  "schema_version": 8,
  "mode": "pr",
  "terminal_state": "pr_ready",
  "plan": {"source": "docs/approved-plan.md", "approved": true},
  "summary": "Implemented the approved scope and opened a verified PR.",
  "git": {
    "base_branch": "main",
    "delivery_branch": "feature/example",
    "commits": ["0123456789abcdef0123456789abcdef01234567"]
  },
  "criteria": [
    {"id": "AC-1", "status": "passed", "evidence": "Observed terminal behavior"}
  ],
  "checks": [
    {
      "name": "exact-candidate",
      "status": "passed",
      "candidate_base_sha": "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
      "candidate_head_sha": "0123456789abcdef0123456789abcdef01234567",
      "pull_request_url": "https://host/owner/repo/pull/1",
      "promotable": true,
      "required_ci_status": "passed",
      "evidence": "Current promotable PASS for the exact live base and head"
    }
  ],
  "pull_request": {
    "url": "https://host/owner/repo/pull/1",
    "status": "open",
    "merged": false,
    "merge_sha": null
  },
  "release": {
    "status": "not_requested",
    "url": null,
    "notes_url": null,
    "message": null,
    "evidence": "PR-only mode; production was not changed"
  },
  "blockers": []
}
```

`pr_ready` requires an open unmerged PR and exactly one passed
`exact-candidate` check. Its full base SHA, head SHA, PR URL, promotability, and
required-CI status must match the receipt; a generic passed test is insufficient.
In `ship`, store this validated receipt as an internal admission input; do not
emit it as the final result.

## Production result

A successful `ship` or `release` receipt uses mode `release` and terminal state
`released`. It contains the common plan, Git, criteria, checks, PR, release, and
blocker fields plus `promotion`, `cleanup`, and `capability_reachability`.

```json
"promotion": {
  "source": "pr_ready_receipt",
  "source_receipt": "/absolute/path/to/pr-ready-receipt.json",
  "candidate_base_sha": "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
  "candidate_head_sha": "0123456789abcdef0123456789abcdef01234567",
  "authority_evidence": "Explicit current invocation: $auto-pilot ship docs/approved-plan.md"
}
```

The source receipt may have been written earlier in the same `ship` task or
created read-only from current exact-head evidence in direct `release`. It must
validate as `pr_ready`, remain readable through final validation, contain the
candidate head, and match the binding digest below. A receipt is evidence only;
`authority_evidence` must name the current explicit `ship`, `release`, or
`promote` invocation.

Every release-mode success records exactly one current binding:

```json
{
  "name": "release-contract-binding",
  "status": "passed",
  "contract_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "source_receipt_sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "candidate_base_sha": "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
  "candidate_head_sha": "0123456789abcdef0123456789abcdef01234567",
  "pull_request_url": "https://host/owner/repo/pull/1",
  "single_use": true,
  "evidence": "Recomputed before mutation from the installed contract and exact source receipt"
}
```

Get the installed fingerprint with:

```bash
python3 <skill-dir>/scripts/validate_receipt.py --contract-sha256
```

The binding base, head, and PR URL must equal the promotion, exact-candidate,
and source-receipt identities. A terminal result seals that release attempt;
its binding cannot authorize another attempt.

## Production capability proof

A `released` receipt requires at least one impact-selected reachability case:

```json
"capability_reachability": {
  "deployed_candidate_sha": "cccccccccccccccccccccccccccccccccccccccc",
  "scope_evidence": "Release impact selected the changed reply capability.",
  "cases": [
    {
      "id": "comment-reply",
      "actor": "authenticated external caller",
      "credential_class": "personal access token",
      "resource_scope": "runtime-supplied canary workspace and connected account",
      "entrypoint": "public reply apply endpoint",
      "runtime_principal": "production edge runtime database role",
      "representative_data_case": "legacy missing author identity plus a valid reply target",
      "expected_terminal_outcome": "provider reply identifier observed",
      "observed_terminal_outcome": "provider reply identifier observed",
      "deterministic": {
        "status": "passed",
        "artifact_ref": "test:provider-e2e#comment-reply",
        "evidence": "Exact local API-to-worker-to-fake-provider E2E artifact"
      },
      "production": {
        "status": "passed",
        "artifact_ref": "probe:production/comment-reply/run-123",
        "evidence": "Bounded production action reached the terminal provider outcome"
      },
      "authorization_changed": true,
      "authorized": {
        "status": "passed",
        "decision": "allowed",
        "effective_binding_count": 1,
        "evidence": "Authorized runtime credential reached the scoped capability"
      },
      "unauthorized": {
        "status": "passed",
        "decision": "denied",
        "effective_binding_count": 0,
        "evidence": "Out-of-scope credential was denied at the same boundary"
      }
    }
  ]
}
```

Each case binds the observable capability to its real actor, credential,
resource scope, entry point, runtime principal, representative data, and
terminal result. `observed_terminal_outcome` must equal the expected outcome,
and passed deterministic and production proofs require a concrete artifact,
run, or probe reference. Deterministic and production proof must pass. When
authorization changed, the allowed proof needs at least one effective binding
and the denied proof needs zero. `deployed_candidate_sha` must equal the merged
commit recorded by the PR.

Production canaries run only for an explicitly authorized release candidate.
Use runtime-supplied dedicated resources through the normal integration. Do not
hard-code account IDs or manufacture unrelated provider traffic.

## Release message and closeout

```json
"release": {
  "status": "passed",
  "url": "https://github.com/owner/repo/releases/tag/v1.2.3",
  "notes_url": "https://github.com/owner/repo/releases/tag/v1.2.3",
  "message": "### Release\n\n**v1.2.3** — Live in production\n\n- User-visible change: The highest-impact outcome.\n- Verification: The exact production proof.\n- Release notes: https://github.com/owner/repo/releases/tag/v1.2.3",
  "evidence": "Production deployment, distribution, and terminal verification passed"
}
```

`message` is mandatory and must be the exact final visible Markdown block.
`url` and `notes_url` are optional because production truth must not depend on a
separate announcement system. When `notes_url` exists, `message` must link it.
Record a failed note publication in `evidence`; do not claim it succeeded.

Every release result records the attempted local closeout:

```json
"cleanup": {
  "status": "passed",
  "worktree": "removed",
  "local_branch": "deleted",
  "remote_branch": "deleted",
  "evidence": "Verified ownership and reachability, then removed task-owned Git state"
}
```

`status` is `passed`, `failed`, or `not_run`. Successful terminal field values
are `removed`/`not_used`, `deleted`/`not_used`, and
`deleted`/`absent`/`not_used`/`retained_by_policy`. A failed or skipped closeout
may use `retained`. Cleanup never proves production. A retained local worktree
must be disclosed but does not invalidate otherwise complete production proof.

## Blocked result

`blocked` requires at least one blocker with `phase`, `category`, non-empty
`reason`, and `evidence`. Phases are `implementation`, `qualification`,
`pre_mutation`, `post_mutation`, or `production_proof`. Categories are `code`,
`ci`, `release_path`, `authorization`, `credential`, `remote_state`, `provider`,
`safety`, or `other`. Closeout is deliberately not a blocker phase.

Delivery sections are optional for a pre-mutation blocker such as a missing
production path. A post-mutation or production-proof blocker requires a
coherent merged PR plus the original Git, exact-candidate, promotion, and
release-contract binding evidence. Any included section must validate; do not
include guessed placeholders. If release status and every production case
already prove the merged candidate live, the terminal state must be `released`;
note or local cleanup failure remains a warning instead of a blocker.

## Hand the receipt to local history

After validation, retain the temporary file through the final response and
append:

```text
<!-- auto-pilot-receipt: /absolute/path/to/receipt.json -->
```

The passive history hook runs the validator archived with the invocation's
exact skill bundle and verifies invocation mode. For current-contract
`released` results it also requires `current_ship_task` or
`current_release_task` routing in the invoking task. Missing, invalid, or
same-task-mismatched evidence stays `unknown`; response keywords never create a
successful history result.
