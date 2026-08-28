# Completion Receipt

Create a temporary JSON document with this version 7 shape. It records delivery and authority evidence, not model or orchestration choices.

```json
{
  "schema_version": 7,
  "mode": "pr",
  "terminal_state": "pr_ready",
  "plan": { "source": "docs/approved-plan.md", "approved": true },
  "summary": "Implemented the approved scope and opened a verified PR.",
  "git": {
    "base_branch": "main",
    "delivery_branch": "feature/example",
    "commits": ["0123456789abcdef0123456789abcdef01234567"]
  },
  "criteria": [
    { "id": "AC-1", "status": "passed", "evidence": "Observed behavior or deterministic check" }
  ],
  "checks": [
    { "name": "test", "status": "passed", "evidence": "Command, CI URL, or runtime result" }
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
    "evidence": "PR stage; production was not changed"
  },
  "blockers": []
}
```

Successful receipts require an approved plan, non-empty summary, at least one commit, one passed criterion, one evidenced check, a valid PR/MR URL, and no blockers.

- `pr_ready`: mode `pr`; PR is open or ready, unmerged, release is `not_requested`, and `promotion` is absent. When the repository defines exact-candidate or pre-merge qualification, the receipt's evidenced checks must include a current promotable PASS for the live head. FAIL, BYPASS, missing, stale, reconciled-but-unpromotable, or scope-mismatched evidence requires `blocked`.
- `merged_main`: mode `release`; PR is merged with a merge SHA, no deployment mechanism exists, release is `no_mechanism`, and task-worktree cleanup passed.
- `released`: mode `release`; PR is merged, release is `passed`, release and canonical-notes URLs exist, the exact final-response release message links those notes, exact capability reachability is proven for the deployed merge commit, and task-worktree cleanup passed.
- `blocked`: at least one blocker with `reason` and `evidence`; delivery sections may be omitted.

A successful release-mode receipt must add this object:

```json
"promotion": {
  "source": "live_pr",
  "source_receipt": null,
  "candidate_base_sha": "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
  "candidate_head_sha": "0123456789abcdef0123456789abcdef01234567",
  "authority_evidence": "Explicit current invocation: $auto-pilot release PR #1"
}
```

`source` is `live_pr` or `pr_ready_receipt`. Successful `merged_main` and
`released` results require `pr_ready_receipt`; `live_pr` is retained only so a
release task that cannot establish readiness can describe a blocked admission.
For `pr_ready_receipt`, set `source_receipt` to a readable absolute local receipt path
kept through final validation; otherwise it must be null. Its SHA-256 must
match `release-contract-binding.source_receipt_sha256`, it must itself say
`pr_ready`, and it must contain the promotion candidate. `candidate_head_sha`
must be the full live pre-merge PR head and must appear in `git.commits`. A receipt is
evidence only: `authority_evidence` must identify the fresh current promotion
invocation.

A successful release-mode receipt must also record automatic closeout:

```json
"cleanup": {
  "status": "passed",
  "worktree": "removed",
  "local_branch": "deleted",
  "remote_branch": "deleted",
  "evidence": "Verified clean/unlocked status and remote-base reachability; removed the task worktree from the primary checkout; pruned metadata; task branches are absent"
}
```

`worktree` is `removed` or `not_used`; `local_branch` is `deleted` or
`not_used`; `remote_branch` is `deleted`, `absent`, `not_used`, or
`retained_by_policy`. Successful `merged_main` and `released` receipts require
`cleanup.status: passed` and one of those terminal states. Create and retain the
temporary receipt outside the target worktree before removal. A dirty, locked,
unowned, unpushed, unreachable, force-required, or otherwise failed cleanup
must use terminal state `blocked`; it may record `cleanup.status` as `failed` or
`not_run` and `worktree`/`local_branch` as `retained`.

A `released` receipt must also add at least one impact-selected reachability
case. Do not add this object to `pr_ready` or `merged_main` receipts:

```json
"capability_reachability": {
  "deployed_candidate_sha": "cccccccccccccccccccccccccccccccccccccccc",
  "scope_evidence": "The repository release plan selected the changed comment reply capability only.",
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
      "deterministic": {
        "status": "passed",
        "evidence": "Exact local API-to-worker-to-fake-provider E2E artifact"
      },
      "production": {
        "status": "passed",
        "evidence": "One bounded canary through the deployed public API reached the terminal provider outcome"
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
terminal result. Both deterministic and production proof must pass. When
`authorization_changed` is true, authorized and unauthorized proofs are also
mandatory. The authorized case needs at least one effective scope binding; the
denied case needs zero effective bindings for that exact scope. The deployed
SHA must be the full merged commit recorded by the PR.

For `released`, use this release object:

```json
"release": {
  "status": "passed",
  "url": "https://github.com/owner/repo/releases/tag/v1.2.3",
  "notes_url": "https://github.com/owner/repo/releases/tag/v1.2.3",
  "message": "### Release\n\n**v1.2.3** — Released\n\n- User-visible change: The highest-impact outcome.\n- Verification: The exact post-release proof.\n- Distribution: GitHub and package registry complete.\n- Release notes: [v1.2.3](https://github.com/owner/repo/releases/tag/v1.2.3)",
  "evidence": "Production deployment, distribution, and post-release verification passed"
}
```

`notes_url` is the canonical published release note for the exact candidate;
it may equal `release.url`. `message` is the complete compact Markdown block,
not only its title. It must contain `notes_url` and must be appended verbatim as
the final visible content of the agent response. Hidden routing and receipt
markers follow it. Match repository conventions when they are stronger—for
example, a required copy-ready Cantonese handoff—but keep the note itself as
the source of truth. `not_requested` and `no_mechanism` releases use null
`notes_url` and `message`.

Repository impact selection decides which cases are affected. Production
canaries run only during an explicitly authorized release candidate, never on
every edit or commit. Use runtime-supplied dedicated canary resources through
the normal production integration; do not hard-code account IDs or require a
duplicate provider app merely for test isolation.

Record migrations, backfills, E2E, rollout, rollback, and post-release verification as normal `checks` when applicable. Extra evidence fields are allowed. Do not add model names, agent counts, reviewer identities, effort routing, or parallelism requirements.

Every release-mode result must record exactly one current contract binding:

```json
{
  "name": "release-contract-binding",
  "status": "passed",
  "contract_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "source_receipt_sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "candidate_head_sha": "0123456789abcdef0123456789abcdef01234567",
  "single_use": true,
  "evidence": "Recomputed before mutation from the installed contract and exact source receipt"
}
```

Get the installed fingerprint with `python3
<skill-dir>/scripts/validate_receipt.py --contract-sha256`. The validator
recomputes it and rejects an old contract. `candidate_head_sha` must equal the
promotion candidate. `source_receipt_sha256` is required for
`promotion.source: pr_ready_receipt` and must be null for `live_pr`. A terminal
release task is sealed; this check cannot be reused to resume it.

For `merged_main`, `released`, or a release-mode `blocked` result, record one
`release-control-budget` check in this exact shape:

```json
{
  "name": "release-control-budget",
  "status": "passed",
  "budget_seconds": 600,
  "live_pr_bound_at": "2026-08-28T09:00:00+08:00",
  "ended_at": "2026-08-28T09:08:30+08:00",
  "end_kind": "terminal",
  "elapsed_seconds": 510,
  "outcome": "passed",
  "evidence": "Measured from live PR binding through the complete release task"
}
```

`budget_seconds` is the declared whole-task wall-clock budget. `end_kind` is
`terminal` or `safe_boundary`. The timestamps must be timezone-aware, and
`elapsed_seconds` must match them. When elapsed time exceeds the budget, use
`status: failed` and `outcome: exhausted`; a successful release-mode receipt
cannot exceed its budget. This is timing evidence, not permission to interrupt
an unsafe in-flight mutation.

## Hand the receipt to local history

After `validate_receipt.py` succeeds, keep the temporary file in place through the final response and append one hidden marker using its absolute path:

```text
<!-- auto-pilot-receipt: /absolute/path/to/receipt.json -->
```

The passive local hook runs the same full validator, verifies the invocation mode, copies the receipt into the private run archive, and hashes the source path without storing that path. Missing or invalid receipt evidence remains `unknown`; final-message keywords never create a successful history record.
