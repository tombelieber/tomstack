# Evidence and receipt model

A receipt records a QA decision. It does not grant merge, release, deployment,
migration, or other production authority.

## Minimal shape

```json
{
  "schema_version": 1,
  "lane": "affected",
  "candidate": {
    "repository": "https://example.invalid/owner/repo",
    "base": "full-base-sha-or-null",
    "head": "full-head-sha-or-null",
    "tree": "candidate-tree-or-null",
    "dirty_digest": "working-tree-digest-or-null"
  },
  "impact": {
    "classes": ["backend"],
    "unknown": false,
    "reasons": ["src/api/example.ts changed"]
  },
  "checks": [
    {
      "id": "backend-unit",
      "command": "repository-defined command",
      "status": "passed",
      "evidence": "bounded log path or result reference"
    }
  ],
  "skipped": [
    {
      "surface": "web",
      "reason": "detached surface; untouched and no dependency edge"
    }
  ],
  "release": {
    "authorized": false,
    "performed": false
  },
  "outcome": "passed"
}
```

Validate a receipt with:

```bash
node <skill-dir>/scripts/validate-receipt.mjs <receipt.json>
```

## Candidate identity

Record enough identity to prevent evidence from moving silently:

- repository identity;
- base and head for a committed range;
- prospective candidate tree for pre-merge;
- a deterministic dirty-tree digest for working changes;
- relevant lock/config hashes, toolchain, gate version, and environment class
  when the repository supports them.

At least one of `head`, `tree`, or `dirty_digest` must be present. A later diff
cannot inherit a previous receipt merely because filenames look similar.

## Selection evidence

Each decision must expose:

- impact classes and reasons;
- the exact selected checks and their commands;
- skipped surfaces and explicit reasons;
- unknown or stale inputs;
- critical prerequisites that were unavailable.

Never record an absent prerequisite as a passing skip. Use `blocked` or `failed`.

## Reuse and freshness

Reuse a result only when its candidate, declared inputs, dependencies,
toolchain, environment class, and gate version still match. Record cache reuse
separately from the check outcome.

Pre-merge and release qualification may require fresh execution even when safe
dependency/download caches remain warm. Follow the repository contract.

## Outcome rules

- `passed`: every selected check passed and no unresolved unknown remains.
- `failed`: at least one selected check failed.
- `blocked`: required evidence or a decision prerequisite is unavailable.

`release.performed` may never be true when `release.authorized` is false. Even
an authorized release is outside this skill unless another owner workflow
executes and verifies it.
